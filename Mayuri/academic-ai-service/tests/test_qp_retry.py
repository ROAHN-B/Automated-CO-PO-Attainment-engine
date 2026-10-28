
import asyncio

import pytest

from app.core.errors import LlmOutputError
from app.pipelines.qp_validation.pipeline import validate_question_paper
from app.schemas.qp_validation import QpValidateRequest
from conftest import ScriptedLLM


def test_qp_retries_once_after_invalid_json():
    async def run_test():
        llm = ScriptedLLM(
            "not valid json",
            "still not valid json",
        )

        request = QpValidateRequest.model_validate({
            "validationId": "validation-1",
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
                    "maxMarks": 10,
                    "durationMinutes": 60,
                },
                "courseOutcomes": [{
                    "coId": "co-1",
                    "code": "CO1",
                    "statement": "Explain network security models.",
                }],
                "bloomKeywords": {
                    "REMEMBER": ["define", "list"],
                    "UNDERSTAND": ["explain", "describe"],
                    "APPLY": ["apply", "use"],
                    "ANALYZE": ["analyze", "compare"],
                    "EVALUATE": ["evaluate", "justify"],
                    "CREATE": ["design", "develop"],
                },
                "subQuestions": [{
                    "questionNo": "Q1",
                    "partLabel": None,
                    "label": "a",
                    "text": "Explain a network security model.",
                    "type": "DESCRIPTIVE",
                    "options": [],
                    "marks": 10,
                    "coId": "co-1",
                    "expectedBloomLevel": "UNDERSTAND",
                }],
            },
        })

        with pytest.raises(LlmOutputError):
            await validate_question_paper(
                request,
                llm=llm,
                model_used="scripted",
                retries=1,
            )

        assert len(llm.calls) == 2
        assert all(
            call["response_format"] == "json"
            for call in llm.calls
        )
        assert "YOUR PREVIOUS ANSWER WAS REJECTED" in llm.prompts[1]

    asyncio.run(run_test())


def test_qp_recovers_after_one_invalid_response():
    async def run_test():
        valid_response = {
            "summary": "Validation completed.",
            "suggestions": [
                {
                    "questionNo": "Q1",
                    "partLabel": None,
                    "label": "a",
                    "coAlignment": "ALIGNED",
                    "detectedBloomLevel": "UNDERSTAND",
                    "mcqCheck": None,
                    "aiAnalysis": "The question asks the student to explain a network security model.",
                    "flags": [],
                }
            ],
        }

        llm = ScriptedLLM(
            "not valid json",
            valid_response,
        )

        request = QpValidateRequest.model_validate({
            "validationId": "validation-1",
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
                    "maxMarks": 10,
                    "durationMinutes": 60,
                },
                "courseOutcomes": [{
                    "coId": "co-1",
                    "code": "CO1",
                    "statement": "Explain network security models.",
                }],
                "bloomKeywords": {
                    "REMEMBER": ["define", "list"],
                    "UNDERSTAND": ["explain", "describe"],
                    "APPLY": ["apply", "use"],
                    "ANALYZE": ["analyze", "compare"],
                    "EVALUATE": ["evaluate", "justify"],
                    "CREATE": ["design", "develop"],
                },
                "subQuestions": [{
                    "questionNo": "Q1",
                    "partLabel": None,
                    "label": "a",
                    "text": "Explain a network security model.",
                    "type": "DESCRIPTIVE",
                    "options": [],
                    "marks": 10,
                    "coId": "co-1",
                    "expectedBloomLevel": "UNDERSTAND",
                }],
            },
        })

        result = await validate_question_paper(
            request,
            llm=llm,
            model_used="scripted",
            retries=1,
        )

        assert len(llm.calls) == 2
        assert result.summary == "Validation completed."
        assert len(result.sub_questions) == 1
        assert result.sub_questions[0].co_alignment == "ALIGNED"

    asyncio.run(run_test())
