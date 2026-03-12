from __future__ import annotations

from typing import Any

from app.agents.base import BaseAgent
from app.agents.executor_pricing import _execution_preview
from app.agents.registry import register_agent


@register_agent('execution_planner')
@register_agent('executor')
class ExecutionPlannerAgent(BaseAgent):
    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        return _execution_preview(input_data, 'generic_execution')
