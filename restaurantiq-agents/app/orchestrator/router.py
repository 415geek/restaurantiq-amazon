from __future__ import annotations

from typing import Any

from app.models.agent_config import PipelineConfig


class RequestRouter:
    """基于规则的轻量路由器，供 Supervisor 先做 deterministic gating。"""

    def route(self, request_text: str, pipeline: PipelineConfig) -> dict[str, Any]:
        text = request_text.lower()
        base_chain = {'fusion', 'planner', 'validator'}
        activated = set(base_chain)
        reasoning: list[str] = ['默认激活融合分析、策略规划和 QA 校验链路，统一生成可执行计划。']

        if any(token in text for token in ['upload', 'pos', 'delivery', '运营', 'sales', 'orders']):
            activated.add('ops')
            reasoning.append('请求涉及运营/POS/外卖数据，激活 Agent A。')
        if any(token in text for token in ['social', 'instagram', 'facebook', 'review', '评论', '社媒']):
            activated.add('social')
            reasoning.append('请求涉及社媒/评论数据，激活 Agent B。')
        if any(token in text for token in ['weather', 'holiday', 'news', 'traffic', '天气', '节假日', '宏观']):
            activated.add('macro')
            reasoning.append('请求涉及宏观影响因子，激活 Agent C。')
        if activated == base_chain:
            activated.update({'ops', 'social', 'macro'})
            reasoning.append('请求未指向单一数据域，默认启用 A/B/C 并行采集。')

        if any(token in text for token in ['pricing', 'price', '定价']):
            activated.add('exec_price')
            reasoning.append('涉及定价执行预览，追加价格 Executor。')
        if any(token in text for token in ['campaign', 'promo', 'marketing', '营销']):
            activated.add('exec_mkt')
            reasoning.append('涉及营销执行预览，追加营销 Executor。')
        if any(token in text for token in ['reply', 'review response', '回复']):
            activated.add('exec_review')
            reasoning.append('涉及评论回复预览，追加 Reviews Executor。')
        if any(token in text for token in ['post', 'publish', '发布']):
            activated.add('exec_social')
            reasoning.append('涉及社媒发布预览，追加 Social Executor。')

        active_edges = [edge for edge in pipeline.edges if edge[0] in activated and edge[1] in activated]
        return {
            'activated_agents': sorted(activated),
            'active_edges': active_edges,
            'reasoning': reasoning,
        }
