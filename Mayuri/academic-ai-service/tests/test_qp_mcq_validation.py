
import asyncio

from app.pipelines.qp_validation.pipeline import validate_question_paper
from app.schemas.qp_validation import QpValidateRequest
from conftest import ScriptedLLM


def build_mcq_request():
    return QpValidateRequest.model_validate({
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
                    "statement": "Explain the fundamental principles of network security.",
                },
                {
                    "coId": "co-2",
                    "code": "CO2",
                    "statement": "Apply cryptographic techniques to protect data.",
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
    })


def test_valid_mcq_check_is_preserved():
    async def run_test():
        llm = ScriptedLLM({
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
        })

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
        llm = ScriptedLLM({
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
        })

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
