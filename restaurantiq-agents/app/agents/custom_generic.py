from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent


@register_agent('custom_generic')
@register_agent('custom')
class CustomGenericAgent(BaseAgent):
    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        upstream = input_data.get('_upstream', {})
        return {
            'status': 'custom_node_executed',
            'received_upstream_agents': list(upstream.keys()),
            'echo': {
                'request': input_data.get('request'),
                'context_keys': sorted((input_data.get('_context') or {}).keys()),
            },
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }
