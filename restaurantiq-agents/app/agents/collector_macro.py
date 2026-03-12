from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent
from app.models.agent_config import AgentConfig
from app.state.store import StateStore


@register_agent('collector_macro')
class CollectorMacroAgent(BaseAgent):
    def __init__(self, config: AgentConfig, state_store: StateStore):
        super().__init__(config, state_store)

    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        snapshot = input_data.get('macro_snapshot') or {}
        weather = snapshot.get('weather') or {
            'condition': 'rain',
            'temp_c': 11,
            'delivery_modifier_pct': 18,
        }
        events = snapshot.get('events') or []
        news = snapshot.get('news') or []
        return {
            'weather': weather,
            'events': events,
            'news': news,
            'macro_summary': {
                'event_count': len(events),
                'news_count': len(news),
                'delivery_modifier_pct': weather.get('delivery_modifier_pct', 0),
            },
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }
