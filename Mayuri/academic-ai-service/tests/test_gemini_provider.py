
"""Gemini provider: request settings and error mapping, with the SDK client mocked."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from google.genai import errors

from app.core.errors import LlmOutputError, LlmTimeoutError, LlmUnavailableError
from app.services.llm.providers.gemini import GeminiProvider


def provider_with(generate):
    with patch("app.services.llm.providers.gemini.genai.Client") as client_cls:
        client = MagicMock()
        client.aio.models.generate_content = generate
        client_cls.return_value = client
        provider = GeminiProvider(model_name="gemini-test", timeout_seconds=12)
    return provider, client_cls


def test_client_gets_the_timeout_in_milliseconds():
    _, client_cls = provider_with(AsyncMock())
    http_options = client_cls.call_args.kwargs["http_options"]
    assert http_options.timeout == 12000


def test_temperature_json_mode_and_system_instruction_are_sent():
    generate = AsyncMock(return_value=SimpleNamespace(text='{"suggestions": []}'))
    provider, _ = provider_with(generate)

    text = asyncio.run(provider.generate_text("p", system_instruction="s", temperature=0.1, response_format="json"))

    assert text == '{"suggestions": []}'
    config = generate.call_args.kwargs["config"]
    assert config.temperature == 0.1
    assert config.response_mime_type == "application/json"
    assert config.system_instruction == "s"
    assert generate.call_args.kwargs["model"] == "gemini-test"


def test_plain_text_mode_sets_no_mime_type():
    generate = AsyncMock(return_value=SimpleNamespace(text="Hello"))
    provider, _ = provider_with(generate)
    asyncio.run(provider.generate_text("p"))
    assert generate.call_args.kwargs["config"].response_mime_type is None


@pytest.mark.parametrize(
    ("raised", "expected"),
    [
        (httpx.ReadTimeout("slow"), LlmTimeoutError),
        (errors.ServerError(503, {"error": {"message": "overloaded"}}), LlmUnavailableError),
        (errors.ClientError(429, {"error": {"message": "quota"}}), LlmUnavailableError),
        (httpx.ConnectError("offline"), LlmUnavailableError),
    ],
)
def test_sdk_failures_map_to_contract_errors(raised, expected):
    provider, _ = provider_with(AsyncMock(side_effect=raised))
    with pytest.raises(expected) as info:
        asyncio.run(provider.generate_text("p"))
    # The caller-facing message never carries the provider's raw error; the cause keeps it.
    assert "quota" not in info.value.message and "overloaded" not in info.value.message
    assert info.value.__cause__ is raised


def test_empty_answer_is_an_output_error():
    provider, _ = provider_with(AsyncMock(return_value=SimpleNamespace(text="")))
    with pytest.raises(LlmOutputError, match="empty"):
        asyncio.run(provider.generate_text("p"))
