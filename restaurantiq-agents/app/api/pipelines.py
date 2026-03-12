from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.api.security import require_internal_api_key
from app.agents.registry import AgentRegistry
from app.models.agent_config import PipelineConfig
from app.orchestrator.dag_pipeline import DAGPipeline
from app.orchestrator.router import RequestRouter
from app.orchestrator.scheduler import Scheduler
from app.orchestrator.supervisor import SupervisorAgent

router = APIRouter(
    prefix='/api/pipelines',
    tags=['pipelines'],
    dependencies=[Depends(require_internal_api_key)],
)


class RunPipelineRequest(BaseModel):
    request: str = Field(..., description='顶层任务请求')
    restaurant_context: dict = Field(default_factory=dict)
    initial_input: dict = Field(default_factory=dict)


@router.get('/current')
async def get_current_pipeline(request: Request):
    return request.app.state.pipeline_config.model_dump(mode='json')


@router.post('/current')
async def save_current_pipeline(config: PipelineConfig, request: Request):
    request.app.state.pipeline_config = config
    await request.app.state.persist_pipeline_config(config)
    registry: AgentRegistry = request.app.state.bootstrap_registry(config)
    pipeline = DAGPipeline(registry)
    scheduler = Scheduler()
    for agent_config in config.agents:
        scheduler.register(agent_config.agent_id, agent_config.schedule_cron)
    supervisor = SupervisorAgent(pipeline=pipeline, router=RequestRouter())
    request.app.state.registry = registry
    request.app.state.pipeline = pipeline
    request.app.state.scheduler = scheduler
    request.app.state.supervisor = supervisor
    return {'pipeline_id': config.pipeline_id, 'agents': len(config.agents), 'edges': len(config.edges)}


@router.post('/run')
async def run_pipeline(payload: RunPipelineRequest, request: Request):
    return await request.app.state.supervisor.handle_request(
        request=payload.request,
        pipeline_config=request.app.state.pipeline_config,
        restaurant_context=payload.restaurant_context,
        initial_input=payload.initial_input,
        emit_event=request.app.state.ws_manager.broadcast,
    )
