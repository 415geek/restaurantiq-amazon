from __future__ import annotations

from fastapi import Header, HTTPException, status

from app.config import get_settings


async def require_internal_api_key(x_orchestrator_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    configured_key = settings.internal_api_key
    if not configured_key:
        return
    if x_orchestrator_key != configured_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='invalid_orchestrator_key',
        )
