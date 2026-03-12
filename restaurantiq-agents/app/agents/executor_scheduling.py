from __future__ import annotations

from app.agents.base import BaseAgent
from app.agents.registry import register_agent
from app.agents.executor_pricing import _execution_preview


@register_agent('exec_scheduling')
class ExecutorSchedulingAgent(BaseAgent):
    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        return _execution_preview(input_data, 'scheduling')
