from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent
from app.config import get_settings
from app.llm.openai_json import run_openai_json_schema
from app.models.agent_config import AgentConfig
from app.prompts.loader import render_prompt
from app.state.store import StateStore


def _to_number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value or 0)
    except Exception:
        return default


@register_agent('analyzer_fusion')
@register_agent('analyzer')
class AnalyzerAgent(BaseAgent):
    def __init__(self, config: AgentConfig, state_store: StateStore):
        super().__init__(config, state_store)

    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        upstream = input_data.get('_upstream', {})
        ops = next((value for value in upstream.values() if 'revenue' in value), {})
        social = next((value for value in upstream.values() if 'signals' in value), {})
        macro = next((value for value in upstream.values() if 'macro_summary' in value), {})

        llm_result = await self._maybe_run_openai_analysis(ops, social, macro, input_data.get('_context') or {})
        if llm_result:
            return {
                **llm_result,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'source': 'openai',
            }

        return self._deterministic_analysis(ops, social, macro)

    async def _maybe_run_openai_analysis(
        self,
        ops: dict[str, Any],
        social: dict[str, Any],
        macro: dict[str, Any],
        restaurant_context: dict[str, Any],
    ) -> dict[str, Any] | None:
        settings = get_settings()
        if not settings.openai_api_key:
            return None

        prompt = '\n\n'.join(
            [
                render_prompt(
                    self.config.prompt_template or 'analyzer.j2',
                    restaurant_context=restaurant_context,
                    ops=ops,
                    social=social,
                    macro=macro,
                ),
                'Return JSON only.',
                f'Operations signal: {ops}',
                f'Social signal: {social}',
                f'Macro signal: {macro}',
            ]
        )

        parsed = await run_openai_json_schema(
            prompt=prompt,
            schema_name='restaurantiq_fusion_analysis',
            schema={
                'type': 'object',
                'additionalProperties': False,
                'required': ['summary', 'confidence', 'analysis', 'recommendations'],
                'properties': {
                    'summary': {'type': 'string'},
                    'confidence': {'type': 'number'},
                    'analysis': {
                        'type': 'object',
                        'additionalProperties': False,
                        'required': ['summary', 'health_score', 'health_grade', 'kpis', 'anomalies', 'insights'],
                        'properties': {
                            'summary': {'type': 'string'},
                            'health_score': {'type': 'number'},
                            'health_grade': {'type': 'string'},
                            'kpis': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'additionalProperties': False,
                                    'required': ['id', 'label', 'value', 'delta', 'direction', 'source'],
                                    'properties': {
                                        'id': {'type': 'string'},
                                        'label': {'type': 'string'},
                                        'value': {'type': 'string'},
                                        'delta': {'type': 'string'},
                                        'direction': {'type': 'string'},
                                        'source': {'type': 'string'},
                                    },
                                },
                            },
                            'anomalies': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'additionalProperties': False,
                                    'required': ['id', 'severity', 'title', 'detail'],
                                    'properties': {
                                        'id': {'type': 'string'},
                                        'severity': {'type': 'string'},
                                        'title': {'type': 'string'},
                                        'detail': {'type': 'string'},
                                    },
                                },
                            },
                            'insights': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'additionalProperties': False,
                                    'required': ['id', 'headline', 'detail'],
                                    'properties': {
                                        'id': {'type': 'string'},
                                        'headline': {'type': 'string'},
                                        'detail': {'type': 'string'},
                                    },
                                },
                            },
                        },
                    },
                    'recommendations': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'additionalProperties': False,
                            'required': [
                                'id',
                                'category',
                                'title',
                                'title_zh',
                                'impact_score',
                                'urgency',
                                'risk_level',
                                'description',
                                'expected_outcome',
                            ],
                            'properties': {
                                'id': {'type': 'string'},
                                'category': {'type': 'string'},
                                'title': {'type': 'string'},
                                'title_zh': {'type': 'string'},
                                'impact_score': {'type': 'number'},
                                'urgency': {'type': 'string'},
                                'risk_level': {'type': 'string'},
                                'description': {'type': 'string'},
                                'expected_outcome': {'type': 'string'},
                            },
                        },
                    },
                },
            },
            model=self.config.model,
            max_output_tokens=min(self.config.max_tokens, 3600),
        )

        if not parsed:
            return None

        confidence = parsed.get('confidence', 0.78)
        parsed['confidence'] = self._normalize_confidence(confidence)
        return parsed

    def _deterministic_analysis(
        self,
        ops: dict[str, Any],
        social: dict[str, Any],
        macro: dict[str, Any],
    ) -> dict[str, Any]:
        gross = _to_number(ops.get('revenue', {}).get('gross'))
        orders = int(_to_number(ops.get('orders', {}).get('total')))
        delivery_orders = int(_to_number(ops.get('orders', {}).get('by_platform', {}).get('delivery')))
        delivery_modifier = _to_number(macro.get('macro_summary', {}).get('delivery_modifier_pct'))
        negative_comment_count = int(_to_number(social.get('signals', {}).get('negative_comment_count')))
        mention_count = int(_to_number(social.get('signals', {}).get('mention_count')))
        avg_order_value = gross / orders if orders else 0.0
        delivery_share = (delivery_orders / orders * 100) if orders else 0.0

        anomalies: list[dict[str, Any]] = []
        insights: list[dict[str, Any]] = []
        recommendations: list[dict[str, Any]] = []

        if delivery_modifier >= 10:
            anomalies.append({
                'id': 'anomaly-demand-spike',
                'severity': 'medium',
                'title': '外卖需求可能上升',
                'detail': f'天气/宏观信号预测外卖需求提升约 {int(delivery_modifier)}%。',
            })
            recommendations.append(
                {
                    'id': 'rec_delivery_weather',
                    'category': 'marketing',
                    'title': 'Boost rainy-day delivery bundles',
                    'title_zh': '加推雨天外卖套餐',
                    'impact_score': 82,
                    'urgency': 'immediate',
                    'risk_level': 'low',
                    'description': 'Weather signal suggests higher delivery demand in the next 6 hours.',
                    'expected_outcome': 'Lift delivery conversion during the weather window.',
                }
            )

        if negative_comment_count > 0:
            anomalies.append({
                'id': 'anomaly-review-drag',
                'severity': 'medium',
                'title': '负面评论聚集',
                'detail': f'当前存在 {negative_comment_count} 条负面或混合情绪评论，需要跟进。',
            })
            recommendations.append(
                {
                    'id': 'rec_reviews_recovery',
                    'category': 'operations',
                    'title': 'Investigate recurring review complaints',
                    'title_zh': '排查重复出现的差评问题',
                    'impact_score': 74,
                    'urgency': 'this_week',
                    'risk_level': 'medium',
                    'description': 'Negative or mixed review clusters need operational follow-up.',
                    'expected_outcome': 'Reduce reputation drag and improve review recovery rate.',
                }
            )

        if not recommendations:
            recommendations.append(
                {
                    'id': 'rec_monitoring_only',
                    'category': 'operations',
                    'title': 'Maintain monitoring cadence',
                    'title_zh': '维持监控节奏',
                    'impact_score': 55,
                    'urgency': 'this_week',
                    'risk_level': 'low',
                    'description': 'No strong intervention detected. Keep data collection and monitor trends.',
                    'expected_outcome': 'Preserve operational stability while more signals accumulate.',
                }
            )

        insights.extend(
            [
                {
                    'id': 'insight-ops',
                    'headline': '运营数据已进入融合分析',
                    'detail': f'当前已识别 gross=${gross:,.2f}，订单 {orders} 单，平均客单 ${avg_order_value:,.2f}。',
                },
                {
                    'id': 'insight-social',
                    'headline': '社媒与口碑信号已纳入',
                    'detail': f'当前识别 {mention_count} 条提及，{negative_comment_count} 条需关注评论。',
                },
                {
                    'id': 'insight-macro',
                    'headline': '宏观因子已纳入',
                    'detail': f'当前宏观模型给出的 delivery demand modifier 为 {int(delivery_modifier)}%。',
                },
            ]
        )

        health_score = max(45.0, min(92.0, 74.0 + delivery_modifier * 0.3 - negative_comment_count * 4))
        health_grade = 'A' if health_score >= 85 else 'B' if health_score >= 72 else 'C'
        summary = f'营业、社媒和宏观信号已融合；当前重点是{"需求捕获" if delivery_modifier >= 10 else "稳定经营"}与{"评论修复" if negative_comment_count else "节奏维持"}。'

        return {
            'summary': summary,
            'analysis': {
                'summary': summary,
                'health_score': round(health_score, 1),
                'health_grade': health_grade,
                'kpis': [
                    {
                        'id': 'gross_revenue',
                        'label': 'Gross Revenue',
                        'value': f'${gross:,.0f}',
                        'delta': f'{delivery_share:.0f}% delivery share',
                        'direction': 'up' if gross > 0 else 'flat',
                        'source': 'ops',
                    },
                    {
                        'id': 'order_volume',
                        'label': 'Orders',
                        'value': str(orders),
                        'delta': f'{delivery_orders} delivery',
                        'direction': 'up' if orders > 0 else 'flat',
                        'source': 'ops',
                    },
                    {
                        'id': 'review_risk',
                        'label': 'Review Risk',
                        'value': str(negative_comment_count),
                        'delta': f'{mention_count} mentions',
                        'direction': 'down' if negative_comment_count else 'flat',
                        'source': 'social',
                    },
                    {
                        'id': 'macro_delivery_modifier',
                        'label': 'Demand Modifier',
                        'value': f'{int(delivery_modifier)}%',
                        'delta': 'weather + local context',
                        'direction': 'up' if delivery_modifier >= 0 else 'down',
                        'source': 'macro',
                    },
                ],
                'anomalies': anomalies,
                'insights': insights,
            },
            'recommendations': recommendations,
            'confidence': 0.78,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'source': 'deterministic',
        }

    def _normalize_confidence(self, confidence: Any) -> float:
        if isinstance(confidence, (int, float)):
            return max(0.0, min(float(confidence if confidence <= 1 else confidence / 100), 1.0))
        return 0.78
