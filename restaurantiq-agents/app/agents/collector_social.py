from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent
from app.models.agent_config import AgentConfig
from app.state.store import StateStore


@register_agent('collector_social')
class CollectorSocialAgent(BaseAgent):
    def __init__(self, config: AgentConfig, state_store: StateStore):
        super().__init__(config, state_store)

    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        snapshot = input_data.get('social_snapshot') or {}
        metrics = snapshot.get('metrics') or [
            {'platform': 'instagram', 'likes': 1800, 'comments': 96, 'followers_delta_pct': 4.2},
            {'platform': 'google_business', 'rating': 4.5, 'reviews_count': 210},
        ]
        comments = snapshot.get('comments') or []
        mentions = snapshot.get('mentions') or []
        negative_comments = [c for c in comments if c.get('sentiment') in {'negative', 'mixed'}]
        return {
            'metrics': metrics,
            'comments': comments,
            'mentions': mentions,
            'signals': {
                'negative_comment_count': len(negative_comments),
                'mention_count': len(mentions),
                'platform_count': len(metrics),
            },
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }
