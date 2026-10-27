
from typing import Literal

import httpx
from google import genai
from google.genai import errors, types

from app.core.config import settings
from app.core.errors import LlmOutputError, LlmTimeoutError, LlmUnavailableError
from app.services.llm.base import BaseLLMProvider


class GeminiProvider(BaseLLMProvider):
    """Gemini implementation of the shared LLM provider interface."""

    def __init__(
        self,
        model_name: str = "gemini-2.5-flash",
        timeout_seconds: float = 60,
    ) -> None:
        self.model_name = model_name
        self.client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000)),
        )

    async def generate_text(
        self,
        prompt: str,
        *,
        system_instruction: str | None = None,
        temperature: float = 0.2,
        response_format: Literal["text", "json"] = "text",
    ) -> str:
        """Generate text using the Gemini API."""

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
            response_mime_type="application/json" if response_format == "json" else None,
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config,
            )
        # Messages reach Spring Boot and the UI, so they stay generic; the provider's
        # own error is kept as the cause and written to the server log.
        except httpx.TimeoutException as exc:
            raise LlmTimeoutError("The AI model didn't answer in time. Try again.") from exc
        except (errors.APIError, httpx.HTTPError) as exc:
            raise LlmUnavailableError("The AI model couldn't process the request. Try again later.") from exc

        if not response.text:
            raise LlmOutputError("Gemini returned an empty response.")

        return response.text
