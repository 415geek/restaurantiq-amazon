export type AgentKind =
  | 'ops'
  | 'social'
  | 'macro'
  | 'analysis'
  | 'planner'
  | 'validator'
  | 'execution'
  | 'custom';

export type AgentTool = {
  toolId: string;
  name: string;
  endpoint: string;
  authType: 'api_key' | 'oauth2' | 'none';
  enabled: boolean;
  rateLimit: number;
  timeoutSeconds: number;
};

export type AgentNode = {
  id: string;
  name: string;
  nameEn: string;
  kind: AgentKind;
  agentType: string;
  description: string;
  role: string;
  icon: string;
  color: string;
  prompt: string;
  promptTemplate: string;
  fewShotExamples: Array<Record<string, unknown>>;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  fineTune: string;
  tools: AgentTool[];
  maxToolCalls: number;
  retryCount: number;
  timeoutSeconds: number;
  batchSize: number;
  scheduleCron: string;
  triggerEvents: string[];
  enabled: boolean;
  x: number;
  y: number;
};

export type AgentEdge = {
  id: string;
  source: string;
  target: string;
};

export type AgentGraph = {
  nodes: AgentNode[];
  edges: AgentEdge[];
  updatedAt: string;
  savedAt?: string;
  savedBy?: string;
};

export const AGENT_GRAPH_STORAGE_KEY = 'restaurantiq.agent.graph.v2';

export const MODEL_OPTIONS = ['gpt-4o-mini', 'gpt-4o', 'gpt-5-mini', 'gpt-5', 'o4-mini'] as const;

type AgentSeed = Omit<AgentNode, 'x' | 'y'>;

const DEFAULT_AGENT_SEEDS: Array<AgentSeed & { x: number; y: number }> = [
  {
    id: 'agent-a',
    name: 'Agent A',
    nameEn: 'Collector Ops',
    kind: 'ops',
    agentType: 'collector_ops',
    description: '清洗、解析和归类 POS / 外卖 / 排班 / 库存等运营数据。',
    role: '实时运营数据监控',
    icon: '📊',
    color: '#06b6d4',
    prompt:
      '负责清洗、解析、归类 POS / 外卖 / 排班 / 库存数据，输出结构化运营摘要、异常点和指标快照。',
    promptTemplate: 'collector_ops.j2',
    fewShotExamples: [],
    model: 'gpt-5-mini',
    temperature: 0.2,
    topP: 0.9,
    maxTokens: 2400,
    fineTune: '',
    tools: [
      {
        toolId: 'pos_connector',
        name: 'POS Connector',
        endpoint: 'app.tools.pos_connector.fetch',
        authType: 'oauth2',
        enabled: true,
        rateLimit: 240,
        timeoutSeconds: 30,
      },
      {
        toolId: 'delivery_connector',
        name: 'Delivery Connector',
        endpoint: 'app.tools.delivery_connector.fetch',
        authType: 'oauth2',
        enabled: true,
        rateLimit: 240,
        timeoutSeconds: 30,
      },
    ],
    maxToolCalls: 5,
    retryCount: 2,
    timeoutSeconds: 60,
    batchSize: 10,
    scheduleCron: '*/15 * * * *',
    triggerEvents: ['upload.received', 'ops.refresh'],
    enabled: true,
    x: 40,
    y: 80,
  },
  {
    id: 'agent-b',
    name: 'Agent B',
    nameEn: 'Collector Social',
    kind: 'social',
    agentType: 'collector_social',
    description: '汇总 Facebook / Instagram / Google / Yelp 等社媒与评论信号。',
    role: '社媒与口碑监控',
    icon: '📣',
    color: '#d946ef',
    prompt:
      '负责汇总 Facebook / Instagram / Google / Yelp 等社媒与评论信号，归一化互动和情绪数据。',
    promptTemplate: 'collector_social.j2',
    fewShotExamples: [],
    model: 'gpt-5-mini',
    temperature: 0.2,
    topP: 0.9,
    maxTokens: 2200,
    fineTune: '',
    tools: [
      {
        toolId: 'social_connector',
        name: 'Social Connector',
        endpoint: 'app.tools.social_connector.fetch',
        authType: 'oauth2',
        enabled: true,
        rateLimit: 180,
        timeoutSeconds: 30,
      },
    ],
    maxToolCalls: 5,
    retryCount: 2,
    timeoutSeconds: 60,
    batchSize: 10,
    scheduleCron: '0 */4 * * *',
    triggerEvents: ['social.refresh', 'review.new'],
    enabled: true,
    x: 40,
    y: 320,
  },
  {
    id: 'agent-c',
    name: 'Agent C',
    nameEn: 'Collector Macro',
    kind: 'macro',
    agentType: 'collector_macro',
    description: '采集天气、事件、新闻、节假日等宏观影响信号。',
    role: '宏观因子监控',
    icon: '🌦️',
    color: '#10b981',
    prompt:
      '负责天气、商圈、交通、节假日、事件和区域宏观环境的结构化信号输出。',
    promptTemplate: 'collector_macro.j2',
    fewShotExamples: [],
    model: 'gpt-5-mini',
    temperature: 0.15,
    topP: 0.85,
    maxTokens: 2200,
    fineTune: '',
    tools: [
      {
        toolId: 'weather_api',
        name: 'Weather API',
        endpoint: 'app.tools.weather_api.fetch',
        authType: 'api_key',
        enabled: true,
        rateLimit: 120,
        timeoutSeconds: 20,
      },
      {
        toolId: 'news_api',
        name: 'News API',
        endpoint: 'app.tools.news_api.fetch',
        authType: 'api_key',
        enabled: true,
        rateLimit: 120,
        timeoutSeconds: 20,
      },
    ],
    maxToolCalls: 5,
    retryCount: 2,
    timeoutSeconds: 60,
    batchSize: 10,
    scheduleCron: '0 */6 * * *',
    triggerEvents: ['macro.refresh', 'weather.alert'],
    enabled: true,
    x: 40,
    y: 560,
  },
  {
    id: 'agent-fusion',
    name: 'Fusion',
    nameEn: 'Analyzer Fusion',
    kind: 'analysis',
    agentType: 'analyzer_fusion',
    description: '整合 A/B/C 的结构化结果，提炼 KPI、异常和洞察。',
    role: '融合分析',
    icon: '🧠',
    color: '#f26a36',
    prompt:
      '负责整合 Agent A/B/C 的结构化输出，形成可供策略规划使用的统一分析摘要。',
    promptTemplate: 'analyzer.j2',
    fewShotExamples: [],
    model: 'gpt-4o',
    temperature: 0.2,
    topP: 0.9,
    maxTokens: 3200,
    fineTune: '',
    tools: [],
    maxToolCalls: 3,
    retryCount: 2,
    timeoutSeconds: 60,
    batchSize: 10,
    scheduleCron: '',
    triggerEvents: [],
    enabled: true,
    x: 430,
    y: 240,
  },
  {
    id: 'agent-plan',
    name: 'Strategy Planner',
    nameEn: 'Planner Strategy',
    kind: 'planner',
    agentType: 'planner_strategy',
    description: '将融合分析结果转成 14 天执行计划、实验和数据请求。',
    role: '策略规划',
    icon: '🗺️',
    color: '#fb923c',
    prompt:
      '负责根据融合分析生成严格结构化的 14 天执行计划、实验设计、数据请求和发布说明。',
    promptTemplate: 'planner_strategy.j2',
    fewShotExamples: [],
    model: 'gpt-4o',
    temperature: 0.15,
    topP: 0.9,
    maxTokens: 8000,
    fineTune: '',
    tools: [],
    maxToolCalls: 2,
    retryCount: 2,
    timeoutSeconds: 90,
    batchSize: 10,
    scheduleCron: '',
    triggerEvents: [],
    enabled: true,
    x: 820,
    y: 180,
  },
  {
    id: 'agent-qa',
    name: 'QA Validator',
    nameEn: 'Validator Output',
    kind: 'validator',
    agentType: 'validator_output',
    description: '校验计划完整性、修复错误并生成 frontend-ready 输出。',
    role: 'QA 校验与前端格式化',
    icon: '🛡️',
    color: '#22c55e',
    prompt:
      '负责验证策略计划、自动修复枚举与完整性问题，并输出可直接用于前端渲染的结构。',
    promptTemplate: 'validator_output.j2',
    fewShotExamples: [],
    model: 'gpt-4o',
    temperature: 0,
    topP: 1,
    maxTokens: 6000,
    fineTune: '',
    tools: [],
    maxToolCalls: 2,
    retryCount: 2,
    timeoutSeconds: 90,
    batchSize: 10,
    scheduleCron: '',
    triggerEvents: [],
    enabled: true,
    x: 1210,
    y: 180,
  },
  {
    id: 'exec-price',
    name: 'Pricing Executor',
    nameEn: 'Executor Pricing',
    kind: 'execution',
    agentType: 'exec_pricing',
    description: '输出价格调整类动作的待确认执行计划。',
    role: '定价执行预览',
    icon: '💲',
    color: '#f59e0b',
    prompt:
      '负责将已验证计划中的定价动作转换为待确认执行步骤和回滚计划，不直接调用生产系统。',
    promptTemplate: 'executor.j2',
    fewShotExamples: [],
    model: 'gpt-5-mini',
    temperature: 0.1,
    topP: 0.8,
    maxTokens: 1600,
    fineTune: '',
    tools: [],
    maxToolCalls: 1,
    retryCount: 1,
    timeoutSeconds: 60,
    batchSize: 10,
    scheduleCron: '',
    triggerEvents: [],
    enabled: true,
    x: 1620,
    y: 60,
  },
  {
    id: 'exec-mkt',
    name: 'Marketing Executor',
    nameEn: 'Executor Marketing',
    kind: 'execution',
    agentType: 'exec_marketing',
    description: '输出营销活动类动作的待确认执行计划。',
    role: '营销执行预览',
    icon: '🎯',
    color: '#f59e0b',
    prompt:
      '负责将营销活动建议转换为平台级执行步骤和回滚计划，不直接下发生产变更。',
    promptTemplate: 'executor.j2',
    fewShotExamples: [],
    model: 'gpt-5-mini',
    temperature: 0.2,
    topP: 0.85,
    maxTokens: 1600,
    fineTune: '',
    tools: [],
    maxToolCalls: 1,
    retryCount: 1,
    timeoutSeconds: 60,
    batchSize: 10,
    scheduleCron: '',
    triggerEvents: [],
    enabled: true,
    x: 1620,
    y: 220,
  },
  {
    id: 'exec-social',
    name: 'Social Executor',
    nameEn: 'Executor Social',
    kind: 'execution',
    agentType: 'exec_social',
    description: '输出社媒发布类动作的待确认执行计划。',
    role: '社媒执行预览',
    icon: '📱',
    color: '#f59e0b',
    prompt:
      '负责将社媒发布建议转换为内容执行步骤和回滚计划，不直接发布到生产平台。',
    promptTemplate: 'executor.j2',
    fewShotExamples: [],
    model: 'gpt-5-mini',
    temperature: 0.3,
    topP: 0.9,
    maxTokens: 1600,
    fineTune: '',
    tools: [],
    maxToolCalls: 1,
    retryCount: 1,
    timeoutSeconds: 60,
    batchSize: 10,
    scheduleCron: '',
    triggerEvents: [],
    enabled: true,
    x: 1620,
    y: 380,
  },
  {
    id: 'exec-review',
    name: 'Reviews Executor',
    nameEn: 'Executor Reviews',
    kind: 'execution',
    agentType: 'exec_reviews',
    description: '输出评论回复类动作的待确认执行计划。',
    role: '评论回复预览',
    icon: '💬',
    color: '#f59e0b',
    prompt:
      '负责将评论回复建议转换为审核后可执行的步骤和回滚计划，不直接发送回复。',
    promptTemplate: 'executor.j2',
    fewShotExamples: [],
    model: 'gpt-5-mini',
    temperature: 0.2,
    topP: 0.85,
    maxTokens: 1600,
    fineTune: '',
    tools: [],
    maxToolCalls: 1,
    retryCount: 1,
    timeoutSeconds: 60,
    batchSize: 10,
    scheduleCron: '',
    triggerEvents: [],
    enabled: true,
    x: 1620,
    y: 540,
  },
];

function cloneDefaultNode(node: AgentSeed & { x: number; y: number }): AgentNode {
  return {
    ...node,
    fewShotExamples: node.fewShotExamples.map((example) => ({ ...example })),
    tools: node.tools.map((tool) => ({ ...tool })),
    triggerEvents: [...node.triggerEvents],
  };
}

export function createDefaultAgentGraph(): AgentGraph {
  return {
    nodes: DEFAULT_AGENT_SEEDS.map(cloneDefaultNode),
    edges: [
      { id: 'e-a-fusion', source: 'agent-a', target: 'agent-fusion' },
      { id: 'e-b-fusion', source: 'agent-b', target: 'agent-fusion' },
      { id: 'e-c-fusion', source: 'agent-c', target: 'agent-fusion' },
      { id: 'e-fusion-plan', source: 'agent-fusion', target: 'agent-plan' },
      { id: 'e-plan-qa', source: 'agent-plan', target: 'agent-qa' },
      { id: 'e-qa-price', source: 'agent-qa', target: 'exec-price' },
      { id: 'e-qa-mkt', source: 'agent-qa', target: 'exec-mkt' },
      { id: 'e-qa-social', source: 'agent-qa', target: 'exec-social' },
      { id: 'e-qa-review', source: 'agent-qa', target: 'exec-review' },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function kindFromAgentType(agentType: string, fallback: AgentKind = 'custom'): AgentKind {
  switch (agentType) {
    case 'collector_ops':
      return 'ops';
    case 'collector_social':
      return 'social';
    case 'collector_macro':
      return 'macro';
    case 'analyzer_fusion':
      return 'analysis';
    case 'planner_strategy':
      return 'planner';
    case 'validator_output':
      return 'validator';
    case 'exec_pricing':
    case 'exec_marketing':
    case 'exec_social':
    case 'exec_reviews':
    case 'exec_scheduling':
    case 'exec_inventory':
      return 'execution';
    default:
      return fallback;
  }
}

export function createAgentNode(kind: AgentKind, index: number): AgentNode {
  const match = DEFAULT_AGENT_SEEDS.find((seed) => seed.kind === kind) ?? DEFAULT_AGENT_SEEDS[0];
  return {
    ...cloneDefaultNode(match),
    id: `agent-${crypto.randomUUID().slice(0, 8)}`,
    name: kind === 'custom' ? 'New Agent' : `${match.name} Copy`,
    x: 160 + index * 36,
    y: 120 + index * 24,
  };
}

export function normalizeAgentGraph(raw: unknown): AgentGraph {
  const fallback = createDefaultAgentGraph();
  if (!raw || typeof raw !== 'object') return fallback;

  const candidate = raw as Partial<AgentGraph> & { nodes?: Array<Partial<AgentNode>>; edges?: Array<Partial<AgentEdge>> };
  const fallbackByKind = new Map(DEFAULT_AGENT_SEEDS.map((seed) => [seed.kind, seed]));
  const fallbackByAgentType = new Map(DEFAULT_AGENT_SEEDS.map((seed) => [seed.agentType, seed]));

  const nodes = Array.isArray(candidate.nodes)
    ? candidate.nodes.map((node, index) => {
        const inferredKind = kindFromAgentType(String(node.agentType ?? ''), (node.kind as AgentKind) || 'custom');
        const seed =
          fallbackByAgentType.get(String(node.agentType ?? '')) ??
          fallbackByKind.get(inferredKind) ??
          DEFAULT_AGENT_SEEDS[0];
        const base = cloneDefaultNode(seed);
        return {
          ...base,
          ...node,
          kind: inferredKind,
          agentType: String(node.agentType ?? base.agentType),
          id: String(node.id ?? `agent-${index}`),
          name: String(node.name ?? base.name),
          nameEn: String(node.nameEn ?? base.nameEn),
          description: String(node.description ?? base.description),
          role: String(node.role ?? base.role),
          icon: String(node.icon ?? base.icon),
          color: String(node.color ?? base.color),
          prompt: String(node.prompt ?? base.prompt),
          promptTemplate: String(node.promptTemplate ?? base.promptTemplate),
          fewShotExamples: Array.isArray(node.fewShotExamples)
            ? node.fewShotExamples.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>
            : base.fewShotExamples,
          model: String(node.model ?? base.model),
          temperature: Number.isFinite(node.temperature) ? Number(node.temperature) : base.temperature,
          topP: Number.isFinite(node.topP) ? Number(node.topP) : base.topP,
          maxTokens: Number.isFinite(node.maxTokens) ? Number(node.maxTokens) : base.maxTokens,
          fineTune: String(node.fineTune ?? base.fineTune),
          tools: Array.isArray(node.tools)
            ? node.tools.map((tool, toolIndex) => {
                const existing = tool && typeof tool === 'object' ? (tool as Partial<AgentTool>) : {};
                const fallbackTool = base.tools[toolIndex] ?? {
                  toolId: `tool-${toolIndex + 1}`,
                  name: 'Tool',
                  endpoint: '',
                  authType: 'none' as const,
                  enabled: true,
                  rateLimit: 60,
                  timeoutSeconds: 30,
                };
                return {
                  toolId: String(existing.toolId ?? fallbackTool.toolId),
                  name: String(existing.name ?? fallbackTool.name),
                  endpoint: String(existing.endpoint ?? fallbackTool.endpoint),
                  authType: (existing.authType as AgentTool['authType']) ?? fallbackTool.authType,
                  enabled: typeof existing.enabled === 'boolean' ? existing.enabled : fallbackTool.enabled,
                  rateLimit: Number.isFinite(existing.rateLimit) ? Number(existing.rateLimit) : fallbackTool.rateLimit,
                  timeoutSeconds: Number.isFinite(existing.timeoutSeconds)
                    ? Number(existing.timeoutSeconds)
                    : fallbackTool.timeoutSeconds,
                };
              })
            : base.tools,
          maxToolCalls: Number.isFinite(node.maxToolCalls) ? Number(node.maxToolCalls) : base.maxToolCalls,
          retryCount: Number.isFinite(node.retryCount) ? Number(node.retryCount) : base.retryCount,
          timeoutSeconds: Number.isFinite(node.timeoutSeconds) ? Number(node.timeoutSeconds) : base.timeoutSeconds,
          batchSize: Number.isFinite(node.batchSize) ? Number(node.batchSize) : base.batchSize,
          scheduleCron: String(node.scheduleCron ?? base.scheduleCron),
          triggerEvents: Array.isArray(node.triggerEvents)
            ? node.triggerEvents.map((item) => String(item)).filter(Boolean)
            : base.triggerEvents,
          enabled: typeof node.enabled === 'boolean' ? node.enabled : base.enabled,
          x: Number.isFinite(node.x) ? Number(node.x) : base.x,
          y: Number.isFinite(node.y) ? Number(node.y) : base.y,
        };
      })
    : fallback.nodes;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(candidate.edges)
    ? candidate.edges
        .filter((edge) => Boolean(edge && typeof edge === 'object'))
        .map((edge, index) => {
          const record = edge as Record<string, unknown>;
          return {
            id: String(record.id ?? `edge-${index}`),
            source: String(record.source ?? ''),
            target: String(record.target ?? ''),
          };
        })
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source && edge.target)
    : fallback.edges;

  return {
    nodes,
    edges,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : fallback.updatedAt,
    savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt : undefined,
    savedBy: typeof candidate.savedBy === 'string' ? candidate.savedBy : undefined,
  };
}
