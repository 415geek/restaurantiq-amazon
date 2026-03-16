'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, RotateCcw, Bot, Workflow, Link2, ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/hooks/useToast';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';
import {
  AGENT_GRAPH_STORAGE_KEY,
  MODEL_OPTIONS,
  normalizeAgentGraph,
  createAgentNode,
  createDefaultAgentGraph,
  type AgentEdge,
  type AgentGraph,
  type AgentKind,
  type AgentNode,
  type AgentTool,
} from '@/lib/agent-management';
import { appEnv } from '@/lib/env';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 190;

const KIND_STYLES: Record<AgentKind, string> = {
  ops: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  social: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200',
  macro: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  analysis: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  planner: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  validator: 'border-lime-500/30 bg-lime-500/10 text-lime-200',
  execution: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
  custom: 'border-zinc-600 bg-zinc-800/80 text-zinc-200',
};

const KIND_OPTIONS: AgentKind[] = ['ops', 'social', 'macro', 'analysis', 'planner', 'validator', 'execution', 'custom'];

function loadGraph(): AgentGraph {
  if (typeof window === 'undefined') return createDefaultAgentGraph();
  const raw = window.localStorage.getItem(AGENT_GRAPH_STORAGE_KEY);
  if (!raw) return createDefaultAgentGraph();
  try {
    return normalizeAgentGraph(JSON.parse(raw));
  } catch {
    return createDefaultAgentGraph();
  }
}

function saveGraph(graph: AgentGraph) {
  window.localStorage.setItem(AGENT_GRAPH_STORAGE_KEY, JSON.stringify(graph));
}

async function fetchServerGraph() {
  const response = await fetch('/api/agent-management/graph', { cache: 'no-store', credentials: 'include' });
  if (!response.ok) {
    let reason = '';
    try {
      const body = (await response.json()) as { reason?: string };
      reason = body.reason ? `_${body.reason}` : '';
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(`graph_load_failed_${response.status}${reason}`);
  }
  return normalizeAgentGraph(await response.json());
}

async function saveServerGraph(graph: AgentGraph) {
  const response = await fetch('/api/agent-management/graph', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(graph),
    credentials: 'include',
  });
  if (!response.ok) {
    let reason = '';
    try {
      const body = (await response.json()) as { reason?: string; error?: string };
      reason = body.reason || body.error ? `_${body.reason ?? body.error}` : '';
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(`graph_save_failed_${response.status}${reason}`);
  }
  return normalizeAgentGraph(await response.json());
}

function parseJsonArray<T>(value: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function serializePretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseTriggerEvents(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function midpoint(node: AgentNode, side: 'left' | 'right') {
  return {
    x: side === 'left' ? node.x : node.x + NODE_WIDTH,
    y: node.y + NODE_HEIGHT / 2,
  };
}

function edgePath(source: AgentNode, target: AgentNode) {
  const start = midpoint(source, 'right');
  const end = midpoint(target, 'left');
  const curve = Math.max(80, Math.abs(end.x - start.x) * 0.4);
  return `M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`;
}

export function AgentManagementClient() {
  const { lang } = useDashboardLanguage();
  const toast = useToast();
  const initialGraph = useMemo(() => createDefaultAgentGraph(), []);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [graph, setGraph] = useState<AgentGraph>(initialGraph);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialGraph.nodes[0]?.id ?? '');
  const [isServerBacked, setIsServerBacked] = useState(false);
  const [loadingServerGraph, setLoadingServerGraph] = useState(true);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    async function loadInitialGraph() {
      try {
        const onAgentStudioHost = window.location.hostname === appEnv.agentStudioHost;
        if (onAgentStudioHost) {
          const serverGraph = await fetchServerGraph();
          if (cancelled) return;
          setGraph(serverGraph);
          setSelectedNodeId(serverGraph.nodes[0]?.id ?? '');
          setIsServerBacked(true);
          saveGraph(serverGraph);
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'graph_load_failed';
        toast.info(
          lang === 'zh'
            ? `服务端配置加载失败，已退回本地草稿。原因：${message}`
            : `Server graph unavailable; using local draft. Reason: ${message}`
        );
      } finally {
        if (!cancelled) setLoadingServerGraph(false);
      }

      const localGraph = loadGraph();
      if (cancelled) return;
      setGraph(localGraph);
      setSelectedNodeId(localGraph.nodes[0]?.id ?? '');
    }

    loadInitialGraph();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const nextPointer = {
        x: event.clientX - rect.left + canvas.scrollLeft,
        y: event.clientY - rect.top + canvas.scrollTop,
      };
      setPointer(nextPointer);

      if (!draggingNodeId) return;
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === draggingNodeId
            ? {
                ...node,
                x: Math.max(16, nextPointer.x - dragOffset.x),
                y: Math.max(16, nextPointer.y - dragOffset.y),
              }
            : node
        ),
        updatedAt: new Date().toISOString(),
      }));
    }

    function onMouseUp() {
      if (draggingNodeId) setDraggingNodeId(null);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggingNodeId, dragOffset]);

  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0],
    [graph.nodes, selectedNodeId]
  );

  const saveCurrentGraph = async () => {
    try {
      const nextGraph = isServerBacked ? await saveServerGraph(graph) : graph;
      saveGraph(nextGraph);
      if (isServerBacked) setGraph(nextGraph);
      toast.success(
        lang === 'zh'
          ? isServerBacked
            ? 'Agent 编排配置已保存到服务端。'
            : 'Agent 编排配置已保存到本地。'
          : isServerBacked
            ? 'Agent orchestration graph saved to server.'
            : 'Agent orchestration graph saved locally.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'graph_save_failed';
      if (isServerBacked) {
        saveGraph(graph);
        setIsServerBacked(false);
        toast.error(
          lang === 'zh'
            ? `服务端保存失败，已退回本地草稿。原因：${message}`
            : `Server save failed; switched to local draft. Reason: ${message}`
        );
        return;
      }
      toast.error(lang === 'zh' ? `保存失败：${message}` : `Failed to save graph: ${message}`);
    }
  };

  const resetGraph = () => {
    const next = createDefaultAgentGraph();
    setGraph(next);
    setSelectedNodeId(next.nodes[0].id);
    saveGraph(next);
    toast.info(lang === 'zh' ? '已恢复默认 Agent 编排。' : 'Restored default agent orchestration graph.');
  };

  const addNode = () => {
    const nextNode = createAgentNode('custom', graph.nodes.length + 1);
    const nextGraph = {
      ...graph,
      nodes: [...graph.nodes, nextNode],
      updatedAt: new Date().toISOString(),
    };
    setGraph(nextGraph);
    setSelectedNodeId(nextNode.id);
  };

  const updateSelectedNode = (patch: Partial<AgentNode>) => {
    if (!selectedNode) return;
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => (node.id === selectedNode.id ? { ...node, ...patch } : node)),
      updatedAt: new Date().toISOString(),
    }));
  };

  const removeSelectedNode = () => {
    if (!selectedNode) return;
    const nextNodes = graph.nodes.filter((node) => node.id !== selectedNode.id);
    const nextEdges = graph.edges.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id);
    const nextGraph = {
      ...graph,
      nodes: nextNodes,
      edges: nextEdges,
      updatedAt: new Date().toISOString(),
    };
    setGraph(nextGraph);
    setSelectedNodeId(nextNodes[0]?.id ?? '');
  };

  const onNodeHeaderMouseDown = (node: AgentNode, event: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setDraggingNodeId(node.id);
    setDragOffset({
      x: event.clientX - rect.left + canvas.scrollLeft - node.x,
      y: event.clientY - rect.top + canvas.scrollTop - node.y,
    });
  };

  const completeConnection = (targetId: string) => {
    if (!connectingFrom || connectingFrom === targetId) {
      setConnectingFrom(null);
      return;
    }

    const edgeId = `edge-${connectingFrom}-${targetId}`;
    setGraph((prev) => {
      const exists = prev.edges.some((edge) => edge.source === connectingFrom && edge.target === targetId);
      if (exists) return prev;
      return {
        ...prev,
        edges: [...prev.edges, { id: edgeId, source: connectingFrom, target: targetId }],
        updatedAt: new Date().toISOString(),
      };
    });
    setConnectingFrom(null);
  };

  const disconnectEdge = (edgeId: string) => {
    setGraph((prev) => ({
      ...prev,
      edges: prev.edges.filter((edge) => edge.id !== edgeId),
      updatedAt: new Date().toISOString(),
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === 'zh' ? 'Agent 管理控制台' : 'Agent Management Dashboard'}
        description={
          lang === 'zh'
            ? '通过拖拽、连线和参数面板管理多 Agent orchestration。当前配置会写入共享服务端 graph，并同步到 Python orchestrator。'
            : 'Manage the multi-agent orchestration layer with drag, connect, and parameter controls. Graph changes sync to the shared server state and Python orchestrator.'
        }
        badge={lang === 'zh' ? '可视化编排' : 'Visual Orchestration'}
        actions={
          <>
            <Button variant="secondary" onClick={resetGraph}>
              <RotateCcw className="h-4 w-4" />
              {lang === 'zh' ? '恢复默认' : 'Reset'}
            </Button>
            <Button variant="secondary" onClick={addNode}>
              <Plus className="h-4 w-4" />
              {lang === 'zh' ? '新增 Agent' : 'Add Agent'}
            </Button>
            <Button onClick={saveCurrentGraph}>
              <Save className="h-4 w-4" />
              {lang === 'zh' ? '保存配置' : 'Save graph'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="h-4 w-4 text-orange-300" />
                {lang === 'zh' ? 'Agent 编排画布' : 'Agent Orchestration Canvas'}
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="rounded-full border border-zinc-800 bg-zinc-900/70 px-2 py-1">
                {isServerBacked
                  ? (lang === 'zh' ? '当前存储：服务端共享配置' : 'Storage: shared server graph')
                  : (lang === 'zh' ? '当前存储：本地浏览器草稿' : 'Storage: local browser draft')}
              </span>
              {loadingServerGraph ? (
                <span className="rounded-full border border-zinc-800 bg-zinc-900/70 px-2 py-1">
                  {lang === 'zh' ? '正在同步服务端配置…' : 'Syncing server graph…'}
                </span>
              ) : null}
            </div>
            <div
              ref={canvasRef}
              className="relative h-[760px] overflow-auto rounded-2xl border border-zinc-800 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:24px_24px]"
            >
              <div className="relative h-[1200px] min-w-[1200px]">
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                  {graph.edges.map((edge) => {
                    const source = graph.nodes.find((node) => node.id === edge.source);
                    const target = graph.nodes.find((node) => node.id === edge.target);
                    if (!source || !target) return null;
                    return (
                      <g key={edge.id}>
                        <path d={edgePath(source, target)} fill="none" stroke="rgba(242,106,54,0.7)" strokeWidth="3" />
                      </g>
                    );
                  })}
                  {connectingFrom ? (() => {
                    const source = graph.nodes.find((node) => node.id === connectingFrom);
                    if (!source) return null;
                    const start = midpoint(source, 'right');
                    const curve = 120;
                    return (
                      <path
                        d={`M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${pointer.x - curve} ${pointer.y}, ${pointer.x} ${pointer.y}`}
                        fill="none"
                        stroke="rgba(247,162,127,0.8)"
                        strokeDasharray="8 8"
                        strokeWidth="3"
                      />
                    );
                  })() : null}
                </svg>

                {graph.nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`absolute rounded-2xl border bg-zinc-950/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] ${
                      selectedNodeId === node.id ? 'border-orange-500/50' : 'border-zinc-800'
                    }`}
                    style={{ left: node.x, top: node.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
                    onMouseUp={() => completeConnection(node.id)}
                    onClick={() => setSelectedNodeId(node.id)}
                  >
                    <div
                      className="cursor-move rounded-t-2xl border-b border-zinc-800 bg-zinc-900/80 p-3"
                      onMouseDown={(event) => onNodeHeaderMouseDown(node, event)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span className="text-lg">{node.icon}</span>
                          <div>
                            <div className="text-sm font-semibold text-zinc-100">{node.name}</div>
                            <div className="mt-1 text-xs text-zinc-400">{node.role}</div>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${KIND_STYLES[node.kind]}`}>
                          {node.kind}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3 p-3">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>{lang === 'zh' ? '模型' : 'Model'}</span>
                        <span className="text-zinc-200">{node.model}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>{lang === 'zh' ? '温度 / Top P' : 'Temp / Top P'}</span>
                        <span className="text-zinc-200">
                          {node.temperature.toFixed(2)} / {node.topP.toFixed(2)}
                        </span>
                      </div>
                      <p className="line-clamp-4 text-xs text-zinc-400">{node.prompt}</p>
                    </div>
                    <button
                      type="button"
                      className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300"
                      onMouseUp={() => completeConnection(node.id)}
                      aria-label="target handle"
                    />
                    <button
                      type="button"
                      className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-orange-500/40 bg-orange-500/20 text-orange-200"
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        setSelectedNodeId(node.id);
                        setConnectingFrom(node.id);
                      }}
                      aria-label="source handle"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <StatusCard
                icon={<Bot className="h-4 w-4" />}
                label={lang === 'zh' ? 'Agent 数量' : 'Agents'}
                value={String(graph.nodes.length)}
              />
              <StatusCard
                icon={<Link2 className="h-4 w-4" />}
                label={lang === 'zh' ? '连线数量' : 'Connections'}
                value={String(graph.edges.length)}
              />
              <StatusCard
                icon={<ShieldCheck className="h-4 w-4" />}
                label={lang === 'zh' ? '上次保存' : 'Last saved'}
                value={new Date(graph.updatedAt).toLocaleString()}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-orange-300" />
                {lang === 'zh' ? 'Agent 配置面板' : 'Agent Configuration'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedNode ? (
                <>
                  <Field label={lang === 'zh' ? 'Agent 名称' : 'Agent name'}>
                    <Input value={selectedNode.name} onChange={(e) => updateSelectedNode({ name: e.target.value })} />
                  </Field>
                  <Field label={lang === 'zh' ? '英文名称' : 'English name'}>
                    <Input value={selectedNode.nameEn} onChange={(e) => updateSelectedNode({ nameEn: e.target.value })} />
                  </Field>
                  <Field label={lang === 'zh' ? '职责' : 'Role'}>
                    <Input value={selectedNode.role} onChange={(e) => updateSelectedNode({ role: e.target.value })} />
                  </Field>
                  <Field label={lang === 'zh' ? '说明' : 'Description'}>
                    <Input
                      value={selectedNode.description}
                      onChange={(e) => updateSelectedNode({ description: e.target.value })}
                    />
                  </Field>
                  <Field label={lang === 'zh' ? '类型' : 'Kind'}>
                    <Select value={selectedNode.kind} onChange={(e) => updateSelectedNode({ kind: e.target.value as AgentKind })}>
                      {KIND_OPTIONS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={lang === 'zh' ? 'Agent 类型标识' : 'Agent type id'}>
                      <Input
                        value={selectedNode.agentType}
                        onChange={(e) => updateSelectedNode({ agentType: e.target.value })}
                      />
                    </Field>
                    <Field label={lang === 'zh' ? '图标' : 'Icon'}>
                      <Input value={selectedNode.icon} onChange={(e) => updateSelectedNode({ icon: e.target.value })} />
                    </Field>
                  </div>
                  <Field label={lang === 'zh' ? '颜色' : 'Color'}>
                    <Input value={selectedNode.color} onChange={(e) => updateSelectedNode({ color: e.target.value })} />
                  </Field>
                  <Field label={lang === 'zh' ? '使用模型' : 'LLM model'}>
                    <Select value={selectedNode.model} onChange={(e) => updateSelectedNode({ model: e.target.value })}>
                      {MODEL_OPTIONS.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="temperature">
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="2"
                        value={selectedNode.temperature}
                        onChange={(e) => updateSelectedNode({ temperature: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <Field label="top_p">
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={selectedNode.topP}
                        onChange={(e) => updateSelectedNode({ topP: Number(e.target.value) || 0 })}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="max_tokens">
                      <Input
                        type="number"
                        step="128"
                        min="256"
                        max="16384"
                        value={selectedNode.maxTokens}
                        onChange={(e) => updateSelectedNode({ maxTokens: Number(e.target.value) || 1024 })}
                      />
                    </Field>
                    <Field label="max_tool_calls">
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        value={selectedNode.maxToolCalls}
                        onChange={(e) => updateSelectedNode({ maxToolCalls: Number(e.target.value) || 0 })}
                      />
                    </Field>
                  </div>
                  <Field label={lang === 'zh' ? 'Fine-tune / 版本' : 'Fine-tune / variant'}>
                    <Input value={selectedNode.fineTune} onChange={(e) => updateSelectedNode({ fineTune: e.target.value })} />
                  </Field>
                  <Field label={lang === 'zh' ? '提示词模板文件' : 'Prompt template'}>
                    <Input
                      value={selectedNode.promptTemplate}
                      onChange={(e) => updateSelectedNode({ promptTemplate: e.target.value })}
                    />
                  </Field>
                  <Field label={lang === 'zh' ? '系统提示词' : 'System prompt'}>
                    <textarea
                      className="min-h-40 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-orange-500/40"
                      value={selectedNode.prompt}
                      onChange={(e) => updateSelectedNode({ prompt: e.target.value })}
                    />
                  </Field>
                  <Field label={lang === 'zh' ? 'Few-shot 示例（JSON 数组）' : 'Few-shot examples (JSON array)'}>
                    <textarea
                      className="min-h-28 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100 outline-none transition focus:border-orange-500/40"
                      value={serializePretty(selectedNode.fewShotExamples)}
                      onChange={(e) =>
                        updateSelectedNode({
                          fewShotExamples: parseJsonArray<Record<string, unknown>>(e.target.value, selectedNode.fewShotExamples),
                        })
                      }
                    />
                  </Field>
                  <Field label={lang === 'zh' ? '工具配置（JSON 数组）' : 'Tools (JSON array)'}>
                    <textarea
                      className="min-h-28 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-mono text-zinc-100 outline-none transition focus:border-orange-500/40"
                      value={serializePretty(selectedNode.tools)}
                      onChange={(e) =>
                        updateSelectedNode({
                          tools: parseJsonArray<AgentTool>(e.target.value, selectedNode.tools),
                        })
                      }
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label={lang === 'zh' ? '重试次数' : 'Retry count'}>
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        value={selectedNode.retryCount}
                        onChange={(e) => updateSelectedNode({ retryCount: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <Field label={lang === 'zh' ? '超时(秒)' : 'Timeout (sec)'}>
                      <Input
                        type="number"
                        min="5"
                        max="300"
                        value={selectedNode.timeoutSeconds}
                        onChange={(e) => updateSelectedNode({ timeoutSeconds: Number(e.target.value) || 30 })}
                      />
                    </Field>
                    <Field label={lang === 'zh' ? '批大小' : 'Batch size'}>
                      <Input
                        type="number"
                        min="1"
                        max="500"
                        value={selectedNode.batchSize}
                        onChange={(e) => updateSelectedNode({ batchSize: Number(e.target.value) || 1 })}
                      />
                    </Field>
                  </div>
                  <Field label={lang === 'zh' ? 'Cron 调度' : 'Schedule cron'}>
                    <Input
                      value={selectedNode.scheduleCron}
                      onChange={(e) => updateSelectedNode({ scheduleCron: e.target.value })}
                    />
                  </Field>
                  <Field label={lang === 'zh' ? '触发事件（逗号分隔）' : 'Trigger events (comma separated)'}>
                    <Input
                      value={selectedNode.triggerEvents.join(', ')}
                      onChange={(e) => updateSelectedNode({ triggerEvents: parseTriggerEvents(e.target.value) })}
                    />
                  </Field>
                  <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-3">
                    <div>
                      <div className="text-sm text-zinc-100">{lang === 'zh' ? '启用该 Agent' : 'Enable agent'}</div>
                      <div className="text-xs text-zinc-400">
                        {lang === 'zh' ? '关闭后仍保留节点，但不会进入编排运行。' : 'Disabled agents remain on canvas but will be skipped by orchestration.'}
                      </div>
                    </div>
                    <Switch checked={selectedNode.enabled} onCheckedChange={(checked) => updateSelectedNode({ enabled: checked })} />
                  </div>
                  <Button variant="ghost" onClick={removeSelectedNode} className="w-full">
                    {lang === 'zh' ? '删除当前 Agent' : 'Delete selected agent'}
                  </Button>
                </>
              ) : (
                <div className="text-sm text-zinc-400">{lang === 'zh' ? '请选择一个 Agent 节点。' : 'Select an agent node.'}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{lang === 'zh' ? '当前连线逻辑' : 'Current edges'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {graph.edges.length ? (
                graph.edges.map((edge) => (
                  <div key={edge.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm">
                    <span className="text-zinc-300">
                      {graph.nodes.find((node) => node.id === edge.source)?.name} → {graph.nodes.find((node) => node.id === edge.target)?.name}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-zinc-500 hover:text-red-300"
                      onClick={() => disconnectEdge(edge.id)}
                    >
                      {lang === 'zh' ? '移除' : 'Remove'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-sm text-zinc-400">
                  {lang === 'zh'
                    ? '从任意节点右侧拖动到另一个节点，即可建立依赖链路。'
                    : 'Drag from the right handle of one node to another node to create a dependency edge.'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-zinc-300">{label}</span>
      {children}
    </label>
  );
}

function StatusCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-sm text-zinc-100">{value}</div>
    </div>
  );
}
