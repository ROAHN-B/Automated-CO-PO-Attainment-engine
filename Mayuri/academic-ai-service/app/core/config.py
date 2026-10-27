
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables (see .env.example)."""

    gemini_api_key: str
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.5-flash"
    llm_timeout_seconds: float = 60
    # How many extra attempts a pipeline makes when the LLM returns unusable output.
    llm_output_retries: int = 1
    # Shared secret expected in the X-Internal-Token header. Empty disables the check (local development only).
    internal_api_token: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
