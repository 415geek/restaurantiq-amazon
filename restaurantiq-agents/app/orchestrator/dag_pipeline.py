from __future__ import annotations

import asyncio
import logging
from collections import defaultdict, deque
from typing import Any, Awaitable, Callable

from app.agents.registry import AgentRegistry

logger = logging.getLogger(__name__)

EventEmitter = Callable[[dict[str, Any]], Awaitable[None]] | None


class DAGPipeline:
    """按拓扑层级执行 Agent DAG，同层并行。"""

    def __init__(self, registry: AgentRegistry):
        self._registry = registry

    async def execute(
        self,
        edges: list[tuple[str, str]],
        initial_input: dict[str, Any],
        restaurant_context: dict[str, Any] | None = None,
        emit_event: EventEmitter = None,
    ) -> dict[str, Any]:
        graph: dict[str, list[str]] = defaultdict(list)
        in_degree: dict[str, int] = defaultdict(int)
        all_nodes: set[str] = set()

        for src, dst in edges:
            graph[src].append(dst)
            in_degree[dst] += 1
            all_nodes.update([src, dst])
        for node in all_nodes:
            in_degree.setdefault(node, 0)

        layers: list[list[str]] = []
        queue = deque([node for node in all_nodes if in_degree[node] == 0])
        while queue:
            layer = list(queue)
            layers.append(layer)
            next_queue: deque[str] = deque()
            for node in layer:
                for neighbor in graph[node]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        next_queue.append(neighbor)
            queue = next_queue

        executed_nodes = sum(len(layer) for layer in layers)
        if executed_nodes != len(all_nodes):
            raise ValueError('DAG 中检测到循环依赖')

        results: dict[str, Any] = {'_initial': initial_input}
        if restaurant_context:
            results['_context'] = restaurant_context

        for layer_index, layer in enumerate(layers):
            if emit_event:
                await emit_event({'type': 'layer_start', 'layer': layer_index, 'agents': layer})
            tasks = []
            agent_ids = []
            for agent_id in layer:
                agent = self._registry.get_agent(agent_id)
                if agent is None:
                    logger.warning('Agent %s 未注册，跳过', agent_id)
                    continue
                agent_ids.append(agent_id)
                agent_input = {
                    **initial_input,
                    '_upstream': {src: results.get(src, {}) for src, dst in edges if dst == agent_id},
                }
                if restaurant_context:
                    agent_input['_context'] = restaurant_context
                tasks.append(self._run_agent(agent_id, agent, agent_input, emit_event))
            layer_results = await asyncio.gather(*tasks, return_exceptions=True)
            for agent_id, result in zip(agent_ids, layer_results):
                results[agent_id] = {'error': str(result)} if isinstance(result, Exception) else result
            if emit_event:
                await emit_event({'type': 'layer_complete', 'layer': layer_index, 'agents': layer})
        return results

    async def _run_agent(self, agent_id: str, agent: Any, input_data: dict[str, Any], emit_event: EventEmitter) -> dict[str, Any]:
        if emit_event:
            await emit_event({'type': 'agent_start', 'agent_id': agent_id, 'name': agent.name})
        result = await agent.run(input_data)
        if emit_event:
            await emit_event({'type': 'agent_complete', 'agent_id': agent_id, 'name': agent.name, 'status': 'ok' if 'error' not in result else 'error'})
        return result
