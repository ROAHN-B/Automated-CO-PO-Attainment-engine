
"""Question Paper Validation pipeline."""

from typing import Any

from pydantic import ValidationError

from app.core.errors import LlmOutputError
from app.prompts.qp_validation.validation import (
    QP_VALIDATION_SYSTEM_INSTRUCTION,
    QP_VALIDATION_TEMPLATE_ID,
    QP_VALIDATION_TEMPLATE_VERSION,
    build_qp_validation_prompt,
)
from app.schemas.qp_validation import QpAiAnalysis, QpValidateRequest
from app.services.llm.base import BaseLLMProvider
from app.pipelines.llm_json import parse_suggestions_object


MULTIPLE_PARTS_EVIDENCE = (
    "unrelated tasks",
    "unrelated requirements",
    "excessive workload",
    "unreasonable workload",
    "unreasonable for the marks",
    "overloaded question",
    "overly broad question",
    "unclear expectations",
    "combines distinct tasks",
    "combines unrelated tasks",
    "too many unrelated tasks",
)


def _normalize_results(results: list[Any]) -> list[Any]:
    """Remove unsupported multiple-parts flags conservatively."""

    normalized = []

    for item in results:
        if not isinstance(item, dict):
            normalized.append(item)
            continue

        result = dict(item)
        flags = result.get("flags") or []

        analysis = str(
            result.get("aiAnalysis", result.get("ai_analysis", ""))
        ).lower()

        if (
            "MULTIPLE_PARTS_IN_ONE" in flags
            and not any(
                phrase in analysis
                for phrase in MULTIPLE_PARTS_EVIDENCE
            )
        ):
            flags = [
                flag
                for flag in flags
                if flag != "MULTIPLE_PARTS_IN_ONE"
            ]

        result["flags"] = flags
        normalized.append(result)

    return normalized


def _build_summary(results: list[Any]) -> str:
    """Build a concise summary without inventing validation findings."""

    alignments = []

    for result in results:
        if isinstance(result, dict):
            alignment = result.get(
                "coAlignment",
                result.get("co_alignment"),
            )
        else:
            alignment = None

        if alignment:
            alignments.append(alignment)

    if any(
        alignment in ("PARTIAL", "MISALIGNED")
        for alignment in alignments
    ):
        return (
            "Validation completed. Review questions with partial or "
            "misaligned course outcomes and their suggested mappings."
        )

    return (
        "Validation completed. Review the individual question analyses "
        "and any remaining validation flags."
    )


def _validate_results(
    results: list[Any],
    request: QpValidateRequest,
    model_used: str,
    summary: str | None = None,
) -> QpAiAnalysis:
    """Validate results and preserve the original question-paper order."""

    normalized_results = _normalize_results(results)

    final_summary = (
        summary.strip()
        if isinstance(summary, str) and summary.strip()
        else _build_summary(normalized_results)
    )

    try:
        analysis = QpAiAnalysis.model_validate(
            {
                "basedOnVersion": request.based_on_version,
                "summary": final_summary,
                "modelUsed": model_used,
                "templateId": QP_VALIDATION_TEMPLATE_ID,
                "templateVersion": QP_VALIDATION_TEMPLATE_VERSION,
                "subQuestions": normalized_results,
            }
        )
    except ValidationError as exc:
        raise LlmOutputError(
            "The AI service returned an invalid question-paper analysis."
        ) from exc

    # Build identities in the original request order.
    requested = {
        (q.question_no, q.part_label, q.label): q
        for q in request.context.sub_questions
    }

    returned = {
        (q.question_no, q.part_label, q.label): q
        for q in analysis.sub_questions
    }

    # Reject missing, duplicate, or unexpected question identities.
    if (
        len(returned) != len(analysis.sub_questions)
        or returned.keys() != requested.keys()
    ):
        raise LlmOutputError(
            "The AI service returned missing, duplicate, or unexpected questions."
        )

    # Contract requirement: output questions must follow input order.
    analysis.sub_questions = [
        returned[key] for key in requested
    ]

    selected_co_ids = {
        co.co_id for co in request.context.course_outcomes
    }

    for key, result in returned.items():
        source = requested[key]

        if result.suggested_co_id is not None:
            invalid_suggestion = (
                result.co_alignment == "ALIGNED"
                or result.suggested_co_id not in selected_co_ids
                or result.suggested_co_id == source.co_id
            )

            if invalid_suggestion:
                result.suggested_co_id = None

        if source.type == "MCQ" and result.mcq_check is None:
            raise LlmOutputError(
                "The AI service omitted the MCQ validation result."
            )

        if (
            source.type == "DESCRIPTIVE"
            and result.mcq_check is not None
        ):
            raise LlmOutputError(
                "The AI service returned an MCQ result for a descriptive question."
            )

    return analysis


async def validate_question_paper(
    request: QpValidateRequest,
    *,
    llm: BaseLLMProvider,
    model_used: str,
    retries: int,
) -> QpAiAnalysis:
    """Ask the LLM to validate each question and verify its response."""

    context = request.context.model_dump(
        by_alias=True,
        mode="json",
        exclude_none=True,
    )

    prompt = build_qp_validation_prompt(
        {
            "basedOnVersion": request.based_on_version,
            **context,
        }
    )

    attempt_prompt = prompt

    for attempt in range(retries + 1):
        response = await llm.generate_text(
            attempt_prompt,
            system_instruction=QP_VALIDATION_SYSTEM_INSTRUCTION,
            response_format="json",
        )

        try:
            raw_output = parse_suggestions_object(response)
            results = raw_output["suggestions"]

            return _validate_results(
                results,
                request,
                model_used,
                summary=raw_output.get("summary"),
            )

        except LlmOutputError as exc:
            if attempt == retries:
                raise

            attempt_prompt = (
                f"{prompt}\n\n"
                f"YOUR PREVIOUS ANSWER WAS REJECTED: {exc.message}\n"
                "Return a corrected JSON object that follows all required rules."
            )

    raise AssertionError("unreachable")
