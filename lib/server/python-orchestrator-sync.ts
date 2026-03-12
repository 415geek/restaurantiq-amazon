import type { AgentGraph, AgentKind, AgentNode, AgentTool } from '@/lib/agent-management';

type PythonAgentRole = 'collector' | 'analyzer' | 'executor' | 'supervisor' | 'custom';

type PythonToolConfig = {
  tool_id: string;
  name: string;
  endpoint: string;
  auth_type: string;
  enabled: boolean;
  rate_limit: number;
  timeout_seconds: number;
};

type PythonAgentConfig = {
  agent_id: string;
  name: string;
  name_en: string;
  description: string;
  role: PythonAgentRole;
  agent_type: string;
  icon: string;
  color: string;
  enabled: boolean;
  model: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  system_prompt: string;
  prompt_template: string;
  few_shot_examples: Array<Record<string, unknown>>;
  fine_tune_model_id: string | null;
  fine_tune_dataset: string | null;
  tools: PythonToolConfig[];
  max_tool_calls: number;
  retry_count: number;
  timeout_seconds: number;
  batch_size: number;
  input_agents: string[];
  output_agents: string[];
  schedule_cron: string | null;
  trigger_events: string[];
  tenant_id: string | null;
};

type PythonPipelineConfig = {
  pipeline_id: string;
  name: string;
  description: string;
  restaurant_id: string;
  agents: PythonAgentConfig[];
  edges: Array<[string, string]>;
  global_config: Record<string, unknown>;
  is_active: boolean;
};

const ORCHESTRATOR_KIND_MAP: Record<
  AgentKind,
  { role: PythonAgentRole; agentType: string; icon: string; color: string }
> = {
  ops: { role: 'collector', agentType: 'collector_ops', icon: '📊', color: '#06b6d4' },
  social: { role: 'collector', agentType: 'collector_social', icon: '📣', color: '#d946ef' },
  macro: { role: 'collector', agentType: 'collector_macro', icon: '🌦️', color: '#10b981' },
  analysis: { role: 'analyzer', agentType: 'analyzer_fusion', icon: '🧠', color: '#f26a36' },
  planner: { role: 'analyzer', agentType: 'planner_strategy', icon: '🗺️', color: '#fb923c' },
  validator: { role: 'analyzer', agentType: 'validator_output', icon: '🛡️', color: '#22c55e' },
  execution: { role: 'executor', agentType: 'execution_planner', icon: '⚙️', color: '#f59e0b' },
  custom: { role: 'custom', agentType: 'custom_generic', icon: '🧩', color: '#71717a' },
};

function getOrchestratorBaseUrl() {
  const baseUrl = process.env.PYTHON_ORCHESTRATOR_API_URL?.trim();
  return baseUrl ? baseUrl.replace(/\/$/, '') : null;
}

function buildHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.PYTHON_ORCHESTRATOR_API_KEY?.trim();
  if (apiKey) {
    headers['x-orchestrator-key'] = apiKey;
  }
  return headers;
}

function mapTools(tools: AgentTool[]): PythonToolConfig[] {
  return tools.map((tool) => ({
    tool_id: tool.toolId,
    name: tool.name,
    endpoint: tool.endpoint,
    auth_type: tool.authType,
    enabled: tool.enabled,
    rate_limit: tool.rateLimit,
    timeout_seconds: tool.timeoutSeconds,
  }));
}

function defaultToolsForKind(kind: AgentKind): PythonToolConfig[] {
  switch (kind) {
    case 'ops':
      return [
        {
          tool_id: 'pos_connector',
          name: 'POS Connector',
          endpoint: 'app.tools.pos_connector.fetch',
          auth_type: 'oauth2',
          enabled: true,
          rate_limit: 240,
          timeout_seconds: 30,
        },
        {
          tool_id: 'delivery_connector',
          name: 'Delivery Connector',
          endpoint: 'app.tools.delivery_connector.fetch',
          auth_type: 'oauth2',
          enabled: true,
          rate_limit: 240,
          timeout_seconds: 30,
        },
      ];
    case 'social':
      return [
        {
          tool_id: 'social_connector',
          name: 'Social Connector',
          endpoint: 'app.tools.social_connector.fetch',
          auth_type: 'oauth2',
          enabled: true,
          rate_limit: 180,
          timeout_seconds: 30,
        },
      ];
    case 'macro':
      return [
        {
          tool_id: 'weather_api',
          name: 'Weather API',
          endpoint: 'app.tools.weather_api.fetch',
          auth_type: 'api_key',
          enabled: true,
          rate_limit: 120,
          timeout_seconds: 20,
        },
        {
          tool_id: 'news_api',
          name: 'News API',
          endpoint: 'app.tools.news_api.fetch',
          auth_type: 'api_key',
          enabled: true,
          rate_limit: 120,
          timeout_seconds: 20,
        },
      ];
    default:
      return [];
  }
}

function inferSchedule(kind: AgentKind) {
  switch (kind) {
    case 'ops':
      return '*/15 * * * *';
    case 'social':
      return '0 */4 * * *';
    case 'macro':
      return '0 */6 * * *';
    default:
      return null;
  }
}

function toPythonAgent(node: AgentNode, graph: AgentGraph): PythonAgentConfig {
  const mapping = ORCHESTRATOR_KIND_MAP[node.kind];
  const inputAgents = graph.edges.filter((edge) => edge.target === node.id).map((edge) => edge.source);
  const outputAgents = graph.edges.filter((edge) => edge.source === node.id).map((edge) => edge.target);
  return {
    agent_id: node.id,
    name: node.name,
    name_en: node.nameEn || mapping.agentType,
    description: node.description || node.role,
    role: mapping.role,
    agent_type: node.agentType || mapping.agentType,
    icon: node.icon || mapping.icon,
    color: node.color || mapping.color,
    enabled: node.enabled,
    model: node.model,
    temperature: node.temperature,
    top_p: node.topP,
    max_tokens: node.maxTokens,
    system_prompt: node.prompt,
    prompt_template: node.promptTemplate,
    few_shot_examples: node.fewShotExamples,
    fine_tune_model_id: node.fineTune || null,
    fine_tune_dataset: null,
    tools: node.tools.length > 0 ? mapTools(node.tools) : defaultToolsForKind(node.kind),
    max_tool_calls: node.maxToolCalls,
    retry_count: node.retryCount,
    timeout_seconds: node.timeoutSeconds,
    batch_size: node.batchSize,
    input_agents: inputAgents,
    output_agents: outputAgents,
    schedule_cron: node.scheduleCron || inferSchedule(node.kind),
    trigger_events: node.triggerEvents,
    tenant_id: 'restaurantiq-main',
  };
}

export function agentGraphToPythonPipeline(graph: AgentGraph): PythonPipelineConfig {
  return {
    pipeline_id: 'agenttune_working_graph',
    name: 'AgentTune Working Graph',
    description: 'Synced from Next.js internal Agent Management Dashboard',
    restaurant_id: 'restaurantiq-default',
    agents: graph.nodes.map((node) => toPythonAgent(node, graph)),
    edges: graph.edges.map((edge) => [edge.source, edge.target]),
    global_config: {
      source: 'nextjs-agenttune',
      updatedAt: graph.updatedAt,
      ui: {
        positions: graph.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, kind: node.kind })),
      },
    },
    is_active: true,
  };
}

export async function syncAgentGraphToPythonOrchestrator(graph: AgentGraph) {
  const baseUrl = getOrchestratorBaseUrl();
  if (!baseUrl) {
    return { synced: false, skipped: true, reason: 'orchestrator_not_configured' as const };
  }

  const response = await fetch(`${baseUrl}/api/pipelines/current`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(agentGraphToPythonPipeline(graph)),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`python_orchestrator_sync_failed_${response.status}${text ? `_${text.slice(0, 120)}` : ''}`);
  }

  return {
    synced: true,
    skipped: false,
    payload: (await response.json()) as Record<string, unknown>,
  };
}
