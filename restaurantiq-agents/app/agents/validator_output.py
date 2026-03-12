from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent
from app.config import get_settings
from app.llm.openai_json import run_openai_json_schema
from app.models.agent_config import AgentConfig
from app.prompts.loader import render_prompt
from app.state.store import StateStore

VALID_PRIORITIES = {'P0', 'P1', 'P2'}
VALID_STATUS_COLUMNS = {'Backlog', 'Next 7 Days', 'In Progress', 'Blocked', 'Done'}
VALID_MODULES = {'Promotions', 'Menu', 'Conversion', 'Ops', 'DataIntegrity'}


def _health_badge(score: float) -> dict[str, Any]:
    if score >= 90:
        return {'score': round(score, 1), 'grade': 'A', 'grade_zh': '优', 'color': 'green', 'label': 'Excellent', 'label_zh': '优秀'}
    if score >= 80:
        return {'score': round(score, 1), 'grade': 'B', 'grade_zh': '良', 'color': 'green', 'label': 'Good', 'label_zh': '良好'}
    if score >= 70:
        return {'score': round(score, 1), 'grade': 'C', 'grade_zh': '中', 'color': 'yellow', 'label': 'Fair', 'label_zh': '一般'}
    if score >= 60:
        return {'score': round(score, 1), 'grade': 'D', 'grade_zh': '差', 'color': 'orange', 'label': 'Poor', 'label_zh': '较差'}
    return {'score': round(score, 1), 'grade': 'F', 'grade_zh': '危', 'color': 'red', 'label': 'Critical - Immediate Action Required', 'label_zh': '危险 - 需立即行动'}


@register_agent('validator_output')
class ValidatorOutputAgent(BaseAgent):
    def __init__(self, config: AgentConfig, state_store: StateStore):
        super().__init__(config, state_store)

    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        upstream = input_data.get('_upstream', {})
        planner = next((value for value in upstream.values() if 'plan' in value), {})
        fusion = next((value for value in upstream.values() if 'analysis' in value and 'recommendations' in value), {})
        restaurant_context = input_data.get('_context') or {}

        llm_result = await self._maybe_run_openai_validation(planner, fusion, restaurant_context)
        if llm_result:
            return {
                **llm_result,
                'source': 'openai',
                'timestamp': datetime.now(timezone.utc).isoformat(),
            }

        return self._deterministic_validation(planner, fusion)

    async def _maybe_run_openai_validation(
        self,
        planner: dict[str, Any],
        fusion: dict[str, Any],
        restaurant_context: dict[str, Any],
    ) -> dict[str, Any] | None:
        settings = get_settings()
        if not settings.openai_api_key or not planner.get('plan'):
            return None

        analysis = fusion.get('analysis', {})
        prompt = '\n\n'.join(
            [
                render_prompt(
                    self.config.prompt_template or 'validator_output.j2',
                    restaurant_context=restaurant_context,
                    planner=planner,
                    fusion=fusion,
                    analysis=analysis,
                ),
                'Return JSON only.',
                f'Planner output: {planner}',
                f'Fusion analysis: {analysis}',
            ]
        )

        parsed = await run_openai_json_schema(
            prompt=prompt,
            schema_name='restaurantiq_validator_output',
            schema={
                'type': 'object',
                'additionalProperties': False,
                'required': ['validated_plan', 'qa_report', 'frontend_ready'],
                'properties': {
                    'validated_plan': {'type': 'object'},
                    'qa_report': {'type': 'object'},
                    'frontend_ready': {'type': 'object'},
                },
            },
            model=self.config.model,
            max_output_tokens=min(self.config.max_tokens, 5000),
        )
        return parsed

    def _deterministic_validation(self, planner: dict[str, Any], fusion: dict[str, Any]) -> dict[str, Any]:
        plan = deepcopy(planner.get('plan') or {})
        analysis = fusion.get('analysis', {})
        kpis = analysis.get('kpis', [])
        fixes_applied: list[dict[str, Any]] = []
        warnings: list[str] = []
        missing_sections: list[str] = []

        task_board = plan.setdefault('task_board', {})
        columns = task_board.setdefault('columns', ['Backlog', 'Next 7 Days', 'In Progress', 'Blocked', 'Done'])
        tasks = task_board.setdefault('tasks', [])
        experiments = plan.setdefault('experiments', [])
        data_requests = plan.setdefault('data_requests', [])
        assumptions = plan.setdefault('assumptions', [])
        north_star = plan.setdefault('north_star', {})
        release_notes = plan.setdefault('release_notes', {})

        if len(tasks) < 6:
            missing_sections.append('incomplete_tasks')
        if len(experiments) < 2:
            missing_sections.append('incomplete_experiments')
        if len(data_requests) < 4:
            missing_sections.append('incomplete_data_requests')
        if len(assumptions) < 4:
            missing_sections.append('incomplete_assumptions')

        seen_ids: set[str] = set()
        for index, task in enumerate(tasks, start=1):
            expected_id = f'T-{index:03d}'
            original_id = task.get('task_id')
            if not original_id or original_id in seen_ids:
                task['task_id'] = expected_id
                fixes_applied.append({'fix_id': f'F-{len(fixes_applied)+1:03d}', 'location': f'tasks[{index - 1}].task_id', 'original': original_id, 'fixed_to': expected_id, 'rule': 'Missing or duplicate task_id'})
            seen_ids.add(task['task_id'])
            if task.get('priority') not in VALID_PRIORITIES:
                original = task.get('priority')
                task['priority'] = 'P1'
                fixes_applied.append({'fix_id': f'F-{len(fixes_applied)+1:03d}', 'location': f'tasks[{index - 1}].priority', 'original': original, 'fixed_to': 'P1', 'rule': 'Invalid enum value'})
            if task.get('status_column') not in VALID_STATUS_COLUMNS:
                original = task.get('status_column')
                task['status_column'] = 'Backlog'
                fixes_applied.append({'fix_id': f'F-{len(fixes_applied)+1:03d}', 'location': f'tasks[{index - 1}].status_column', 'original': original, 'fixed_to': 'Backlog', 'rule': 'Invalid enum value'})
            if task.get('module') not in VALID_MODULES:
                original = task.get('module')
                task['module'] = self._infer_module(task.get('title', ''))
                fixes_applied.append({'fix_id': f'F-{len(fixes_applied)+1:03d}', 'location': f'tasks[{index - 1}].module', 'original': original, 'fixed_to': task['module'], 'rule': 'Invalid module inferred from title'})

        if not release_notes.get('merchant_facing_summary_zh') and release_notes.get('merchant_facing_summary'):
            release_notes['merchant_facing_summary_zh'] = '请根据英文摘要补充中文版本。'
            fixes_applied.append({'fix_id': f'F-{len(fixes_applied)+1:03d}', 'location': 'release_notes.merchant_facing_summary_zh', 'original': '', 'fixed_to': release_notes['merchant_facing_summary_zh'], 'rule': 'Missing Chinese translation'})

        completeness_score = (
            (30 if len(tasks) >= 6 else len(tasks) * 5)
            + (20 if len(experiments) >= 2 else len(experiments) * 10)
            + (20 if len(data_requests) >= 4 else len(data_requests) * 5)
            + (15 if len(assumptions) >= 4 else len(assumptions) * 4)
            + (15 if release_notes.get('merchant_facing_summary_zh') else 0)
        )

        if completeness_score >= 100 and not fixes_applied:
            qa_status = 'pass'
        elif completeness_score >= 80:
            qa_status = 'pass_with_fixes'
        elif completeness_score >= 60:
            qa_status = 'incomplete'
        else:
            qa_status = 'fail'

        health_score = float(analysis.get('health_score', 68))
        health_badge = _health_badge(health_score)
        kpi_cards = self._build_kpi_cards(kpis, health_badge['score'])
        top_actions = self._build_top_actions(tasks)
        timeline = {
            'week_1': {'label': 'Week 1: Foundation', 'label_zh': '第1周：基础工作', 'tasks': [task['task_id'] for task in tasks[:4]]},
            'week_2': {'label': 'Week 2: Optimization', 'label_zh': '第2周：优化提升', 'tasks': [task['task_id'] for task in tasks[4:8]]},
        }
        quick_stats = {
            'total_tasks': len(tasks),
            'p0_tasks': len([task for task in tasks if task.get('priority') == 'P0']),
            'p1_tasks': len([task for task in tasks if task.get('priority') == 'P1']),
            'p2_tasks': len([task for task in tasks if task.get('priority') == 'P2']),
            'estimated_days': int(north_star.get('time_horizon_days', 14) or 14),
            'potential_savings': 'Reduce discount by 12%',
            'potential_savings_zh': '折扣率降低12%',
        }

        return {
            'validated_plan': plan,
            'qa_report': {
                'status': qa_status,
                'completeness_score': completeness_score,
                'task_count': len(tasks),
                'experiment_count': len(experiments),
                'data_request_count': len(data_requests),
                'fixes_applied': fixes_applied,
                'warnings': warnings,
                'missing_sections': missing_sections,
            },
            'frontend_ready': {
                'display_mode': 'full' if qa_status in {'pass', 'pass_with_fixes'} else 'summary',
                'health_badge': health_badge,
                'kpi_cards': kpi_cards,
                'top_actions': top_actions,
                'timeline': timeline,
                'quick_stats': quick_stats,
            },
            'source': 'deterministic',
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

    def _infer_module(self, title: str) -> str:
        text = title.lower()
        if '促销' in title or 'promo' in text or 'discount' in text:
            return 'Promotions'
        if '套餐' in title or 'menu' in text:
            return 'Menu'
        if '转化' in title or 'conversion' in text or '加购' in title:
            return 'Conversion'
        if '数据' in title or 'mapping' in text:
            return 'DataIntegrity'
        return 'Ops'

    def _build_kpi_cards(self, kpis: list[dict[str, Any]], health_score: float) -> list[dict[str, Any]]:
        cards = []
        for kpi in kpis[:4]:
            source_value = str(kpi.get('value', '0'))
            label = kpi.get('label', kpi.get('id', 'KPI'))
            cards.append(
                {
                    'id': kpi.get('id', label.lower().replace(' ', '_')),
                    'title': label,
                    'title_zh': label,
                    'value': source_value,
                    'status': 'critical' if kpi.get('direction') == 'down' else 'healthy',
                    'target': kpi.get('delta', 'Maintain'),
                    'target_zh': kpi.get('delta', '保持'),
                    'trend': kpi.get('direction', 'unknown'),
                    'trend_icon': '↓' if kpi.get('direction') == 'down' else '↑' if kpi.get('direction') == 'up' else '→',
                }
            )
        while len(cards) < 4:
            cards.append(
                {
                    'id': f'health_score_{len(cards)}',
                    'title': 'Health Score',
                    'title_zh': '健康评分',
                    'value': str(int(health_score)),
                    'status': 'critical' if health_score < 60 else 'warning' if health_score < 75 else 'healthy',
                    'target': '80+',
                    'target_zh': '80+',
                    'trend': 'unknown',
                    'trend_icon': '→',
                }
            )
        return cards[:4]

    def _build_top_actions(self, tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        priority_tasks = [task for task in tasks if task.get('priority') == 'P0'][:3]
        return [
            {
                'id': index + 1,
                'task_ref': task.get('task_id'),
                'title': task.get('title'),
                'title_zh': task.get('title'),
                'urgency': 'This week',
                'urgency_zh': '本周',
                'impact': task.get('goal', ''),
                'impact_zh': task.get('goal', ''),
            }
            for index, task in enumerate(priority_tasks)
        ]
