from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.api.security import require_internal_api_key

router = APIRouter(
    prefix='/api/executions',
    tags=['executions'],
    dependencies=[Depends(require_internal_api_key)],
)


class CreateSnapshotRequest(BaseModel):
    execution_id: str
    agent_id: str
    action_type: str
    before_state: dict = Field(default_factory=dict)
    params: dict = Field(default_factory=dict)


@router.post('/snapshots')
async def create_snapshot(payload: CreateSnapshotRequest, request: Request):
    snapshot_id = await request.app.state.snapshot_engine.create_snapshot(
        execution_id=payload.execution_id,
        agent_id=payload.agent_id,
        action_type=payload.action_type,
        before_state=payload.before_state,
        params=payload.params,
    )
    return {'snapshot_id': snapshot_id, 'status': 'created'}


@router.post('/snapshots/{execution_id}/rollback')
async def rollback_snapshot(execution_id: str, request: Request):
    return await request.app.state.snapshot_engine.rollback(execution_id)
