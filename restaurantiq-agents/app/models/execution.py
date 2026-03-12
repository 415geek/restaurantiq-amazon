from __future__ import annotations

from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


class ExecutionStatus(str, Enum):
    PENDING_CONFIRMATION = 'pending_confirmation'
    EXECUTING = 'executing'
    COMPLETED = 'completed'
    ROLLED_BACK = 'rolled_back'
    FAILED = 'failed'


class ExecutionRecord(BaseModel):
    execution_id: str = Field(default_factory=lambda: str(uuid4()))
    restaurant_id: str
    agent_id: str
    action_type: str
    status: ExecutionStatus = ExecutionStatus.PENDING_CONFIRMATION
    actor_user_id: str | None = None
    params: dict = Field(default_factory=dict)
    rollback_deadline_ts: float | None = None
