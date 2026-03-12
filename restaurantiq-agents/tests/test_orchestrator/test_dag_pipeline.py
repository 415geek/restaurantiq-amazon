from __future__ import annotations

import pytest

from app.agents.base import BaseAgent
from app.agents.registry import AgentRegistry, register_agent
from app.models.agent_config import AgentConfig, AgentRole
from app.orchestrator.dag_pipeline import DAGPipeline
from app.state.store import StateStore


@register_agent('test_a')
class TestAgent(BaseAgent):
    async def execute(self, input_data: dict):
        return {'request': input_data['request'], 'upstream_keys': sorted(input_data.get('_upstream', {}).keys())}


@pytest.mark.asyncio
async def test_dag_pipeline_executes_topologically():
    store = StateStore()
    registry = AgentRegistry(store)
    registry.create_agent(AgentConfig(agent_id='a', name='A', role=AgentRole.COLLECTOR, agent_type='test_a'))
    registry.create_agent(AgentConfig(agent_id='b', name='B', role=AgentRole.ANALYZER, agent_type='test_a'))
    pipeline = DAGPipeline(registry)

    result = await pipeline.execute([('a', 'b')], {'request': 'test'})
    assert result['a']['request'] == 'test'
    assert result['b']['upstream_keys'] == ['a']
