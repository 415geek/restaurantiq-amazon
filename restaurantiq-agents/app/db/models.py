from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class PipelineRecord(Base):
    __tablename__ = 'pipelines'

    pipeline_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    restaurant_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default='')
    payload: Mapped[dict] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExecutionAuditRecord(Base):
    __tablename__ = 'execution_audits'

    execution_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    restaurant_id: Mapped[str] = mapped_column(String(128), index=True)
    agent_id: Mapped[str] = mapped_column(String(64), index=True)
    action_type: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), default='pending')
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
