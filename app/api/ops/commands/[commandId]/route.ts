import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import {
  applyConversationalOpsAction,
  getCommandById,
  processDueOpsRetries,
} from '@/lib/server/ops-copilot-engine';
import { loadOpsCopilotState, saveOpsCopilotState } from '@/lib/server/ops-copilot-store';
import {
  loadDeliveryManagementState,
  saveDeliveryManagementState,
} from '@/lib/server/delivery-management-store';

export const runtime = 'nodejs';

const actionSchema = z.object({
  action: z.enum(['confirm', 'approve', 'schedule', 'execute', 'rollback', 'reject']),
  actorRole: z.enum(['owner', 'manager', 'staff', 'internal']).optional(),
  scheduledAt: z.string().optional(),
  autoRestoreAt: z.string().optional(),
  note: z.string().max(300).optional(),
  force: z.boolean().optional(),
});

function getUserContext(userId: string | null) {
  return {
    userKey: userId ?? 'anonymous',
    actorId: userId ?? 'anonymous',
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ commandId: string }> }
) {
  const { userId } = await auth();
  const { userKey } = getUserContext(userId);
  const [state, deliveryState] = await Promise.all([
    loadOpsCopilotState(userKey),
    loadDeliveryManagementState(userKey),
  ]);
  const retryProcessed = await processDueOpsRetries({
    userKey,
    opsState: state,
    deliveryState,
  });
  if (retryProcessed.queueChanged) {
    await Promise.all([
      saveOpsCopilotState(userKey, retryProcessed.opsState),
      saveDeliveryManagementState(userKey, retryProcessed.deliveryState),
    ]);
  }
  const { commandId } = await params;
  const command = getCommandById(retryProcessed.opsState, commandId);
  if (!command) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ command, updatedAt: retryProcessed.opsState.updatedAt });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ commandId: string }> }
) {
  const body = await req.json().catch(() => ({}));
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_ops_command_action_payload' }, { status: 400 });
  }

  const { userId } = await auth();
  const { userKey, actorId } = getUserContext(userId);
  const { commandId } = await params;
  const opsState = await loadOpsCopilotState(userKey);
  const deliveryState = await loadDeliveryManagementState(userKey);

  try {
    const result = await applyConversationalOpsAction({
      userKey,
      opsState,
      deliveryState,
      commandId,
      action: parsed.data.action,
      actorId,
      actorRole: parsed.data.actorRole ?? 'manager',
      scheduledAt: parsed.data.scheduledAt,
      autoRestoreAt: parsed.data.autoRestoreAt,
      note: parsed.data.note,
      force: parsed.data.force ?? false,
    });

    await Promise.all([
      saveOpsCopilotState(userKey, result.opsState),
      saveDeliveryManagementState(userKey, result.deliveryState),
    ]);

    return NextResponse.json({
      command: result.command,
      updatedAt: result.opsState.updatedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ops_command_action_failed' },
      { status: 400 }
    );
  }
}
