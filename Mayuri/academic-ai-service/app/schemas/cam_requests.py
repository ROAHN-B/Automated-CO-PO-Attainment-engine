
"""Request bodies for the internal CAM endpoints that Spring Boot calls."""

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.cam_context import CamSuggestionContext


class CamSuggestionRequest(BaseModel):
    """Body for both stages: the saved CAM context plus the CAM version it came from."""

    context: CamSuggestionContext
    based_on_cam_version: int = Field(
        alias="basedOnCamVersion",
        ge=1,
        description=(
            "Saved CAM version represented by the context. Recorded in the response; "
            "Spring Boot verifies it against persisted state before calling this service."
        ),
    )

    model_config = ConfigDict(populate_by_name=True, extra="forbid")
