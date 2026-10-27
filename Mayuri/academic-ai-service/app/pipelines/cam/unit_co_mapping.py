
import json
from typing import Any

from pydantic import ValidationError

from app.core.config import settings
from app.core.errors import LlmOutputError
from app.pipelines.cam.context_checks import CheckedContext, check_context
from app.pipelines.llm_json import generate_validated
from app.prompts.cam.unit_co_mapping import (
    UNIT_CO_MAPPING_OUTPUT_FORMAT,
    UNIT_CO_MAPPING_SYSTEM_PROMPT,
)
from app.schemas.cam import UnitCoSuggestion
from app.schemas.cam_context import CamSuggestionContext
from app.services.llm.base import BaseLLMProvider


class UnitCoMappingPipeline:
    """Stage 1: suggest which syllabus units teach which course outcomes."""

    STAGE = "UNIT_CO_MAPPING"

    def __init__(self, llm_provider: BaseLLMProvider, retries: int | None = None):
        self.llm_provider = llm_provider
        self.retries = settings.llm_output_retries if retries is None else retries

    def build_prompt(self, context: CamSuggestionContext) -> str:
        inputs = context.inputs
        selected = set(context.co_ids) if context.co_ids is not None else None

        # Stage 1 reads only the objectives, the COs in scope and the units.
        academic_context = {
            "course": context.course.model_dump(by_alias=True),
            "courseObjectives": inputs.course_objectives,
            "courseOutcomes": [
                co.model_dump(by_alias=True)
                for co in inputs.course_outcomes
                if selected is None or co.co_id in selected
            ],
            "units": [unit.model_dump(by_alias=True, exclude_none=True) for unit in inputs.units],
        }

        return (
            "Use the following academic context to suggest unit-to-CO mappings.\n\n"
            "ACADEMIC CONTEXT:\n"
            f"{json.dumps(academic_context, indent=2, ensure_ascii=False)}\n\n"
            f"{UNIT_CO_MAPPING_OUTPUT_FORMAT}"
        )

    async def generate_suggestions(self, context: CamSuggestionContext) -> list[dict]:
        """Return validated suggestions as camelCase dicts."""

        checked = check_context(context, self.STAGE)
        if not checked.selected_co_ids:
            return []

        return await generate_validated(
            self.llm_provider,
            prompt=self.build_prompt(context),
            system_instruction=UNIT_CO_MAPPING_SYSTEM_PROMPT,
            validate=lambda raw: self.validate_suggestions(raw, checked),
            retries=self.retries,
        )

    @staticmethod
    def validate_suggestions(raw: list[Any], checked: CheckedContext) -> list[dict]:
        validated_suggestions = []
        seen_mappings = set()

        for suggestion in raw:
            if not isinstance(suggestion, dict):
                raise LlmOutputError("Each suggestion must be a JSON object.")

            try:
                validated = UnitCoSuggestion.model_validate(suggestion)
            except ValidationError as exc:
                raise LlmOutputError("The LLM returned a suggestion with invalid fields.") from exc

            if validated.unit_number not in checked.unit_numbers:
                raise LlmOutputError(f"The LLM returned an unknown unit number: {validated.unit_number}.")

            if validated.co_id not in checked.selected_co_ids:
                raise LlmOutputError(f"The LLM returned an invalid or unselected CO ID: {validated.co_id}.")

            mapping_key = (validated.unit_number, validated.co_id)
            if mapping_key in seen_mappings:
                raise LlmOutputError("The LLM returned a duplicate unit-to-CO mapping.")
            seen_mappings.add(mapping_key)

            validated_suggestions.append(validated.model_dump(by_alias=True))

        return validated_suggestions
