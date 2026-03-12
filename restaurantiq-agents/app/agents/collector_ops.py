from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent
from app.models.agent_config import AgentConfig
from app.state.store import StateStore


@register_agent('collector_ops')
@register_agent('collector')
class CollectorOpsAgent(BaseAgent):
    def __init__(self, config: AgentConfig, state_store: StateStore):
        super().__init__(config, state_store)

    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        raw_rows = input_data.get('raw_ops_data', [])
        upload_summary = input_data.get('uploaded_documents', [])
        context = input_data.get('_context', {})
        orders = 0
        gross = 0.0
        delivery_mix = 0
        top_items: dict[str, dict[str, float]] = {}
        alerts: list[dict[str, str]] = []

        for row in raw_rows:
            qty = float(row.get('qty', 0) or 0)
            revenue = float(row.get('revenue', row.get('gross_sales', 0)) or 0)
            item_name = str(row.get('item_name', row.get('item', 'unknown')))
            platform = str(row.get('platform', 'dine_in'))
            orders += int(row.get('orders', 1) or 1)
            gross += revenue
            if platform.lower() in {'doordash', 'ubereats', 'grubhub', 'delivery'}:
                delivery_mix += 1
            bucket = top_items.setdefault(item_name, {'qty': 0.0, 'revenue': 0.0})
            bucket['qty'] += qty or 1
            bucket['revenue'] += revenue
            if revenue < 0:
                alerts.append({'type': 'data_quality', 'message': f'{item_name} 存在负营收记录', 'severity': 'medium'})

        if upload_summary and not raw_rows:
            alerts.append({'type': 'manual_upload', 'message': '当前依赖手动上传文件驱动分析', 'severity': 'low'})

        top_items_output = [
            {'name': name, 'qty': round(values['qty'], 2), 'revenue': round(values['revenue'], 2)}
            for name, values in sorted(top_items.items(), key=lambda item: item[1]['revenue'], reverse=True)[:5]
        ]
        return {
            'revenue': {
                'gross': round(gross, 2),
                'net': round(gross * 0.88, 2),
                'tax': round(gross * 0.07, 2),
                'discount': round(gross * 0.05, 2),
            },
            'orders': {
                'total': orders or max(len(raw_rows), len(upload_summary)),
                'by_platform': {
                    'delivery': delivery_mix,
                    'dine_in': max((orders or len(raw_rows)) - delivery_mix, 0),
                },
            },
            'top_items': top_items_output,
            'alerts': alerts,
            'dataset_count': len(upload_summary),
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'restaurant_context': {
                'name': context.get('restaurant_name'),
                'cuisine_type': context.get('cuisine_type'),
                'location': context.get('location'),
            },
        }
