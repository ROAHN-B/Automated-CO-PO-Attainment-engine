
from abc import ABC, abstractmethod
from typing import Literal


class BaseLLMProvider(ABC):
    """Common interface for all supported LLM providers."""

    model_name: str

    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        *,
        system_instruction: str | None = None,
        temperature: float = 0.2,
        response_format: Literal["text", "json"] = "text",
    ) -> str:
        """Generate text from a prompt.

        Args:
            prompt: The main prompt sent to the model.
            system_instruction: Optional instructions governing the response.
            temperature: Controls the randomness of the output.
            response_format: "json" asks the provider for a JSON-only answer.

        Returns:
            The generated text.

        Raises:
            LlmUnavailableError: the provider failed or refused the call.
            LlmTimeoutError: the provider didn't answer in time.
            LlmOutputError: the provider answered with nothing usable.
        """
        raise NotImplementedError
