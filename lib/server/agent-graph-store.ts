import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDefaultAgentGraph, normalizeAgentGraph, type AgentGraph } from '@/lib/agent-management';

const graphDir = path.join(process.cwd(), '.runtime', 'agent-studio');
const graphPath = path.join(graphDir, 'graph.json');

type PersistedAgentGraph = AgentGraph & {
  savedBy?: string;
  savedAt?: string;
};

async function ensureGraphDir() {
  await mkdir(graphDir, { recursive: true });
}

export async function loadAgentGraph(): Promise<PersistedAgentGraph> {
  try {
    const raw = await readFile(graphPath, 'utf8');
    return normalizeAgentGraph(JSON.parse(raw)) as PersistedAgentGraph;
  } catch {
    return createDefaultAgentGraph();
  }
}

export async function saveAgentGraph(graph: AgentGraph, savedBy: string) {
  await ensureGraphDir();
  const next: PersistedAgentGraph = {
    ...normalizeAgentGraph(graph),
    savedBy,
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeFile(graphPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
