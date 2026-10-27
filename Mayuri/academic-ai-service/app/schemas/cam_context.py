
"""The suggestion context Spring Boot sends for both CAM stages (API_CONTRACT §9.5)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

CourseType = Literal[
    "CORE", "PROGRAM_ELECTIVE", "OPEN_ELECTIVE", "SKILL_BASED", "SELF_LEARNING", "SEMINAR",
    "MINI_PROJECT", "PROJECT", "INTERNSHIP", "FIELD_PROJECT", "DISSERTATION", "MOOC", "OTHER",
]

STRICT = ConfigDict(populate_by_name=True, extra="forbid")


class CamCourseRef(BaseModel):
    syllabus_course_id: str = Field(alias="syllabusCourseId")
    course_code: str = Field(alias="courseCode")
    course_name: str = Field(alias="courseName")
    course_type: CourseType = Field(alias="courseType")
    assessment_scheme: Literal["THEORY", "PRACTICAL"] = Field(alias="assessmentScheme")

    model_config = STRICT


class CamInputCourseOutcome(BaseModel):
    # The context carries saved inputs, so every ID is filled in.
    co_id: str = Field(alias="coId", min_length=1)
    code: str
    statement: str

    model_config = STRICT


class CamInputUnit(BaseModel):
    unit_number: int = Field(alias="unitNumber", ge=1)
    title: str
    content: str
    hours: float | None = Field(default=None, ge=0)

    model_config = STRICT


class CamInputProgramOutcome(BaseModel):
    outcome_id: str = Field(alias="outcomeId", min_length=1)
    kind: Literal["PO", "PSO"]
    code: str
    title: str | None = None
    statement: str

    model_config = STRICT


class CamInputItem(BaseModel):
    item_id: str = Field(alias="itemId", min_length=1)
    title: str
    description: str | None = None
    co_ids: list[str] = Field(alias="coIds")

    model_config = STRICT


class CamInputs(BaseModel):
    course_objectives: list[str] = Field(alias="courseObjectives")
    course_outcomes: list[CamInputCourseOutcome] = Field(alias="courseOutcomes")
    units: list[CamInputUnit]
    program_outcomes: list[CamInputProgramOutcome] = Field(alias="programOutcomes")
    activities: list[CamInputItem]
    practicals: list[CamInputItem]
    tutorials: list[CamInputItem]

    model_config = STRICT

    def items(self) -> list[CamInputItem]:
        return [*self.activities, *self.practicals, *self.tutorials]


class CamUnitCoLink(BaseModel):
    unit_number: int = Field(alias="unitNumber", ge=1)
    co_id: str = Field(alias="coId")
    source: Literal["FACULTY", "AI_ACCEPTED", "AI_EDITED"]
    suggestion_id: str | None = Field(default=None, alias="suggestionId")

    model_config = STRICT


class CamRubricLevel(BaseModel):
    level: Literal[1, 2, 3] | None
    label: str
    meaning: str

    model_config = STRICT


class CamScoringRubric(BaseModel):
    rubric_id: str = Field(alias="rubricId")
    version: int = Field(ge=1)
    status: Literal["PROPOSED", "OFFICIAL"]
    levels: list[CamRubricLevel]
    rules: list[str]

    model_config = STRICT


class CamSuggestionContext(BaseModel):
    """One shape for both stages; `unitLinks` and `rubric` belong to stage 2 only."""

    stage: Literal["UNIT_CO_MAPPING", "CO_PO_CORRELATION"]
    offering_id: str = Field(alias="offeringId")
    course: CamCourseRef
    inputs: CamInputs
    co_ids: list[str] | None = Field(default=None, alias="coIds")
    unit_links: list[CamUnitCoLink] | None = Field(default=None, alias="unitLinks")
    rubric: CamScoringRubric | None = None

    model_config = STRICT

    @model_validator(mode="after")
    def check_stage_fields(self):
        if self.stage == "CO_PO_CORRELATION":
            if self.unit_links is None:
                raise ValueError("unitLinks is required for the CO_PO_CORRELATION stage.")
            if self.rubric is None:
                raise ValueError("rubric is required for the CO_PO_CORRELATION stage.")
        elif self.unit_links is not None or self.rubric is not None:
            raise ValueError("unitLinks and rubric are only allowed for the CO_PO_CORRELATION stage.")
        return self
