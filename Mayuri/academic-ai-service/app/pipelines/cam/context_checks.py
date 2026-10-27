
"""Checks on the caller's context, run before any LLM call. Failures are the caller's (400)."""

from dataclasses import dataclass

from app.core.errors import InvalidContextError
from app.schemas.cam_context import CamSuggestionContext


@dataclass(frozen=True)
class CheckedContext:
    co_ids: set[str]
    selected_co_ids: set[str]
    unit_numbers: set[int]
    outcome_ids: set[str]
    item_co_ids: dict[str, set[str]]


def _duplicates(values: list) -> list:
    seen, dupes = set(), []
    for v in values:
        if v in seen and v not in dupes:
            dupes.append(v)
        seen.add(v)
    return dupes


def check_context(context: CamSuggestionContext, expected_stage: str) -> CheckedContext:
    if context.stage != expected_stage:
        raise InvalidContextError(f"This endpoint expects stage {expected_stage}, not {context.stage}.")

    inputs = context.inputs
    co_ids = [co.co_id for co in inputs.course_outcomes]
    unit_numbers = [unit.unit_number for unit in inputs.units]
    outcome_ids = [o.outcome_id for o in inputs.program_outcomes]
    item_ids = [item.item_id for item in inputs.items()]

    for label, values in (
        ("CO IDs", co_ids),
        ("unit numbers", unit_numbers),
        ("PO/PSO outcome IDs", outcome_ids),
        ("evidence item IDs", item_ids),
    ):
        dupes = _duplicates(values)
        if dupes:
            raise InvalidContextError(f"Duplicate {label} are not allowed: {dupes}")

    if not co_ids:
        raise InvalidContextError("The context has no course outcomes.")
    if not unit_numbers:
        raise InvalidContextError("The context has no units.")

    known_cos = set(co_ids)
    item_co_ids: dict[str, set[str]] = {}
    for item in inputs.items():
        unknown = set(item.co_ids) - known_cos
        if unknown:
            raise InvalidContextError(f"Evidence item '{item.item_id}' contains unknown CO IDs: {sorted(unknown)}")
        item_co_ids[item.item_id] = set(item.co_ids)

    if context.co_ids is not None:
        dupes = _duplicates(context.co_ids)
        if dupes:
            raise InvalidContextError(f"Duplicate CO IDs are not allowed in coIds: {dupes}")
        unknown = set(context.co_ids) - known_cos
        if unknown:
            raise InvalidContextError(f"Unknown CO IDs in coIds: {sorted(unknown)}")

    return CheckedContext(
        co_ids=known_cos,
        selected_co_ids=set(context.co_ids) if context.co_ids is not None else known_cos,
        unit_numbers=set(unit_numbers),
        outcome_ids=set(outcome_ids),
        item_co_ids=item_co_ids,
    )
