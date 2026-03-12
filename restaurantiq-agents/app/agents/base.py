from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import Any

from app.models.agent_config import AgentConfig
from app.state.store import StateStore

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """所有 Agent 的统一生命周期入口。"""

    def __init__(self, config: AgentConfig, state_store: StateStore) -> None:
        self.config = config
        self.state = state_store
        self._metrics = {'calls': 0, 'errors': 0}

    @property
    def agent_id(self) -> str:
        return self.config.agent_id

    @property
    def name(self) -> str:
        return self.config.name

    async def run(self, input_data: dict[str, Any]) -> dict[str, Any]:
        start = time.monotonic()
        attempt = 0
        last_error: Exception | None = None

        while attempt <= self.config.retry_count:
            try:
                validated = await self.validate_input(input_data)
                result = await self.execute(validated)
                output = await self.format_output(result)
                elapsed_ms = int((time.monotonic() - start) * 1000)
                await self.state.set(
                    f'agent:{self.agent_id}:last_run',
                    {'status': 'success', 'elapsed_ms': elapsed_ms, 'output_keys': list(output.keys())},
                )
                self._metrics['calls'] += 1
                return output
            except Exception as exc:  # pragma: no cover - runtime safety path
                attempt += 1
                last_error = exc
                logger.warning('[%s] attempt %s failed: %s', self.name, attempt, exc)
                if attempt > self.config.retry_count:
                    break

        self._metrics['errors'] += 1
        await self.state.set(
            f'agent:{self.agent_id}:last_run',
            {'status': 'error', 'error': str(last_error)},
        )
        return {'error': str(last_error), 'agent_id': self.agent_id}

    @abstractmethod
    async def execute(self, input_data: dict[str, Any]) -> dict[str, Any]:
        ...

    async def validate_input(self, data: dict[str, Any]) -> dict[str, Any]:
        return data

    async def format_output(self, data: dict[str, Any]) -> dict[str, Any]:
        return data

    def get_metrics(self) -> dict[str, Any]:
        return {**self._metrics, 'agent_id': self.agent_id, 'name': self.name, 'role': self.config.role.value}
