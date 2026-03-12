from __future__ import annotations

from typing import Type

from app.agents.base import BaseAgent
from app.models.agent_config import AgentConfig
from app.state.store import StateStore

_AGENT_CLASSES: dict[str, Type[BaseAgent]] = {}


def register_agent(agent_type: str):
    def decorator(cls: Type[BaseAgent]):
        _AGENT_CLASSES[agent_type] = cls
        return cls

    return decorator


class AgentRegistry:
    def __init__(self, state_store: StateStore):
        self._state = state_store
        self._instances: dict[str, BaseAgent] = {}
        self._configs: dict[str, AgentConfig] = {}

    def create_agent(self, config: AgentConfig) -> BaseAgent:
        agent_type = (config.agent_type or config.role.value).lower()
        cls = _AGENT_CLASSES.get(agent_type) or _AGENT_CLASSES.get(config.role.value)
        if cls is None:
            raise ValueError(f'未注册的 Agent 类型: {agent_type}')
        instance = cls(config=config, state_store=self._state)
        self._instances[config.agent_id] = instance
        self._configs[config.agent_id] = config
        return instance

    def hydrate(self, configs: list[AgentConfig]) -> None:
        for config in configs:
            self.create_agent(config)

    def get_agent(self, agent_id: str) -> BaseAgent | None:
        return self._instances.get(agent_id)

    def get_config(self, agent_id: str) -> AgentConfig | None:
        return self._configs.get(agent_id)

    def list_agent_configs(self) -> list[AgentConfig]:
        return list(self._configs.values())

    def list_agents(self) -> list[dict]:
        return [agent.get_metrics() for agent in self._instances.values()]

    def remove_agent(self, agent_id: str) -> None:
        self._instances.pop(agent_id, None)
        self._configs.pop(agent_id, None)

    def update_agent_config(self, agent_id: str, new_config: AgentConfig) -> BaseAgent:
        self.remove_agent(agent_id)
        return self.create_agent(new_config)
