
"""Errors the service reports, mapped to API_CONTRACT.md §18 status codes and error codes."""


class AiServiceError(Exception):
    """Base error. Subclasses fix the HTTP status and errorCode."""

    status_code = 500
    error_code = "INTERNAL_ERROR"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidContextError(AiServiceError):
    """The caller sent a context that is inconsistent (unknown IDs, duplicates, wrong stage)."""

    status_code = 400
    error_code = "VALIDATION_FAILED"


class PreconditionFailedError(AiServiceError):
    """A stage precondition isn't met, e.g. a CO without a confirmed unit mapping."""

    status_code = 422
    error_code = "PRECONDITION_FAILED"


class UnauthenticatedError(AiServiceError):
    """The internal token is missing or wrong."""

    status_code = 401
    error_code = "UNAUTHENTICATED"


class LlmOutputError(AiServiceError):
    """The LLM answered, but the answer is unusable (bad JSON, invented IDs, broken rules)."""

    status_code = 502
    error_code = "AI_SERVICE_UNAVAILABLE"


class LlmUnavailableError(AiServiceError):
    """The LLM provider failed or refused the call (network, quota, server error)."""

    status_code = 503
    error_code = "AI_SERVICE_UNAVAILABLE"


class LlmTimeoutError(AiServiceError):
    """The LLM provider didn't answer in time."""

    status_code = 504
    error_code = "UPSTREAM_TIMEOUT"
