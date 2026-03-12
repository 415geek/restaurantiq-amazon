from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import agents  # noqa: F401
from app.api.agents import router as agents_router
from app.api.executions import router as executions_router
from app.api.pipelines import router as pipelines_router
from app.api.websocket import manager as ws_manager
from app.api.websocket import router as ws_router
from app.config import get_settings
from app.models.task import OrchestrationTask
from app.orchestrator.dag_pipeline import DAGPipeline
from app.orchestrator.default_pipeline import build_default_pipeline
from app.orchestrator.router import RequestRouter
from app.orchestrator.scheduler import Scheduler
from app.orchestrator.supervisor import SupervisorAgent
from app.state.pipeline_store import PipelineStore
from app.state.snapshot import SnapshotEngine
from app.state.store import StateStore
from app.agents.registry import AgentRegistry


def bootstrap_registry(state_store: StateStore, pipeline_config):
    registry = AgentRegistry(state_store)
    registry.hydrate(pipeline_config.agents)
    return registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    state_store = StateStore()
    await state_store.ping()
    pipeline_store = PipelineStore()
    pipeline_config = await pipeline_store.load() or build_default_pipeline()
    registry = bootstrap_registry(state_store, pipeline_config)
    pipeline = DAGPipeline(registry)
    router = RequestRouter()
    scheduler = Scheduler()
    for agent_config in pipeline_config.agents:
        scheduler.register(agent_config.agent_id, agent_config.schedule_cron)
    snapshot_engine = SnapshotEngine(state_store, rollback_window_sec=settings.default_rollback_window_sec)
    supervisor = SupervisorAgent(pipeline=pipeline, router=router)

    app.state.settings = settings
    app.state.state_store = state_store
    app.state.pipeline_config = pipeline_config
    app.state.registry = registry
    app.state.pipeline = pipeline
    app.state.scheduler = scheduler
    app.state.snapshot_engine = snapshot_engine
    app.state.supervisor = supervisor
    app.state.ws_manager = ws_manager
    app.state.bootstrap_registry = lambda config: bootstrap_registry(state_store, config)
    app.state.pipeline_store = pipeline_store
    app.state.persist_pipeline_config = pipeline_store.save

    yield

    await state_store.close()


app = FastAPI(
    title='RestaurantIQ Multi-Agent API',
    description='Hierarchical DAG orchestration service for RestaurantIQ',
    version='3.0.0',
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.include_router(agents_router)
app.include_router(pipelines_router)
app.include_router(executions_router)
app.include_router(ws_router)


@app.get('/')
async def root():
    return {'service': 'RestaurantIQ Multi-Agent System', 'version': '3.0.0', 'status': 'running'}


@app.get('/api/v1/health')
async def health():
    settings = get_settings()
    return {
        'status': 'healthy',
        'openai_configured': bool(settings.openai_api_key),
        'redis_url': settings.redis_url,
        'tenant_mode': settings.tenant_mode,
    }


@app.post('/api/v1/query')
async def query(task: OrchestrationTask):
    return await app.state.supervisor.handle_request(
        request=task.request,
        pipeline_config=app.state.pipeline_config,
        restaurant_context=task.restaurant_context,
        initial_input=task.initial_input,
        emit_event=app.state.ws_manager.broadcast,
    )
