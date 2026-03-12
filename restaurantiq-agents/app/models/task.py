from __future__ import annotations

from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    QUEUED = 'queued'
    RUNNING = 'running'
    COMPLETED = 'completed'
    PARTIAL = 'partial'
    FAILED = 'failed'


class OrchestrationTask(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    restaurant_id: str
    request: str
    trigger: str = 'manual'
    status: TaskStatus = TaskStatus.QUEUED
    metadata: dict[str, Any] = Field(default_factory=dict)
    restaurant_context: dict[str, Any] = Field(default_factory=dict)
    initial_input: dict[str, Any] = Field(default_factory=dict)
