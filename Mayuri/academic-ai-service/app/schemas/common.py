
from datetime import datetime, timezone
from typing import Generic, TypeVar

from pydantic import BaseModel, Field, ConfigDict


T = TypeVar("T")


def current_timestamp() -> datetime:
    return datetime.now(timezone.utc)


class ApiResponse(BaseModel, Generic[T]):
    """Standard response envelope for the Academic AI Service."""

    success: bool
    data: T | None = None
    message: str | None = None
    error_code: str | None = Field(default=None, alias="errorCode")
    timestamp: datetime = Field(default_factory=current_timestamp)

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )


class ApiError(BaseModel):
    """Standard error response."""

    success: bool = False
    error_code: str = Field(alias="errorCode")
    message: str
    field_errors: dict[str, str] | None = Field(
        default=None,
        alias="fieldErrors",
    )
    trace_id: str | None = Field(default=None, alias="traceId")
    timestamp: datetime = Field(default_factory=current_timestamp)

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )
