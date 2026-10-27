
"""Ask the LLM for JSON, validate it, and retry once with the reason when it's unusable."""

import json
import re
from collections.abc import Callable
from typing import Any

from app.core.errors import LlmOutputError
from app.services.llm.base import BaseLLMProvider

_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)


def parse_suggestions_object(text: str) -> dict:
    """Parse the model's answer into {"suggestions": [...]}, tolerating a Markdown fence."""

    fenced = _FENCE.match(text)
    if fenced:
        text = fenced.group(1)

    try:
        result = json.loads(text)
    except (json.JSONDecodeError, TypeError) as exc:
        raise LlmOutputError("The LLM returned invalid JSON.") from exc

    if not isinstance(result, dict) or not isinstance(result.get("suggestions"), list):
        raise LlmOutputError("The LLM response must be a JSON object with a suggestions list.")

    return result


async def generate_validated(
    llm: BaseLLMProvider,
    *,
    prompt: str,
    system_instruction: str,
    validate: Callable[[list[Any]], list[dict]],
    retries: int,
) -> list[dict]:
    """Call the LLM and return validated suggestions.

    `validate` receives the raw suggestions list and raises LlmOutputError when the
    answer breaks a rule. On such an error the LLM is asked again, up to `retries`
    more times, with the reason appended. Provider errors are never retried here.
    """

    attempt_prompt = prompt
    for attempt in range(retries + 1):
        response = await llm.generate_text(
            attempt_prompt,
            system_instruction=system_instruction,
            response_format="json",
        )
        try:
            return validate(parse_suggestions_object(response)["suggestions"])
        except LlmOutputError as exc:
            if attempt == retries:
                raise
            attempt_prompt = (
                f"{prompt}\n\nYOUR PREVIOUS ANSWER WAS REJECTED: {exc.message}\n"
                "Return a corrected JSON object that follows every rule above."
            )

    raise AssertionError("unreachable")
