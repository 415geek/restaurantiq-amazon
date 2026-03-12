import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import {
  createConversationalOpsCommand,
  listRecentCommands,
  processDueOpsRetries,
} from '@/lib/server/ops-copilot-engine';
import { loadOpsCopilotState, saveOpsCopilotState } from '@/lib/server/ops-copilot-store';
import {
  loadDeliveryManagementState,
  saveDeliveryManagementState,
} from '@/lib/server/delivery-management-store';

export const runtime = 'nodejs';

const createSchema = z.object({
  command: z.string().min(3).max(500),
  actorRole: z.enum(['owner', 'manager', 'staff', 'internal']).optional(),
});

function getUserContext(userId: string | null) {
  return {
    userKey: userId ?? 'anonymous',
    actorId: userId ?? 'anonymous',
  };
}

export async function GET() {
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
  return NextResponse.json({
    updatedAt: retryProcessed.opsState.updatedAt,
    commands: listRecentCommands(retryProcessed.opsState),
    retryProcessed: retryProcessed.processed,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_ops_command_payload' }, { status: 400 });
  }

  const { userId } = await auth();
  const { userKey, actorId } = getUserContext(userId);
  const deliveryState = await loadDeliveryManagementState(userKey);
  const state = await loadOpsCopilotState(userKey);
  const command = await createConversationalOpsCommand({
    sourceText: parsed.data.command.trim(),
    actorId,
    actorRole: parsed.data.actorRole ?? 'manager',
    deliveryState,
  });

  const nextState = {
    ...state,
    updatedAt: new Date().toISOString(),
    commands: [command, ...state.commands].slice(0, 120),
  };
  await saveOpsCopilotState(userKey, nextState);

  return NextResponse.json({
    command,
    updatedAt: nextState.updatedAt,
  });
}
