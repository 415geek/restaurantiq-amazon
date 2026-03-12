from __future__ import annotations

import json
from dataclasses import dataclass
from fnmatch import fnmatch
from typing import Any

try:
    from redis.asyncio import Redis
except Exception:  # pragma: no cover - redis optional at bootstrap
    Redis = None  # type: ignore[assignment]

from app.config import get_settings


@dataclass
class StoredValue:
    raw: str
    expires_at: float | None = None


class StateStore:
    """Redis 优先、内存兜底的轻量状态存储。"""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._memory: dict[str, StoredValue] = {}
        self._redis: Redis | None = None
        if Redis is not None:
            try:
                self._redis = Redis.from_url(self._settings.redis_url, decode_responses=True)
            except Exception:
                self._redis = None

    async def ping(self) -> bool:
        if self._redis is None:
            return True
        try:
            await self._redis.ping()
            return True
        except Exception:
            self._redis = None
            return True

    async def set(self, key: str, value: Any, expire: int | None = None) -> None:
        payload = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        if self._redis is not None:
            try:
                await self._redis.set(key, payload, ex=expire)
                return
            except Exception:
                self._redis = None
        self._memory[key] = StoredValue(raw=payload)

    async def get(self, key: str) -> str | None:
        if self._redis is not None:
            try:
                return await self._redis.get(key)
            except Exception:
                self._redis = None
        item = self._memory.get(key)
        return item.raw if item else None

    async def delete(self, key: str) -> None:
        if self._redis is not None:
            try:
                await self._redis.delete(key)
                return
            except Exception:
                self._redis = None
        self._memory.pop(key, None)

    async def keys(self, pattern: str) -> list[str]:
        if self._redis is not None:
            try:
                found = await self._redis.keys(pattern)
                return list(found)
            except Exception:
                self._redis = None
        return [key for key in self._memory if fnmatch(key, pattern)]

    async def list_json(self, pattern: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for key in await self.keys(pattern):
            raw = await self.get(key)
            if raw is None:
                continue
            try:
                data = json.loads(raw)
                if isinstance(data, dict):
                    rows.append(data)
            except json.JSONDecodeError:
                continue
        return rows

    async def close(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception:
                pass
