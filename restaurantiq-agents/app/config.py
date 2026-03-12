from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    openai_api_key: str | None = None
    redis_url: str = 'redis://localhost:6379/0'
    database_url: str = 'sqlite+pysqlite:///./restaurantiq.db'
    api_host: str = '0.0.0.0'
    api_port: int = 8000
    internal_api_key: str | None = None

    default_model_fast: str = 'gpt-5-mini'
    default_model_balanced: str = 'gpt-5'
    default_model_powerful: str = 'gpt-5'
    default_rollback_window_sec: int = 300
    tenant_mode: str = 'strict'


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
