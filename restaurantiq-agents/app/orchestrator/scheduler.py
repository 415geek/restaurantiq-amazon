from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ScheduledJob:
    agent_id: str
    cron: str
    enabled: bool = True


class Scheduler:
    """当前只保留调度配置快照，后续可接 APScheduler / Celery Beat。"""

    def __init__(self) -> None:
        self._jobs: dict[str, ScheduledJob] = {}

    def register(self, agent_id: str, cron: str | None) -> None:
        if not cron:
            return
        self._jobs[agent_id] = ScheduledJob(agent_id=agent_id, cron=cron)

    def remove(self, agent_id: str) -> None:
        self._jobs.pop(agent_id, None)

    def list_jobs(self) -> list[dict[str, Any]]:
        return [job.__dict__ for job in self._jobs.values()]
