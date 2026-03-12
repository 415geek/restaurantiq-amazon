from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent
from app.config import get_settings
from app.llm.openai_json import run_openai_json_schema
from app.models.agent_config import AgentConfig
from app.prompts.loader import render_prompt
from app.state.store import StateStore


def _extract_kpi_value(kpis: list[dict[str, Any]], key: str, default: str) -> str:
    match = next((kpi for kpi in kpis if kpi.get('id') == key), None)
    if not match:
        return default
    return str(match.get('value') or default)


def _task_blueprints() -> list[dict[str, Any]]:
    return [
        {
            'task_id': 'T-001',
            'title': '促销分类：按资金来源分类',
            'module': 'Promotions',
            'priority': 'P0',
            'status_column': 'Next 7 Days',
            'tags': ['discount', 'funding'],
            'goal': '梳理平台补贴与商家补贴，建立统一促销台账。',
            'why_now': '先厘清补贴来源，才能做后续折扣治理。',
            'platform_steps': [{'where': 'merchant portal', 'action': '导出近30天促销', 'detail': '标记平台/商家出资'}],
            'checklist': [{'item': '确认每个平台促销类型', 'done': False}, {'item': '补齐资金来源字段', 'done': False}, {'item': '整理异常促销', 'done': False}],
            'depends_on': [],
            'timeframe_days': 2,
            'measurement': {'primary_metric': 'discount_rate', 'how_to_measure': '按平台汇总促销核销金额', 'check_frequency': 'daily'},
            'stop_loss': {'trigger': '若导出数据缺字段', 'rollback_steps': ['暂停变更', '先做数据校验'], 'rollback_owner': 'manager'},
            'definition_of_done': ['完成双平台促销台账', '明确平台/商家补贴比例'],
        },
        {
            'task_id': 'T-002',
            'title': '阶梯式降折扣+最低消费',
            'module': 'Promotions',
            'priority': 'P0',
            'status_column': 'Next 7 Days',
            'tags': ['discount', 'basket'],
            'goal': '降低折扣泄漏，同时维持客单与转化。',
            'why_now': '折扣策略是近期利润改善的最快抓手。',
            'platform_steps': [{'where': 'merchant portal', 'action': '配置阶梯折扣', 'detail': '增加最低消费门槛'}],
            'checklist': [{'item': '设置最低消费', 'done': False}, {'item': '同步双平台折扣梯度', 'done': False}, {'item': '记录生效时间', 'done': False}],
            'depends_on': ['T-001'],
            'timeframe_days': 3,
            'measurement': {'primary_metric': 'discount_rate', 'how_to_measure': '对比日折扣率与客单', 'check_frequency': 'daily'},
            'stop_loss': {'trigger': '订单量连续2天下降>15%', 'rollback_steps': ['恢复旧折扣', '复盘价格敏感品'], 'rollback_owner': 'manager'},
            'definition_of_done': ['双平台最低消费生效', '折扣梯度已更新'],
        },
        {
            'task_id': 'T-003',
            'title': '排除低毛利商品参与折扣',
            'module': 'Menu',
            'priority': 'P1',
            'status_column': 'Backlog',
            'tags': ['margin', 'menu'],
            'goal': '保护低毛利商品，避免促销吞噬利润。',
            'why_now': '高折扣阶段更容易放大利润受损。',
            'platform_steps': [{'where': 'merchant portal', 'action': '更新促销适用品', 'detail': '剔除低毛利菜品'}],
            'checklist': [{'item': '识别低毛利菜品', 'done': False}, {'item': '更新促销白名单', 'done': False}, {'item': '通知门店经理', 'done': False}],
            'depends_on': ['T-001'],
            'timeframe_days': 4,
            'measurement': {'primary_metric': 'gross_margin', 'how_to_measure': '比对促销前后毛利率', 'check_frequency': 'weekly'},
            'stop_loss': {'trigger': '核心菜销量下降明显', 'rollback_steps': ['恢复菜品参与促销', '单独做套餐测试'], 'rollback_owner': 'manager'},
            'definition_of_done': ['低毛利商品名单确认', '促销范围已更新'],
        },
        {
            'task_id': 'T-004',
            'title': '创建2-3个套餐组合',
            'module': 'Menu',
            'priority': 'P1',
            'status_column': 'Backlog',
            'tags': ['bundle', 'menu'],
            'goal': '通过套餐提高客单并带动主推菜销量。',
            'why_now': '套餐比直接打折更容易放大利润空间。',
            'platform_steps': [{'where': 'merchant portal', 'action': '新建套餐', 'detail': '组合主食+饮品+加购'}],
            'checklist': [{'item': '设计2-3个套餐', 'done': False}, {'item': '准备图片文案', 'done': False}, {'item': '设置套餐价格', 'done': False}],
            'depends_on': ['T-002'],
            'timeframe_days': 5,
            'measurement': {'primary_metric': 'aov_actual_per_bill', 'how_to_measure': '观察套餐订单客单价', 'check_frequency': 'daily'},
            'stop_loss': {'trigger': '套餐转化低于单品促销', 'rollback_steps': ['下架低转化套餐', '保留最佳组合'], 'rollback_owner': 'manager'},
            'definition_of_done': ['至少2个套餐上线', '套餐素材完整发布'],
        },
        {
            'task_id': 'T-005',
            'title': '菜单转化优化(图片/排序)',
            'module': 'Conversion',
            'priority': 'P1',
            'status_column': 'Backlog',
            'tags': ['menu', 'conversion'],
            'goal': '提升主推菜点击率和转化率。',
            'why_now': '菜单呈现直接影响平台转化效率。',
            'platform_steps': [{'where': 'merchant portal', 'action': '优化菜单排序', 'detail': '主推菜置顶并补图'}],
            'checklist': [{'item': '补齐重点菜图片', 'done': False}, {'item': '调整排序', 'done': False}, {'item': '统一中英文名称', 'done': False}],
            'depends_on': ['T-004'],
            'timeframe_days': 4,
            'measurement': {'primary_metric': 'menu_conversion_rate', 'how_to_measure': '跟踪主推菜点击和下单率', 'check_frequency': 'daily'},
            'stop_loss': {'trigger': '菜单点击率下降', 'rollback_steps': ['恢复旧排序', '保留高表现图片'], 'rollback_owner': 'manager'},
            'definition_of_done': ['Top 菜品图片补齐', '菜单顺序已优化'],
        },
        {
            'task_id': 'T-006',
            'title': '加购项优化',
            'module': 'Conversion',
            'priority': 'P1',
            'status_column': 'Backlog',
            'tags': ['addon', 'upsell'],
            'goal': '提高附加购率，改善订单利润结构。',
            'why_now': '加购项对客单与利润提升最直接。',
            'platform_steps': [{'where': 'merchant portal', 'action': '调整加购推荐', 'detail': '绑定高毛利配菜和饮品'}],
            'checklist': [{'item': '筛选高毛利加购项', 'done': False}, {'item': '更新推荐逻辑', 'done': False}, {'item': '验证双平台展示', 'done': False}],
            'depends_on': ['T-005'],
            'timeframe_days': 3,
            'measurement': {'primary_metric': 'addon_attach_rate', 'how_to_measure': '统计加购项附着率', 'check_frequency': 'daily'},
            'stop_loss': {'trigger': '加购相关投诉增加', 'rollback_steps': ['移除问题加购项', '恢复旧配置'], 'rollback_owner': 'manager'},
            'definition_of_done': ['加购项列表上线', '附着率追踪已建立'],
        },
        {
            'task_id': 'T-007',
            'title': '数据映射验证',
            'module': 'DataIntegrity',
            'priority': 'P1',
            'status_column': 'Backlog',
            'tags': ['data', 'mapping'],
            'goal': '确认平台字段映射与上传数据口径一致。',
            'why_now': '错误映射会直接影响后续决策准确性。',
            'platform_steps': [{'where': 'ops dashboard', 'action': '核对字段映射', 'detail': '验证收入、折扣、退款字段'}],
            'checklist': [{'item': '对齐平台字段', 'done': False}, {'item': '验证退款口径', 'done': False}, {'item': '确认税费字段', 'done': False}],
            'depends_on': [],
            'timeframe_days': 2,
            'measurement': {'primary_metric': 'mapping_accuracy', 'how_to_measure': '抽样校验平台与报表数据', 'check_frequency': 'once'},
            'stop_loss': {'trigger': '发现关键字段缺失', 'rollback_steps': ['停用自动建议', '人工复核数据源'], 'rollback_owner': 'manager'},
            'definition_of_done': ['关键字段映射核对完成', '异常字段有处理方案'],
        },
        {
            'task_id': 'T-008',
            'title': '评分保护(出餐/包装)',
            'module': 'Ops',
            'priority': 'P2',
            'status_column': 'Backlog',
            'tags': ['reviews', 'ops'],
            'goal': '降低差评风险，稳定平台评分。',
            'why_now': '口碑风险会放大营销和定价调整的副作用。',
            'platform_steps': [{'where': 'store ops', 'action': '执行包装检查', 'detail': '重点检查易洒漏品类'}],
            'checklist': [{'item': '检查打包 SOP', 'done': False}, {'item': '记录出餐超时', 'done': False}, {'item': '抽检问题菜品', 'done': False}],
            'depends_on': [],
            'timeframe_days': 7,
            'measurement': {'primary_metric': 'customer_rating', 'how_to_measure': '跟踪评分与包装差评', 'check_frequency': 'daily'},
            'stop_loss': {'trigger': '差评集中出现', 'rollback_steps': ['暂停相关推广', '升级门店巡检'], 'rollback_owner': 'manager'},
            'definition_of_done': ['包装检查清单执行', '差评问题已追踪闭环'],
        },
    ]


def _experiments() -> list[dict[str, Any]]:
    return [
        {
            'experiment_id': 'E-001',
            'name': 'Promo step-down test',
            'hypothesis': '阶梯式折扣比固定大促更能保利润且不伤单量。',
            'changes': ['将主促销折扣逐步下调', '增加最低消费门槛'],
            'duration_days': 7,
            'primary_metric': 'discount_rate',
            'success_criteria': '折扣率下降且订单量稳定',
            'stop_rule': '订单量连续2天下降超过15%',
        },
        {
            'experiment_id': 'E-002',
            'name': 'Bundle conversion test',
            'hypothesis': '套餐组合可提升客单价并减少纯折扣依赖。',
            'changes': ['上线2-3个套餐', '比较套餐与单品促销转化'],
            'duration_days': 7,
            'primary_metric': 'aov_actual_per_bill',
            'success_criteria': '客单价提升且套餐转化稳定',
            'stop_rule': '套餐转化率低于单品促销超过20%',
        },
        {
            'experiment_id': 'E-003',
            'name': 'Menu optimization test',
            'hypothesis': '菜单排序与图片优化可提升主推菜转化。',
            'changes': ['优化图片', '调整排序'],
            'duration_days': 7,
            'primary_metric': 'menu_conversion_rate',
            'success_criteria': '主推菜点击率和下单率提升',
            'stop_rule': '点击率下降或投诉上升',
        },
    ]


def _data_requests() -> list[dict[str, Any]]:
    return [
        {'request_id': 'D-001', 'question': '各平台收入占比', 'priority': 'P0', 'owner': 'merchant', 'format': 'csv'},
        {'request_id': 'D-002', 'question': '促销明细(类型/资金来源/核销)', 'priority': 'P0', 'owner': 'merchant', 'format': 'csv'},
        {'request_id': 'D-003', 'question': '菜品销售排行(前20)', 'priority': 'P1', 'owner': 'merchant', 'format': 'csv'},
        {'request_id': 'D-004', 'question': '近30天评分和投诉', 'priority': 'P1', 'owner': 'merchant', 'format': 'csv'},
        {'request_id': 'D-005', 'question': '退款和费用字段确认', 'priority': 'P1', 'owner': 'merchant', 'format': 'csv'},
    ]


@register_agent('planner_strategy')
class PlannerStrategyAgent(BaseAgent):
    def __init__(self, config: AgentConfig, state_store: StateStore):
        super().__init__(config, state_store)

    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        upstream = input_data.get('_upstream', {})
        fusion = next((value for value in upstream.values() if 'analysis' in value and 'recommendations' in value), {})
        restaurant_context = input_data.get('_context') or {}

        llm_result = await self._maybe_run_openai_plan(fusion, restaurant_context)
        if llm_result:
            return {
                **llm_result,
                'source': 'openai',
            }

        return self._deterministic_plan(fusion, restaurant_context)

    async def _maybe_run_openai_plan(
        self,
        fusion: dict[str, Any],
        restaurant_context: dict[str, Any],
    ) -> dict[str, Any] | None:
        settings = get_settings()
        if not settings.openai_api_key:
            return None

        analysis = fusion.get('analysis', {})
        prompt = '\n\n'.join(
            [
                render_prompt(
                    self.config.prompt_template or 'planner_strategy.j2',
                    restaurant_context=restaurant_context,
                    fusion=fusion,
                    analysis=analysis,
                    recommendations=fusion.get('recommendations', []),
                ),
                'Return JSON only.',
                f'Fusion summary: {fusion.get("summary", "")}',
                f'Fusion analysis: {analysis}',
                f'Fusion recommendations: {fusion.get("recommendations", [])}',
            ]
        )

        parsed = await run_openai_json_schema(
            prompt=prompt,
            schema_name='restaurantiq_strategy_plan',
            schema={
                'type': 'object',
                'additionalProperties': False,
                'required': ['plan'],
                'properties': {
                    'plan': {
                        'type': 'object',
                        'additionalProperties': False,
                        'required': ['north_star', 'task_board', 'experiments', 'data_requests', 'assumptions', 'release_notes'],
                        'properties': {
                            'north_star': {
                                'type': 'object',
                                'additionalProperties': False,
                                'required': ['objective', 'objective_zh', 'time_horizon_days', 'primary_metrics', 'guardrail_metrics', 'review_cadence'],
                                'properties': {
                                    'objective': {'type': 'string'},
                                    'objective_zh': {'type': 'string'},
                                    'time_horizon_days': {'type': 'integer'},
                                    'primary_metrics': {'type': 'array', 'items': {'type': 'string'}},
                                    'guardrail_metrics': {'type': 'array', 'items': {'type': 'string'}},
                                    'review_cadence': {'type': 'string'},
                                },
                            },
                            'task_board': {
                                'type': 'object',
                                'additionalProperties': False,
                                'required': ['columns', 'tasks'],
                                'properties': {
                                    'columns': {'type': 'array', 'items': {'type': 'string'}},
                                    'tasks': {
                                        'type': 'array',
                                        'minItems': 8,
                                        'maxItems': 8,
                                        'items': {
                                            'type': 'object',
                                            'additionalProperties': False,
                                            'required': [
                                                'task_id',
                                                'title',
                                                'module',
                                                'priority',
                                                'status_column',
                                                'owners',
                                                'platforms',
                                                'tags',
                                                'goal',
                                                'why_now',
                                                'platform_steps',
                                                'checklist',
                                                'depends_on',
                                                'timeframe_days',
                                                'measurement',
                                                'stop_loss',
                                                'definition_of_done',
                                            ],
                                            'properties': {
                                                'task_id': {'type': 'string'},
                                                'title': {'type': 'string'},
                                                'module': {'type': 'string'},
                                                'priority': {'type': 'string'},
                                                'status_column': {'type': 'string'},
                                                'owners': {'type': 'array', 'items': {'type': 'string'}},
                                                'platforms': {'type': 'array', 'items': {'type': 'string'}},
                                                'tags': {'type': 'array', 'items': {'type': 'string'}},
                                                'goal': {'type': 'string'},
                                                'why_now': {'type': 'string'},
                                                'platform_steps': {'type': 'array', 'items': {'type': 'object'}},
                                                'checklist': {'type': 'array', 'items': {'type': 'object'}},
                                                'depends_on': {'type': 'array', 'items': {'type': 'string'}},
                                                'timeframe_days': {'type': 'integer'},
                                                'measurement': {'type': 'object'},
                                                'stop_loss': {'type': 'object'},
                                                'definition_of_done': {'type': 'array', 'items': {'type': 'string'}},
                                            },
                                        },
                                    },
                                },
                            },
                            'experiments': {
                                'type': 'array',
                                'minItems': 3,
                                'maxItems': 3,
                                'items': {'type': 'object'},
                            },
                            'data_requests': {
                                'type': 'array',
                                'minItems': 5,
                                'maxItems': 5,
                                'items': {'type': 'object'},
                            },
                            'assumptions': {
                                'type': 'array',
                                'minItems': 5,
                                'maxItems': 6,
                                'items': {'type': 'string'},
                            },
                            'release_notes': {
                                'type': 'object',
                                'additionalProperties': False,
                                'required': ['merchant_facing_summary', 'merchant_facing_summary_zh', 'internal_notes'],
                                'properties': {
                                    'merchant_facing_summary': {'type': 'string'},
                                    'merchant_facing_summary_zh': {'type': 'string'},
                                    'internal_notes': {'type': 'string'},
                                },
                            },
                        },
                    }
                },
            },
            model=self.config.model,
            max_output_tokens=min(self.config.max_tokens, 5000),
        )
        return parsed

    def _deterministic_plan(self, fusion: dict[str, Any], restaurant_context: dict[str, Any]) -> dict[str, Any]:
        analysis = fusion.get('analysis', {})
        kpis = analysis.get('kpis', [])
        health_score = float(analysis.get('health_score', 68))
        discount_rate = _extract_kpi_value(kpis, 'discount_rate', '47%')
        aov_value = _extract_kpi_value(kpis, 'aov_actual_per_bill', '$21.52')
        orders_per_day = _extract_kpi_value(kpis, 'orders_per_day', '27')

        if health_score < 60:
            summary_en = (
                f'Your discount rate is critically high at {discount_rate}, significantly impacting profitability. '
                'We created an 8-task plan to reduce discount leakage over the next 14 days while protecting order volume.'
            )
            summary_zh = (
                f'您的折扣率高达 {discount_rate}，已经明显影响盈利能力。'
                '我们制定了 8 项行动计划，在未来 14 天降低折扣流失，同时保护订单量。'
            )
        else:
            summary_en = (
                f'Your current discount rate at {discount_rate} has room for optimization. '
                'This 14-day plan focuses on promo control, bundling, and menu conversion to improve margins.'
            )
            summary_zh = (
                f'您当前的折扣率为 {discount_rate}，仍有优化空间。'
                '这份 14 天计划聚焦促销治理、套餐设计和菜单转化优化，以提升利润率。'
            )

        return {
            'plan': {
                'north_star': {
                    'objective': f'Reduce discount rate from {discount_rate} toward ≤35% while protecting volume',
                    'objective_zh': f'将折扣率从 {discount_rate} 降至 ≤35%，同时保护订单量',
                    'time_horizon_days': 14,
                    'primary_metrics': ['discount_rate', 'aov_actual_per_bill', 'bill_count_total'],
                    'guardrail_metrics': ['orders_per_day', 'customer_rating'],
                    'review_cadence': 'Daily for 7 days, then every 2 days',
                },
                'task_board': {
                    'columns': ['Backlog', 'Next 7 Days', 'In Progress', 'Blocked', 'Done'],
                    'tasks': _task_blueprints(),
                },
                'experiments': _experiments(),
                'data_requests': _data_requests(),
                'assumptions': [
                    'Platform split assumed 50/50 if unknown',
                    'Low-margin items are approximated from revenue mix if cost data is missing',
                    'Refund data may be incomplete in uploaded files',
                    'Single upload period does not represent full seasonality',
                    'Commission rate assumed near standard marketplace levels',
                ],
                'release_notes': {
                    'merchant_facing_summary': summary_en,
                    'merchant_facing_summary_zh': summary_zh,
                    'internal_notes': (
                        f'Health score {health_score:.0f}; AOV {aov_value}; orders/day {orders_per_day}. '
                        f'Context: {restaurant_context.get("restaurant_name") or "restaurant"}'
                    ),
                },
            },
            'strategy_summary': {
                'health_score': health_score,
                'discount_rate': discount_rate,
                'aov_actual_per_bill': aov_value,
                'orders_per_day': orders_per_day,
            },
            'timestamp': input_data_timestamp(),
            'source': 'deterministic',
        }


def input_data_timestamp() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
