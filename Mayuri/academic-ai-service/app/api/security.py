
import hmac

from fastapi import Header

from app.core.config import settings
from app.core.errors import UnauthenticatedError


async def require_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    """Only Spring Boot may call the CAM endpoints: it sends the shared INTERNAL_API_TOKEN.

    With no token configured (local development) the check is skipped; main.py logs a warning.
    """

    expected = settings.internal_api_token
    if not expected:
        return
    if not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
        raise UnauthenticatedError("Missing or invalid X-Internal-Token header.")
