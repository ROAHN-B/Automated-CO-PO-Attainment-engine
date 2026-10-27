
from functools import lru_cache

from app.core.config import settings
from app.services.llm.base import BaseLLMProvider
from app.services.llm.providers.gemini import GeminiProvider


@lru_cache(maxsize=1)
def get_llm_provider() -> BaseLLMProvider:
    """Return the configured LLM provider."""

    provider_name = settings.llm_provider.lower()

    if provider_name == "gemini":
        return GeminiProvider(
            model_name=settings.llm_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )

    raise ValueError(f"Unsupported LLM provider: {provider_name}")
