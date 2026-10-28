
import asyncio

import pytest
from pydantic import ValidationError

from app.pipelines.qp_validation.pipeline import validate_question_paper
from app.prompts.qp_validation.validation import (
    QP_VALIDATION_SYSTEM_INSTRUCTION,
)
from app.schemas.qp_validation import QpValidateRequest
from conftest import ScriptedLLM


def build_mcq_request():
    return QpValidateRequest.model_validate(
        {
            "validationId": "mcq-validation-1",
            "basedOnVersion": 1,
            "context": {
                "course": {
                    "syllabusCourseId": "course-1",
                    "courseCode": "NS101",
                    "courseName": "Network Security",
                    "assessmentScheme": "THEORY",
                },
                "assessment": {
                    "assessmentId": "assessment-1",
                    "name": "End Semester Examination",
                    "examCategory": "ESE",
                },
                "header": {
                    "maxMarks": 1,
                    "durationMinutes": 60,
                },
                "courseOutcomes": [
                    {
                        "coId": "co-1",
                        "code": "CO1",
                        "statement": (
                            "Explain the fundamental principles of network security."
                        ),
                    },
                    {
                        "coId": "co-2",
                        "code": "CO2",
                        "statement": (
                            "Apply cryptographic techniques to protect data."
                        ),
                    },
                ],
                "bloomKeywords": {
                    "REMEMBER": ["define", "list"],
                    "UNDERSTAND": ["explain", "describe"],
                    "APPLY": ["apply", "use"],
                    "ANALYZE": ["analyze", "compare"],
                    "EVALUATE": ["evaluate", "justify"],
                    "CREATE": ["design", "develop"],
                },
                "subQuestions": [
                    {
                        "questionNo": "Q1",
                        "partLabel": None,
                        "label": "a",
                        "text": (
                            "Which security property ensures that data "
                            "has not been modified without authorization?"
                        ),
                        "type": "MCQ",
                        "options": [
                            {"key": "A", "text": "Confidentiality"},
                            {"key": "B", "text": "Integrity"},
                            {"key": "C", "text": "Availability"},
                            {"key": "D", "text": "Authentication"},
                        ],
                        "marks": 1,
                        "coId": "co-1",
                        "expectedBloomLevel": "REMEMBER",
                    }
                ],
            },
        }
    )


def test_valid_mcq_check_is_preserved():
    async def run_test():
        llm = ScriptedLLM(
            {
                "summary": "Validation completed.",
                "suggestions": [
                    {
                        "questionNo": "Q1",
                        "partLabel": None,
                        "label": "a",
                        "coAlignment": "ALIGNED",
                        "detectedBloomLevel": "REMEMBER",
                        "mcqCheck": {
                            "status": "OK",
                            "note": None,
                        },
                        "aiAnalysis": (
                            "The question assesses the meaning of data integrity."
                        ),
                        "flags": [],
                    }
                ],
            }
        )

        result = await validate_question_paper(
            build_mcq_request(),
            llm=llm,
            model_used="scripted",
            retries=1,
        )

        question = result.sub_questions[0]

        assert question.mcq_check is not None
        assert question.mcq_check.status == "OK"
        assert question.mcq_check.note is None
        assert question.co_alignment == "ALIGNED"
        assert question.flags == []

    asyncio.run(run_test())


def test_invalid_suggested_co_is_set_to_none():
    async def run_test():
        llm = ScriptedLLM(
            {
                "summary": "Validation completed.",
                "suggestions": [
                    {
                        "questionNo": "Q1",
                        "partLabel": None,
                        "label": "a",
                        "coAlignment": "ALIGNED",
                        "suggestedCoId": "co-2",
                        "detectedBloomLevel": "REMEMBER",
                        "mcqCheck": {
                            "status": "OK",
                            "note": None,
                        },
                        "aiAnalysis": (
                            "The question aligns with the assigned course outcome."
                        ),
                        "flags": [],
                    }
                ],
            }
        )

        result = await validate_question_paper(
            build_mcq_request(),
            llm=llm,
            model_used="scripted",
            retries=1,
        )

        question = result.sub_questions[0]

        assert question.co_alignment == "ALIGNED"
        assert question.suggested_co_id is None

    asyncio.run(run_test())


@pytest.mark.parametrize("option_count", [1, 7])
def test_mcq_rejects_option_count_outside_contract(option_count):
    payload = build_mcq_request().model_dump(
        by_alias=True,
        mode="json",
    )
    payload["context"]["subQuestions"][0]["options"] = [
        {"key": chr(65 + i), "text": f"Option {i + 1}"}
        for i in range(option_count)
    ]

    with pytest.raises(ValidationError):
        QpValidateRequest.model_validate(payload)


@pytest.mark.parametrize(
    "options",
    [
        [
            {"key": "A", "text": "Option one"},
            {"key": "a", "text": "Option two"},
        ],
        [
            {"key": "A", "text": "Option one"},
            {"key": " B ", "text": "   "},
        ],
        [
            {"key": "   ", "text": "Option one"},
            {"key": "B", "text": "Option two"},
        ],
    ],
)
def test_mcq_rejects_duplicate_or_blank_option_fields(options):
    payload = build_mcq_request().model_dump(
        by_alias=True,
        mode="json",
    )
    payload["context"]["subQuestions"][0]["options"] = options

    with pytest.raises(ValidationError):
        QpValidateRequest.model_validate(payload)


def test_results_preserve_original_question_order():
    async def run_test():
        request_payload = build_mcq_request().model_dump(
            by_alias=True,
            mode="json",
        )

        second_question = dict(
            request_payload["context"]["subQuestions"][0]
        )
        second_question["questionNo"] = "Q2"
        second_question["label"] = "b"
        second_question["text"] = (
            "Which property ensures data availability?"
        )

        request_payload["context"]["subQuestions"].append(second_question)
        request = QpValidateRequest.model_validate(request_payload)

        def suggestion(question_no, label):
            return {
                "questionNo": question_no,
                "partLabel": None,
                "label": label,
                "coAlignment": "ALIGNED",
                "detectedBloomLevel": "REMEMBER",
                "mcqCheck": {
                    "status": "OK",
                    "note": None,
                },
                "aiAnalysis": "The question is suitable for validation.",
                "flags": [],
            }

        llm = ScriptedLLM(
            {
                "summary": "Validation completed.",
                "suggestions": [
                    suggestion("Q2", "b"),
                    suggestion("Q1", "a"),
                ],
            }
        )

        result = await validate_question_paper(
            request,
            llm=llm,
            model_used="scripted",
            retries=1,
        )

        assert [
            (question.question_no, question.label)
            for question in result.sub_questions
        ] == [("Q1", "a"), ("Q2", "b")]

    asyncio.run(run_test())


def test_out_of_syllabus_rule_requires_explicit_syllabus_evidence():
    prompt = QP_VALIDATION_SYSTEM_INSTRUCTION

    assert "explicit syllabus content" in prompt
    assert "Course outcomes alone are not the complete syllabus" in prompt
    assert "do not assign OUT_OF_SYLLABUS" in prompt
    assert "Do not infer syllabus exclusions from missing information" in prompt
