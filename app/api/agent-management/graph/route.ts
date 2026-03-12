import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { loadAgentGraph, saveAgentGraph } from '@/lib/server/agent-graph-store';
import { isAgentStudioHost } from '@/lib/agent-studio-host';
import { normalizeAgentGraph, type AgentGraph } from '@/lib/agent-management';
import { getInternalAgentStudioAccess } from '@/lib/server/internal-access';
import { syncAgentGraphToPythonOrchestrator } from '@/lib/server/python-orchestrator-sync';

function forbid(reason: string) {
  return NextResponse.json({ error: 'forbidden', reason }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const host = req.headers.get('host');
  if (!isAgentStudioHost(host)) return forbid('host_mismatch');

  const { userId } = await auth();
  if (!userId) return forbid('auth_missing');
  const access = await getInternalAgentStudioAccess();
  if (!access.allowed) return forbid(access.reason);

  const graph = await loadAgentGraph();
  return NextResponse.json(graph);
}

export async function PUT(req: NextRequest) {
  const host = req.headers.get('host');
  if (!isAgentStudioHost(host)) return forbid('host_mismatch');

  const { userId } = await auth();
  if (!userId) return forbid('auth_missing');
  const access = await getInternalAgentStudioAccess();
  if (!access.allowed) return forbid(access.reason);

  const body = (await req.json().catch(() => null)) as AgentGraph | null;
  if (!body || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const normalized = normalizeAgentGraph(body);
    const graph = await saveAgentGraph(normalized, access.email ?? userId);
    try {
      await syncAgentGraphToPythonOrchestrator(graph);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'orchestrator_sync_failed';
      console.error('agent_graph_orchestrator_sync_failed', error);
      return NextResponse.json(
        {
          error: 'orchestrator_sync_failed',
          reason,
          graph_saved_locally: true,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(graph);
  } catch (error) {
    console.error('agent_graph_save_failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
