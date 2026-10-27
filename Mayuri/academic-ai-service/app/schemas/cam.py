
"""Suggestion payloads returned to Spring Boot (API_CONTRACT §9.3)."""

from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import current_timestamp


def generate_id() -> str:
    return str(uuid4())


class AiProvenance(BaseModel):
    """Metadata identifying the AI model and prompt template used (API_CONTRACT §2.9)."""

    model_used: str = Field(alias="modelUsed")
    template_id: str = Field(alias="templateId")
    template_version: str = Field(alias="templateVersion")
    generated_at: datetime = Field(default_factory=current_timestamp, alias="generatedAt")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class UnitCoSuggestion(BaseModel):
    """A single AI-generated unit-to-CO mapping suggestion."""

    suggestion_id: str = Field(default_factory=generate_id, alias="suggestionId")
    unit_number: int = Field(alias="unitNumber", ge=1)
    co_id: str = Field(alias="coId")
    rationale: str = Field(min_length=1)
    needs_review: bool = Field(alias="needsReview")
    review_note: str | None = Field(default=None, alias="reviewNote")
    confidence: float | None = Field(default=None, ge=0, le=1)

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class UnitCoSuggestionSet(AiProvenance):
    """Stage 1 result (CAM-5). Provenance fields sit on the set itself, as in the contract."""

    suggestion_set_id: str = Field(default_factory=generate_id, alias="suggestionSetId")
    based_on_cam_version: int = Field(alias="basedOnCamVersion", ge=1)
    suggestions: list[UnitCoSuggestion]


class CamSuggestionEvidence(BaseModel):
    """Academic evidence supporting a CO-to-PO/PSO suggestion."""

    unit_numbers: list[int] = Field(alias="unitNumbers")
    item_ids: list[str] = Field(alias="itemIds")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class CamSuggestion(BaseModel):
    """A single AI-generated CO-to-PO/PSO correlation suggestion."""

    suggestion_id: str = Field(default_factory=generate_id, alias="suggestionId")
    co_id: str = Field(alias="coId")
    outcome_id: str = Field(alias="outcomeId")
    suggested_level: Literal[1, 2, 3] | None = Field(default=None, alias="suggestedLevel")
    rationale: str = Field(min_length=1)
    evidence: CamSuggestionEvidence
    needs_review: bool = Field(alias="needsReview")
    review_note: str | None = Field(default=None, alias="reviewNote")
    confidence: float | None = Field(default=None, ge=0, le=1)

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class CamSuggestionSet(AiProvenance):
    """Stage 2 result (CAM-4)."""

    suggestion_set_id: str = Field(default_factory=generate_id, alias="suggestionSetId")
    based_on_cam_version: int = Field(alias="basedOnCamVersion", ge=1)
    rubric_version: int = Field(alias="rubricVersion")
    suggestions: list[CamSuggestion]
