from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


async def run_openai_json_schema(
    *,
    prompt: str,
    schema_name: str,
    schema: dict[str, Any],
    model: str | None = None,
    max_output_tokens: int = 1600,
) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.openai_api_key:
        return None

    payload = {
        'model': model or settings.default_model_balanced,
        'input': prompt,
        'max_output_tokens': max_output_tokens,
        'text': {
            'format': {
                'type': 'json_schema',
                'name': schema_name,
                'schema': schema,
            }
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                'https://api.openai.com/v1/responses',
                headers={
                    'Authorization': f'Bearer {settings.openai_api_key}',
                    'Content-Type': 'application/json',
                },
                json=payload,
            )
        if not response.is_success:
            logger.warning('OpenAI responses API failed: %s %s', response.status_code, response.text)
            return None

        data = response.json()
        output_text = data.get('output_text')
        if not output_text:
            logger.warning('OpenAI responses API returned no output_text for schema %s', schema_name)
            return None

        return json.loads(output_text)
    except Exception:
        logger.exception('OpenAI schema call failed for %s', schema_name)
        return None
