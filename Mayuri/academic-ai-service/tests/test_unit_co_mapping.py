
"""Stage 1 pipeline: unit-to-CO suggestions."""

import asyncio

import pytest
from conftest import ScriptedLLM, stage1_context, stage2_context, unit_suggestion

from app.core.errors import InvalidContextError, LlmOutputError
from app.pipelines.cam.unit_co_mapping import UnitCoMappingPipeline
from app.schemas.cam_context import CamSuggestionContext


def run(llm, context=None, retries=1):
    pipeline = UnitCoMappingPipeline(llm, retries=retries)
    ctx = CamSuggestionContext.model_validate(context or stage1_context())
    return asyncio.run(pipeline.generate_suggestions(ctx))


def test_contract_context_is_accepted_and_valid_suggestions_returned():
    llm = ScriptedLLM({"suggestions": [unit_suggestion(1, "co-1"), unit_suggestion(2, "co-2")]})

    result = run(llm)

    assert [(s["unitNumber"], s["coId"]) for s in result] == [(1, "co-1"), (2, "co-2")]
    assert all(s["suggestionId"] for s in result)
    assert llm.calls[0]["response_format"] == "json"


def test_prompt_uses_unit_content_hours_and_co_codes_only():
    llm = ScriptedLLM({"suggestions": []})
    run(llm)
    prompt = llm.prompts[0]

    assert "OSI security architecture; classical ciphers" in prompt
    assert '"hours": 8' in prompt
    assert '"code": "CO1"' in prompt
    # Stage 1 reads COs and units only, not POs or activities.
    assert "out-po1" not in prompt
    assert "Cipher toolkit" not in prompt


def test_co_filter_limits_prompt_and_answers():
    llm = ScriptedLLM({"suggestions": [unit_suggestion(1, "co-1")]})
    result = run(llm, stage1_context(coIds=["co-1"]))

    assert "co-2" not in llm.prompts[0]
    assert result[0]["coId"] == "co-1"


def test_empty_co_filter_returns_nothing_without_calling_the_llm():
    llm = ScriptedLLM()
    assert run(llm, stage1_context(coIds=[])) == []
    assert llm.prompts == []


def test_answer_for_an_unselected_co_is_rejected():
    llm = ScriptedLLM({"suggestions": [unit_suggestion(1, "co-2")]})
    with pytest.raises(LlmOutputError, match="unselected CO ID"):
        run(llm, stage1_context(coIds=["co-1"]), retries=0)


@pytest.mark.parametrize(
    ("answer", "message"),
    [
        ("{not json", "invalid JSON"),
        ({"items": []}, "suggestions list"),
        ({"suggestions": ["text"]}, "JSON object"),
        ({"suggestions": [unit_suggestion(9, "co-1")]}, "unknown unit number"),
        ({"suggestions": [unit_suggestion(1, "co-x")]}, "unselected CO ID"),
        ({"suggestions": [unit_suggestion(1, "co-1", confidence=1.5)]}, "invalid fields"),
        ({"suggestions": [unit_suggestion(1, "co-1"), unit_suggestion(1, "co-1")]}, "duplicate"),
    ],
)
def test_unusable_answers_are_llm_output_errors(answer, message):
    llm = ScriptedLLM(answer)
    with pytest.raises(LlmOutputError, match=message):
        run(llm, retries=0)


def test_markdown_fenced_json_is_accepted():
    llm = ScriptedLLM('```json\n{"suggestions": []}\n```')
    assert run(llm) == []


def test_one_retry_with_the_rejection_reason_then_success():
    llm = ScriptedLLM(
        {"suggestions": [unit_suggestion(9, "co-1")]},
        {"suggestions": [unit_suggestion(1, "co-1")]},
    )

    result = run(llm, retries=1)

    assert len(result) == 1
    assert len(llm.prompts) == 2
    assert "YOUR PREVIOUS ANSWER WAS REJECTED" in llm.prompts[1]
    assert "unknown unit number" in llm.prompts[1]


def test_gives_up_after_the_retry():
    llm = ScriptedLLM("{bad", "{still bad")
    with pytest.raises(LlmOutputError):
        run(llm, retries=1)
    assert len(llm.prompts) == 2


@pytest.mark.parametrize(
    ("context", "message"),
    [
        (stage2_context(), "expects stage UNIT_CO_MAPPING"),
        (stage1_context(coIds=["co-1", "co-1"]), "Duplicate CO IDs"),
        (stage1_context(coIds=["co-9"]), "Unknown CO IDs"),
    ],
)
def test_bad_context_is_rejected_before_calling_the_llm(context, message):
    llm = ScriptedLLM()
    with pytest.raises(InvalidContextError, match=message):
        run(llm, context)
    assert llm.prompts == []


def test_duplicate_units_in_inputs_are_rejected():
    ctx = stage1_context()
    ctx["inputs"]["units"][1]["unitNumber"] = 1
    with pytest.raises(InvalidContextError, match="Duplicate unit numbers"):
        run(ScriptedLLM(), ctx)


def test_stage1_context_must_not_carry_stage2_fields():
    with pytest.raises(ValueError, match="only allowed for the CO_PO_CORRELATION stage"):
        CamSuggestionContext.model_validate(stage1_context(unitLinks=[]))
