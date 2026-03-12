from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseAgent
from app.agents.registry import register_agent
from app.models.agent_config import AgentConfig
from app.state.store import StateStore


def _build_recommendation_from_task(task: dict[str, Any], action_type: str) -> dict[str, Any]:
    return {
        'id': task.get('task_id', f'validator_{action_type}'),
        'category': task.get('module', action_type).lower(),
        'title': task.get('title', f'{action_type} action'),
        'title_zh': task.get('title', f'{action_type}动作'),
        'impact_score': 80 if task.get('priority') == 'P0' else 68 if task.get('priority') == 'P1' else 56,
        'urgency': 'immediate' if task.get('priority') == 'P0' else 'this_week',
        'risk_level': 'medium' if action_type in {'pricing', 'marketing'} else 'low',
        'description': task.get('goal') or task.get('why_now') or 'Generated from validator output.',
        'expected_outcome': task.get('definition_of_done', ['Deliver planned execution'])[0],
        'source': 'validator',
    }


def _match_task_for_action(tasks: list[dict[str, Any]], action_type: str) -> dict[str, Any] | None:
    module_map = {
        'pricing': {'Promotions', 'Menu', 'Conversion'},
        'marketing': {'Promotions', 'Conversion'},
        'social': {'Ops', 'Conversion'},
        'reviews': {'Ops'},
        'inventory': {'Ops', 'DataIntegrity'},
        'scheduling': {'Ops'},
    }
    wanted_modules = module_map.get(action_type, set())
    for task in tasks:
        if task.get('module') in wanted_modules:
            return task
    return tasks[0] if tasks else None


def _execution_preview(input_data: dict[str, Any], action_type: str) -> dict[str, Any]:
    upstream = input_data.get('_upstream', {})
    validator = next((value for value in upstream.values() if 'validated_plan' in value or 'frontend_ready' in value), {})
    recommendation = None
    execution_context: dict[str, Any] | None = None

    if validator:
        tasks = validator.get('validated_plan', {}).get('task_board', {}).get('tasks', [])
        top_actions = validator.get('frontend_ready', {}).get('top_actions', [])
        matched_task = _match_task_for_action(tasks, action_type)
        if matched_task:
            recommendation = _build_recommendation_from_task(matched_task, action_type)
            execution_context = {
                'health_badge': validator.get('frontend_ready', {}).get('health_badge'),
                'top_action_refs': [action.get('task_ref') for action in top_actions],
                'qa_status': validator.get('qa_report', {}).get('status'),
            }

    if recommendation is None:
        analyzer = next((value for value in upstream.values() if 'recommendations' in value), {})
        recommendations = analyzer.get('recommendations', [])
        recommendation = recommendations[0] if recommendations else None

    return {
        'status': 'awaiting_human_confirmation',
        'action_type': action_type,
        'recommendation': recommendation,
        'execution_context': execution_context,
        'rollback_window_minutes': 5,
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }


@register_agent('exec_pricing')
class ExecutorPricingAgent(BaseAgent):
    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        return _execution_preview(input_data, 'pricing')
