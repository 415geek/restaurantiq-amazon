from __future__ import annotations

from pathlib import Path

from app.models.agent_config import PipelineConfig


class PipelineStore:
    """将当前 pipeline 持久化到本地运行时文件，避免服务重启后丢失。"""

    def __init__(self) -> None:
        root = Path(__file__).resolve().parents[2]
        self._dir = root / '.runtime' / 'pipelines'
        self._path = self._dir / 'current_pipeline.json'

    async def load(self) -> PipelineConfig | None:
        if not self._path.exists():
            return None
        return PipelineConfig.model_validate_json(self._path.read_text(encoding='utf-8'))

    async def save(self, config: PipelineConfig) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)
        self._path.write_text(config.model_dump_json(indent=2), encoding='utf-8')
