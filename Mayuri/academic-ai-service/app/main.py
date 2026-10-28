
import logging
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes.cam import router as cam_router
from app.api.routes.qp_validation import router as qp_validation_router
from app.core.config import settings
from app.core.errors import AiServiceError
from app.schemas.common import ApiError, ApiResponse

logger = logging.getLogger("academic_ai_service")

app = FastAPI(
    title="Academic AI Service",
    description=(
    "Internal AI service for CAM suggestions and question-paper validation."
    ),
    version="0.2.0",
)

app.include_router(cam_router)
app.include_router(qp_validation_router)

if not settings.internal_api_token:
    logger.warning("INTERNAL_API_TOKEN is not set: the /cam endpoints accept calls without a token.")


def error_response(
    status_code: int,
    error_code: str,
    message: str,
    field_errors: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Every error leaves the service in the contract's ApiError envelope (API_CONTRACT §2.2)."""

    body = ApiError(
        error_code=error_code,
        message=message,
        field_errors=field_errors,
        trace_id=str(uuid4()),
    )
    return JSONResponse(
        status_code=status_code,
        headers=headers,
        content=body.model_dump(mode="json", by_alias=True, exclude_none=True),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    field_errors = {}

    for error in exc.errors():
        location = ".".join(str(part) for part in error["loc"] if part != "body")
        field_errors[location or "request"] = error["msg"]

    return error_response(400, "VALIDATION_FAILED", "Request validation failed.", field_errors)


@app.exception_handler(AiServiceError)
async def ai_service_exception_handler(request: Request, exc: AiServiceError):
    if exc.status_code >= 500:
        cause = f" (cause: {exc.__cause__!r})" if exc.__cause__ else ""
        logger.warning("%s on %s: %s%s", exc.error_code, request.url.path, exc.message, cause)
    return error_response(exc.status_code, exc.error_code, exc.message)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    error_code = "HTTP_ERROR"
    message = str(exc.detail)

    if isinstance(exc.detail, dict):
        error_code = exc.detail.get("errorCode", error_code)
        message = exc.detail.get("message", message)
    elif exc.status_code == 400:
        error_code = "VALIDATION_FAILED"
    elif exc.status_code == 404:
        error_code = "NOT_FOUND"

    return error_response(exc.status_code, error_code, message, headers=exc.headers)


@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception):
    logger.exception("Unexpected error on %s", request.url.path)
    return error_response(500, "INTERNAL_ERROR", "Something went wrong in the AI service.")


@app.get("/")
def root():
    return ApiResponse(success=True, message="Academic AI Service is running.")


@app.get("/health")
def health_check():
    return ApiResponse(success=True, data={"status": "healthy", "service": "academic-ai-service"})
