from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.security import require_internal_api_key
from app.models.agent_config import AgentConfig

router = APIRouter(
    prefix='/api/agents',
    tags=['agents'],
    dependencies=[Depends(require_internal_api_key)],
)


@router.get('/')
async def list_agents(request: Request):
    return request.app.state.registry.list_agents()


@router.post('/')
async def create_agent(config: AgentConfig, request: Request):
    agent = request.app.state.registry.create_agent(config)
    if config.schedule_cron:
        request.app.state.scheduler.register(config.agent_id, config.schedule_cron)
    return {'agent_id': agent.agent_id, 'status': 'created'}


@router.put('/{agent_id}')
async def update_agent(agent_id: str, config: AgentConfig, request: Request):
    if agent_id != config.agent_id:
        raise HTTPException(status_code=400, detail='agent_id mismatch')
    agent = request.app.state.registry.update_agent_config(agent_id, config)
    request.app.state.scheduler.register(config.agent_id, config.schedule_cron)
    return {'agent_id': agent.agent_id, 'status': 'updated'}


@router.delete('/{agent_id}')
async def delete_agent(agent_id: str, request: Request):
    request.app.state.registry.remove_agent(agent_id)
    request.app.state.scheduler.remove(agent_id)
    return {'agent_id': agent_id, 'status': 'deleted'}
