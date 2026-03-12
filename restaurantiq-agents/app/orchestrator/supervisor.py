from __future__ import annotations

import json
from typing import Any

from app.config import get_settings
from app.llm.openai_json import run_openai_json_schema
from app.models.agent_config import PipelineConfig
from app.orchestrator.dag_pipeline import DAGPipeline
from app.orchestrator.router import RequestRouter


class SupervisorAgent:
    """顶层编排器：路由、裁剪活跃 DAG、执行并汇总。"""

    def __init__(self, pipeline: DAGPipeline, router: RequestRouter):
        self._pipeline = pipeline
        self._router = router

    async def handle_request(
        self,
        request: str,
        pipeline_config: PipelineConfig,
        restaurant_context: dict[str, Any] | None = None,
        initial_input: dict[str, Any] | None = None,
        emit_event=None,
    ) -> dict[str, Any]:
        route_plan = await self._plan_route(request, pipeline_config, restaurant_context)
        active_edges = route_plan['active_edges']
        results = await self._pipeline.execute(
            edges=active_edges,
            initial_input={**(initial_input or {}), 'request': request},
            restaurant_context=restaurant_context,
            emit_event=emit_event,
        )
        return {
            'plan': {
                'activated_agents': route_plan['activated_agents'],
                'execution_order': self._derive_execution_order(active_edges),
                'reasoning': route_plan['reasoning'],
            },
            'results': {key: value for key, value in results.items() if not key.startswith('_')},
        }

    async def _plan_route(
        self,
        request: str,
        pipeline_config: PipelineConfig,
        restaurant_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        deterministic_plan = self._router.route(request, pipeline_config)
        settings = get_settings()
        if not settings.openai_api_key:
            return deterministic_plan

        allowed_agents = {agent.agent_id: agent for agent in pipeline_config.agents if agent.enabled}
        agent_catalog = [
            {
                'agent_id': agent.agent_id,
                'name': agent.name,
                'role': agent.role.value,
                'agent_type': agent.agent_type,
                'model': agent.model,
            }
            for agent in allowed_agents.values()
        ]

        prompt = '\n'.join(
            [
                'You are the RestaurantIQ Supervisor planner.',
                'Select the smallest useful set of enabled agents for the request.',
                'Respect the existing DAG. Do not invent agent ids.',
                'Prefer collector + analyzer paths for analysis requests.',
                'Prefer executor nodes only when the request is explicitly about execution planning.',
                f'Request: {request}',
                f'Restaurant context: {json.dumps(restaurant_context or {}, ensure_ascii=False)}',
                f'Agents: {json.dumps(agent_catalog, ensure_ascii=False)}',
                f'Edges: {json.dumps(pipeline_config.edges, ensure_ascii=False)}',
                f'Deterministic fallback plan: {json.dumps(deterministic_plan, ensure_ascii=False)}',
            ]
        )

        planned = await run_openai_json_schema(
            prompt=prompt,
            schema_name='supervisor_route_plan',
            schema={
                'type': 'object',
                'additionalProperties': False,
                'required': ['activated_agents', 'reasoning'],
                'properties': {
                    'activated_agents': {
                        'type': 'array',
                        'items': {'type': 'string'},
                    },
                    'reasoning': {'type': 'string'},
                },
            },
            model=settings.default_model_balanced,
            max_output_tokens=1000,
        )

        if not planned:
            return deterministic_plan

        activated_agents = [agent_id for agent_id in planned.get('activated_agents', []) if agent_id in allowed_agents]
        if not activated_agents:
            return deterministic_plan

        activated_set = set(activated_agents)
        active_edges = [(src, dst) for src, dst in pipeline_config.edges if src in activated_set and dst in activated_set]
        return {
            'activated_agents': activated_agents,
            'active_edges': active_edges,
            'reasoning': planned.get('reasoning') or deterministic_plan['reasoning'],
        }

    def _derive_execution_order(self, edges: list[tuple[str, str]]) -> list[list[str]]:
        if not edges:
            return []
        parents = {src for src, _ in edges}
        children = {dst for _, dst in edges}
        roots = sorted(parents - children)
        second = sorted(children & parents)
        leaves = sorted(children - parents)
        order = [roots]
        if second:
            order.append(second)
        if leaves and leaves != second:
            order.append(leaves)
        return [layer for layer in order if layer]
