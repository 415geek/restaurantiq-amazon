from __future__ import annotations

import json
import time
from typing import Any

from app.state.store import StateStore


class SnapshotEngine:
    """执行快照与回滚窗口管理。"""

    def __init__(self, state_store: StateStore, rollback_window_sec: int = 300) -> None:
        self._state = state_store
        self._window = rollback_window_sec

    async def create_snapshot(
        self,
        execution_id: str,
        agent_id: str,
        action_type: str,
        before_state: dict[str, Any],
        params: dict[str, Any],
    ) -> str:
        snapshot = {
            'execution_id': execution_id,
            'agent_id': agent_id,
            'action_type': action_type,
            'before_state': before_state,
            'params': params,
            'created_at': time.time(),
            'rollback_deadline': time.time() + self._window,
            'status': 'active',
        }
        key = f'snapshot:{execution_id}'
        await self._state.set(key, json.dumps(snapshot, ensure_ascii=False), expire=self._window + 60)
        return execution_id

    async def rollback(self, execution_id: str) -> dict[str, Any]:
        key = f'snapshot:{execution_id}'
        raw = await self._state.get(key)
        if raw is None:
            return {'success': False, 'error': '快照不存在或已过期'}

        snapshot = json.loads(raw)
        if snapshot['status'] == 'rolled_back':
            return {'success': False, 'error': '已经回滚过'}
        if time.time() > snapshot['rollback_deadline']:
            return {'success': False, 'error': '回滚窗口已关闭'}

        snapshot['status'] = 'rolled_back'
        await self._state.set(key, json.dumps(snapshot, ensure_ascii=False))
        return {
            'success': True,
            'execution_id': execution_id,
            'restored_state': snapshot['before_state'],
        }

    async def list_active_snapshots(self, restaurant_id: str) -> list[dict[str, Any]]:
        rows = await self._state.list_json('snapshot:*')
        return [
            row
            for row in rows
            if row.get('status') == 'active' and row.get('params', {}).get('restaurant_id') == restaurant_id
        ]
