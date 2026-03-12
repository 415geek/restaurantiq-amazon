from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined


_PROMPTS_DIR = Path(__file__).resolve().parent
_ENV = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
    undefined=StrictUndefined,
)


def render_prompt(template_name: str, **context: Any) -> str:
    template = _ENV.get_template(template_name)
    return template.render(**context)
