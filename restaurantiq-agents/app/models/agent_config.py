from __future__ import annotations

from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class AgentRole(str, Enum):
    COLLECTOR = 'collector'
    ANALYZER = 'analyzer'
    EXECUTOR = 'executor'
    SUPERVISOR = 'supervisor'
    CUSTOM = 'custom'


class ModelTier(str, Enum):
    FAST = 'amazon.nova-lite-v1:0'
    BALANCED = 'amazon.nova-pro-v1:0'
    POWERFUL = 'amazon.nova-pro-v1:0'


class ToolConfig(BaseModel):
    tool_id: str
    name: str
    endpoint: str
    auth_type: str = 'api_key'
    enabled: bool = True
    rate_limit: int = 100
    timeout_seconds: int = 30


class AgentConfig(BaseModel):
    agent_id: str = Field(default_factory=lambda: str(uuid4())[:8])
    name: str
    name_en: str = ''
    description: str = ''
    role: AgentRole
    agent_type: str | None = None
    icon: str = '🤖'
    color: str = '#FF6B35'
    enabled: bool = True

    model: str = ModelTier.BALANCED.value
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    max_tokens: int = Field(default=2048, ge=128, le=8192)

    system_prompt: str = ''
    prompt_template: str = ''
    few_shot_examples: list[dict[str, Any]] = Field(default_factory=list)

    fine_tune_model_id: str | None = None
    fine_tune_dataset: str | None = None

    tools: list[ToolConfig] = Field(default_factory=list)
    max_tool_calls: int = 5

    retry_count: int = 2
    timeout_seconds: int = 60
    batch_size: int = 10

    input_agents: list[str] = Field(default_factory=list)
    output_agents: list[str] = Field(default_factory=list)

    schedule_cron: str | None = None
    trigger_events: list[str] = Field(default_factory=list)
    tenant_id: str | None = None


class PipelineConfig(BaseModel):
    pipeline_id: str = Field(default_factory=lambda: str(uuid4())[:8])
    name: str
    description: str = ''
    restaurant_id: str
    agents: list[AgentConfig]
    edges: list[tuple[str, str]]
    global_config: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
