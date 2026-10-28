
"""Question Paper Validation schemas (API_CONTRACT §10.6 and §10.7.8)."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import current_timestamp


STRICT = ConfigDict(
    populate_by_name=True,
    serialize_by_alias=True,
    extra="forbid",
)

BloomLevel = Literal[
    "REMEMBER", "UNDERSTAND", "APPLY",
    "ANALYZE", "EVALUATE", "CREATE",
]

ExamCategory = Literal["ISE", "ESE"]
QuestionType = Literal["DESCRIPTIVE", "MCQ"]

CoAlignment = Literal["ALIGNED", "PARTIAL", "MISALIGNED"]
McqCheckStatus = Literal["OK", "ISSUE"]

QuestionFlag = Literal[
    "AMBIGUOUS_WORDING",
    "OUT_OF_SYLLABUS",
    "MULTIPLE_PARTS_IN_ONE",
    "TOO_LONG_FOR_MARKS",
]


# Request schemas

class QpCourseRef(BaseModel):
    syllabus_course_id: str = Field(alias="syllabusCourseId", min_length=1)
    course_code: str = Field(alias="courseCode", min_length=1)
    course_name: str = Field(alias="courseName", min_length=1)
    assessment_scheme: Literal["THEORY"] = Field(alias="assessmentScheme")

    model_config = STRICT


class QpAssessmentContext(BaseModel):
    assessment_id: str = Field(alias="assessmentId", min_length=1)
    name: str = Field(min_length=1)
    exam_category: ExamCategory = Field(alias="examCategory")

    model_config = STRICT


class QpPaperHeader(BaseModel):
    set_label: str | None = Field(default=None, alias="setLabel")
    max_marks: float = Field(alias="maxMarks", gt=0)
    duration_minutes: int | None = Field(
        default=None, alias="durationMinutes", gt=0
    )
    exam_date: date | None = Field(default=None, alias="examDate")

    model_config = STRICT


class QpContextCourseOutcome(BaseModel):
    co_id: str = Field(alias="coId", min_length=1)
    code: str = Field(min_length=1)
    statement: str = Field(min_length=1)

    model_config = STRICT


class QpBloomKeywordMap(BaseModel):
    REMEMBER: list[str]
    UNDERSTAND: list[str]
    APPLY: list[str]
    ANALYZE: list[str]
    EVALUATE: list[str]
    CREATE: list[str]

    model_config = STRICT


class QpMcqOption(BaseModel):
    key: str = Field(min_length=1)
    text: str = Field(min_length=1)

    model_config = STRICT


class QpContextSubQuestion(BaseModel):
    question_no: str = Field(alias="questionNo", min_length=1)
    part_label: str | None = Field(default=None, alias="partLabel")
    label: str = Field(min_length=1)
    heading: str | None = None
    text: str = Field(min_length=1)
    type: QuestionType
    options: list[QpMcqOption] | None = None
    marks: float = Field(gt=0)
    co_id: str = Field(alias="coId", min_length=1)
    expected_bloom_level: BloomLevel = Field(alias="expectedBloomLevel")

    model_config = STRICT

    @model_validator(mode="after")
    def validate_options(self):
        if self.type == "MCQ":
            if not self.options or len(self.options) < 2:
                raise ValueError("MCQs must contain at least two options.")
        elif self.options:
            raise ValueError("Options are only allowed for MCQs.")
        return self


class QpValidationContext(BaseModel):
    course: QpCourseRef
    assessment: QpAssessmentContext
    header: QpPaperHeader
    course_outcomes: list[QpContextCourseOutcome] = Field(
        alias="courseOutcomes", min_length=1
    )
    bloom_keywords: QpBloomKeywordMap = Field(alias="bloomKeywords")
    sub_questions: list[QpContextSubQuestion] = Field(
        alias="subQuestions", min_length=1
    )

    model_config = STRICT

    @model_validator(mode="after")
    def validate_context_references(self):
        co_ids = [co.co_id for co in self.course_outcomes]

        if len(co_ids) != len(set(co_ids)):
            raise ValueError("courseOutcomes must not contain duplicate coIds.")

        if any(
            question.co_id not in set(co_ids)
            for question in self.sub_questions
        ):
            raise ValueError("Every sub-question coId must reference a selected CO.")

        question_keys = [
            (q.question_no, q.part_label, q.label)
            for q in self.sub_questions
        ]
        if len(question_keys) != len(set(question_keys)):
            raise ValueError("Sub-question identity keys must be unique.")

        return self


class QpValidateRequest(BaseModel):
    validation_id: str = Field(alias="validationId", min_length=1)
    based_on_version: int = Field(alias="basedOnVersion", ge=1)
    context: QpValidationContext

    model_config = STRICT


# AI response schemas

class QpAiProvenance(BaseModel):
    model_used: str = Field(alias="modelUsed", min_length=1)
    template_id: str | None = Field(default=None, alias="templateId")
    template_version: str | None = Field(
        default=None, alias="templateVersion"
    )
    generated_at: datetime = Field(
        default_factory=current_timestamp, alias="generatedAt"
    )

    model_config = STRICT


class QpMcqCheck(BaseModel):
    status: McqCheckStatus
    note: str | None = None

    model_config = STRICT


class QpSubQuestionAnalysis(BaseModel):
    question_no: str = Field(alias="questionNo", min_length=1)
    part_label: str | None = Field(default=None, alias="partLabel")
    label: str = Field(min_length=1)

    co_alignment: CoAlignment = Field(alias="coAlignment")
    suggested_co_id: str | None = Field(default=None, alias="suggestedCoId")
    detected_bloom_level: BloomLevel = Field(alias="detectedBloomLevel")

    mcq_check: QpMcqCheck | None = Field(default=None, alias="mcqCheck")
    ai_analysis: str = Field(alias="aiAnalysis", min_length=1)
    flags: list[QuestionFlag] | None = None

    model_config = STRICT


class QpAiAnalysis(QpAiProvenance):
    based_on_version: int = Field(alias="basedOnVersion", ge=1)
    summary: str | None = None
    sub_questions: list[QpSubQuestionAnalysis] = Field(
        alias="subQuestions", min_length=1
    )
