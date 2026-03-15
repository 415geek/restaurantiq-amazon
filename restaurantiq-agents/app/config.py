"""
RestaurantIQ Agents Configuration
Updated for V2.1 with Anthropic SDK and corrected model names
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # ============= Server =============
    app_name: str = "RestaurantIQ Agents"
    version: str = "2.1.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    
    # ============= Database =============
    database_url: str = 'sqlite+pysqlite:///./restaurantiq.db'
    
    # ============= Redis =============
    redis_url: str = 'redis://localhost:6379/0'
    
    # ============= OpenAI =============
    openai_api_key: Optional[str] = None
    
    # ============= Anthropic / Claude =============
    anthropic_api_key: Optional[str] = None
    
    # ============= AWS =============
    aws_region: str = 'us-east-1'
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    
    # ============= Model Configuration (CORRECTED) =============
    # Tier 1: Fast/Low Cost
    default_model_fast: str = 'claude-haiku-4-5-20251001'  # Was: gpt-5-mini (doesn't exist)
    fallback_model_fast: str = 'gpt-4o-mini'
    
    # Tier 2: Balanced
    default_model_balanced: str = 'claude-sonnet-4-6'  # Was: gpt-5 (doesn't exist)
    fallback_model_balanced: str = 'gpt-4o'
    
    # Tier 3: Powerful
    default_model_powerful: str = 'claude-opus-4-6'  # Was: gpt-5 (doesn't exist)
    fallback_model_powerful: str = 'gpt-4o'
    
    # ============= Legacy Model Names (for backward compatibility) =============
    # These are mapped to the new tier system
    openai_ops_parse_model: str = 'gpt-4o-mini'
    openai_ops_review_model: str = 'gpt-4o'
    openai_ops_report_model: str = 'gpt-4o'
    
    claude_ops_parse_model: str = 'claude-3-5-haiku-latest'
    claude_ops_review_model: str = 'claude-3-7-sonnet-latest'
    claude_ops_report_model: str = 'claude-3-7-sonnet-latest'
    
    # ============= Agent Configuration =============
    agent_timeout: int = 300  # seconds
    agent_max_retries: int = 3
    agent_retry_delay: int = 5  # seconds
    
    # ============= Nova Act =============
    nova_act_enabled: bool = False
    nova_act_endpoint: Optional[str] = None
    nova_act_api_key: Optional[str] = None
    
    # ============= Internal API =============
    internal_api_key: str = "restaurantiq-internal-api-key-2024"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()


def get_model_for_tier(tier: str, provider: str = 'anthropic') -> str:
    """
    Get model name for a given tier and provider
    
    Args:
        tier: 'fast', 'balanced', or 'powerful'
        provider: 'anthropic' or 'openai'
    
    Returns:
        Model name string
    """
    if provider == 'anthropic':
        if tier == 'fast':
            return settings.default_model_fast
        elif tier == 'balanced':
            return settings.default_model_balanced
        elif tier == 'powerful':
            return settings.default_model_powerful
    elif provider == 'openai':
        if tier == 'fast':
            return settings.fallback_model_fast
        elif tier == 'balanced':
            return settings.fallback_model_balanced
        elif tier == 'powerful':
            return settings.fallback_model_powerful
    
    raise ValueError(f"Invalid tier or provider: {tier}, {provider}")


def get_fallback_model(tier: str) -> str:
    """
    Get fallback model for a given tier
    
    Args:
        tier: 'fast', 'balanced', or 'powerful'
    
    Returns:
        Fallback model name string
    """
    if tier == 'fast':
        return settings.fallback_model_fast
    elif tier == 'balanced':
        return settings.fallback_model_balanced
    elif tier == 'powerful':
        return settings.fallback_model_powerful
    
    raise ValueError(f"Invalid tier: {tier}")


# Agent tier mapping
AGENT_TIERS = {
    # Tier 1: Fast (Data structuring, execution)
    'collector_ops': 'fast',
    'collector_social': 'fast',
    'executor_pricing': 'fast',
    'executor_marketing': 'fast',
    'executor_inventory': 'fast',
    'executor_reviews': 'fast',
    'executor_scheduling': 'fast',
    'executor_social': 'fast',
    'validator_output': 'fast',
    
    # Tier 2: Balanced (Analysis, reporting)
    'collector_macro': 'balanced',
    'analyzer': 'balanced',
    'planner_strategy': 'balanced',
    
    # Tier 3: Powerful (Deep reasoning, decision making)
    'agent_d_synthesis': 'powerful',
    'agent_d_validator': 'powerful',
    'execution_planner': 'powerful',
}


def get_agent_tier(agent_id: str) -> str:
    """
    Get the recommended tier for an agent
    
    Args:
        agent_id: Agent identifier
    
    Returns:
        Tier string: 'fast', 'balanced', or 'powerful'
    """
    return AGENT_TIERS.get(agent_id, 'balanced')

_settings_instance: Settings | None = None


def get_settings() -> Settings:
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = Settings()
    return _settings_instance
