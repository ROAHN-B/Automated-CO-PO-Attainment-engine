
import json
from typing import Any

from pydantic import ValidationError

from app.core.config import settings
from app.core.errors import InvalidContextError, LlmOutputError, PreconditionFailedError
from app.pipelines.cam.context_checks import CheckedContext, check_context
from app.pipelines.llm_json import generate_validated
from app.prompts.cam.co_po_correlation import (
    CO_PO_CORRELATION_OUTPUT_FORMAT,
    CO_PO_CORRELATION_SYSTEM_PROMPT,
)
from app.schemas.cam import CamSuggestion
from app.schemas.cam_context import CamSuggestionContext
from app.services.llm.base import BaseLLMProvider


class CoPoCorrelationPipeline:
    """Stage 2: suggest CO-to-PO/PSO correlation levels from the confirmed unit mapping."""

    STAGE = "CO_PO_CORRELATION"

    def __init__(self, llm_provider: BaseLLMProvider, retries: int | None = None):
        self.llm_provider = llm_provider
        self.retries = settings.llm_output_retries if retries is None else retries

    def build_prompt(self, context: CamSuggestionContext) -> str:
        prompt_context = context.model_copy(deep=True)

        if prompt_context.co_ids is not None:
            selected_co_ids = set(prompt_context.co_ids)
            prompt_context.inputs.course_outcomes = [
                co for co in prompt_context.inputs.course_outcomes if co.co_id in selected_co_ids
            ]

        academic_context = prompt_context.model_dump(by_alias=True, exclude_none=True)

        return (
            "Use the supplied academic context to suggest CO-to-PO/PSO "
            "correlation levels. Follow the supplied scoring rubric.\n\n"
            "ACADEMIC CONTEXT:\n"
            f"{json.dumps(academic_context, indent=2, ensure_ascii=False)}\n\n"
            f"{CO_PO_CORRELATION_OUTPUT_FORMAT}"
        )

    async def generate_suggestions(self, context: CamSuggestionContext) -> list[dict]:
        """Return validated suggestions as camelCase dicts."""

        checked = check_context(context, self.STAGE)
        mapping_pairs = self._check_mapping(context, checked)

        if not checked.selected_co_ids:
            return []
        if not checked.outcome_ids:
            raise InvalidContextError("The context has no POs or PSOs.")

        allowed_levels = {level.level for level in context.rubric.levels if level.level is not None}

        return await generate_validated(
            self.llm_provider,
            prompt=self.build_prompt(context),
            system_instruction=CO_PO_CORRELATION_SYSTEM_PROMPT,
            validate=lambda raw: self.validate_suggestions(raw, checked, mapping_pairs, allowed_levels),
            retries=self.retries,
        )

    @staticmethod
    def _check_mapping(context: CamSuggestionContext, checked: CheckedContext) -> set[tuple[int, str]]:
        """The supplied unit mapping must be consistent and cover every selected CO.

        Whether it is *confirmed* in persisted data is Spring Boot's check; see
        docs/stage-2-integration-notes.md.
        """

        links = context.unit_links or []
        mapping_pairs = {(link.unit_number, link.co_id) for link in links}

        if len(mapping_pairs) != len(links):
            raise InvalidContextError("Duplicate confirmed unit-to-CO links are not allowed.")

        for unit_number, co_id in mapping_pairs:
            if unit_number not in checked.unit_numbers:
                raise InvalidContextError(f"The confirmed mapping contains an unknown unit number: {unit_number}.")
            if co_id not in checked.co_ids:
                raise InvalidContextError(f"The confirmed mapping contains an unknown CO ID: {co_id}.")

        linked_cos = {co_id for _, co_id in mapping_pairs}
        for co_id in sorted(checked.selected_co_ids - linked_cos):
            raise PreconditionFailedError(f"CO '{co_id}' has no confirmed unit mapping.")

        return mapping_pairs

    @staticmethod
    def validate_suggestions(
        raw: list[Any],
        checked: CheckedContext,
        mapping_pairs: set[tuple[int, str]],
        allowed_levels: set[int],
    ) -> list[dict]:
        validated_suggestions = []
        seen_pairs = set()

        for suggestion in raw:
            if not isinstance(suggestion, dict):
                raise LlmOutputError("Each suggestion must be a JSON object.")

            try:
                validated = CamSuggestion.model_validate(suggestion)
            except ValidationError as exc:
                raise LlmOutputError("The LLM returned a suggestion with invalid fields.") from exc

            if validated.co_id not in checked.selected_co_ids:
                raise LlmOutputError(f"The LLM returned an invalid or unselected CO ID: {validated.co_id}.")

            if validated.outcome_id not in checked.outcome_ids:
                raise LlmOutputError(f"The LLM returned an unknown PO/PSO outcome ID: {validated.outcome_id}.")

            if validated.suggested_level is not None and validated.suggested_level not in allowed_levels:
                raise LlmOutputError("The LLM returned a correlation level not permitted by the supplied rubric.")

            pair = (validated.co_id, validated.outcome_id)
            if pair in seen_pairs:
                raise LlmOutputError("The LLM returned a duplicate CO–PO/PSO pair.")
            seen_pairs.add(pair)

            evidence = validated.evidence
            if any(number not in checked.unit_numbers for number in evidence.unit_numbers):
                raise LlmOutputError("The LLM returned an unknown evidence unit number.")

            if any(item_id not in checked.item_co_ids for item_id in evidence.item_ids):
                raise LlmOutputError("The LLM returned an unknown evidence item ID.")

            if any((number, validated.co_id) not in mapping_pairs for number in evidence.unit_numbers):
                raise LlmOutputError("Evidence units must be linked to the suggested CO in the confirmed unit mapping.")

            if any(validated.co_id not in checked.item_co_ids[item_id] for item_id in evidence.item_ids):
                raise LlmOutputError("Evidence items must be associated with the suggested CO.")

            if validated.suggested_level is not None and not evidence.unit_numbers:
                raise LlmOutputError("Nonblank correlation suggestions must include unit evidence.")

            validated_suggestions.append(validated.model_dump(by_alias=True))

        return validated_suggestions
