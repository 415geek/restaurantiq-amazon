from __future__ import annotations

from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'


class RecommendationCategory(str, Enum):
    PRICING = 'pricing'
    MARKETING = 'marketing'
    SOCIAL = 'social'
    OPERATIONS = 'operations'
    STAFFING = 'staffing'
    INVENTORY = 'inventory'
    REVIEWS = 'reviews'


class Recommendation(BaseModel):
    recommendation_id: str = Field(default_factory=lambda: str(uuid4())[:8])
    category: RecommendationCategory
    priority: int = Field(ge=1, le=5)
    impact_score: int = Field(ge=1, le=100)
    urgency: str
    title: str
    title_zh: str
    description: str
    description_zh: str
    expected_outcome: str
    risk_level: RiskLevel
    execution_plan: dict = Field(default_factory=dict)
    rollback_available: bool = True
