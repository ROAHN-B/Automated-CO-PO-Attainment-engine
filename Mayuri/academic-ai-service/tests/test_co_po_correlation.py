
"""Stage 2 pipeline: CO-to-PO/PSO suggestions (Mayuri's original cases, on the shared fixtures)."""

import asyncio

import pytest
from conftest import ScriptedLLM, cell_suggestion, stage1_context, stage2_context

from app.core.errors import InvalidContextError, LlmOutputError, PreconditionFailedError
from app.pipelines.cam.co_po_correlation import CoPoCorrelationPipeline
from app.schemas.cam_context import CamSuggestionContext


def run(llm, context=None, retries=0):
    pipeline = CoPoCorrelationPipeline(llm, retries=retries)
    ctx = CamSuggestionContext.model_validate(context or stage2_context())
    return asyncio.run(pipeline.generate_suggestions(ctx))


def answer(*suggestions):
    return ScriptedLLM({"suggestions": list(suggestions)})


def test_valid_suggestion_is_accepted():
    llm = answer(cell_suggestion())
    result = run(llm)

    assert len(result) == 1
    assert result[0]["suggestedLevel"] == 2
    assert llm.calls[0]["response_format"] == "json"


def test_evidence_items_for_the_same_co_are_accepted():
    result = run(answer(cell_suggestion(items=["act-1"])))
    assert result[0]["evidence"]["itemIds"] == ["act-1"]


def test_null_level_without_unit_evidence_is_accepted():
    result = run(answer(cell_suggestion(level=None, units=[])))
    assert result[0]["suggestedLevel"] is None


def test_level_not_allowed_by_rubric_is_rejected():
    ctx = stage2_context()
    ctx["rubric"]["levels"] = [lvl for lvl in ctx["rubric"]["levels"] if lvl["level"] != 2]
    with pytest.raises(LlmOutputError, match="not permitted by the supplied rubric"):
        run(answer(cell_suggestion(level=2)), ctx)


@pytest.mark.parametrize(
    ("suggestion", "message"),
    [
        (cell_suggestion(units=[99]), "unknown evidence unit number"),
        (cell_suggestion(co="co-1", units=[2]), "confirmed unit mapping"),
        (cell_suggestion(co="co-1", items=["act-2"]), "associated with the suggested CO"),
        (cell_suggestion(outcome="out-unknown"), "unknown PO/PSO outcome ID"),
        (cell_suggestion(items=["act-unknown"]), "unknown evidence item ID"),
        (cell_suggestion(level=3, units=[]), "must include unit evidence"),
        (cell_suggestion(level=4), "invalid fields"),
    ],
)
def test_unusable_answers_are_llm_output_errors(suggestion, message):
    with pytest.raises(LlmOutputError, match=message):
        run(answer(suggestion))


def test_duplicate_co_po_pair_is_rejected():
    with pytest.raises(LlmOutputError, match="duplicate CO"):
        run(answer(cell_suggestion(), cell_suggestion()))


def test_invalid_json_is_rejected():
    with pytest.raises(LlmOutputError, match="invalid JSON"):
        run(ScriptedLLM("not valid JSON"))


def test_one_retry_recovers_from_an_invented_outcome():
    llm = ScriptedLLM(
        {"suggestions": [cell_suggestion(outcome="out-unknown")]},
        {"suggestions": [cell_suggestion()]},
    )
    result = run(llm, retries=1)

    assert len(result) == 1
    assert "unknown PO/PSO outcome ID" in llm.prompts[1]


def test_co_without_confirmed_mapping_is_a_precondition_failure_before_llm_call():
    ctx = stage2_context(unitLinks=[{"unitNumber": 1, "coId": "co-1", "source": "FACULTY"}])
    llm = answer(cell_suggestion())

    with pytest.raises(PreconditionFailedError, match="CO 'co-2' has no confirmed unit mapping"):
        run(llm, ctx)
    assert llm.prompts == []


def test_selected_cos_only_need_their_own_mapping():
    ctx = stage2_context(coIds=["co-1"], unitLinks=[{"unitNumber": 1, "coId": "co-1", "source": "FACULTY"}])
    result = run(answer(cell_suggestion()), ctx)
    assert len(result) == 1


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda c: c["inputs"]["activities"][0].update(coIds=["co-unknown"]), "contains unknown CO IDs"),
        (lambda c: c["inputs"]["activities"][1].update(itemId="act-1"), "Duplicate evidence item IDs"),
        (lambda c: c["unitLinks"].append(dict(c["unitLinks"][0])), "Duplicate confirmed unit-to-CO links"),
        (lambda c: c["unitLinks"].append({"unitNumber": 7, "coId": "co-1", "source": "FACULTY"}), "unknown unit number"),
        (lambda c: c["unitLinks"].append({"unitNumber": 1, "coId": "co-9", "source": "FACULTY"}), "unknown CO ID"),
        (lambda c: c["inputs"].update(programOutcomes=[]), "no POs or PSOs"),
    ],
)
def test_bad_context_is_rejected_before_llm_call(mutate, message):
    ctx = stage2_context()
    mutate(ctx)
    llm = answer(cell_suggestion())

    with pytest.raises(InvalidContextError, match=message):
        run(llm, ctx)
    assert llm.prompts == []


def test_wrong_stage_is_rejected():
    with pytest.raises(InvalidContextError, match="expects stage CO_PO_CORRELATION"):
        run(ScriptedLLM(), stage1_context())


@pytest.mark.parametrize("missing", ["unitLinks", "rubric"])
def test_stage2_context_requires_links_and_rubric(missing):
    ctx = stage2_context()
    ctx.pop(missing)
    with pytest.raises(ValueError, match=f"{missing} is required"):
        CamSuggestionContext.model_validate(ctx)


def test_prompt_only_includes_selected_cos():
    llm = answer(cell_suggestion())
    ctx = stage2_context(coIds=["co-1"], unitLinks=[{"unitNumber": 1, "coId": "co-1", "source": "FACULTY"}])
    run(llm, ctx)

    assert "Illustrate block ciphers" not in llm.prompts[0]
    assert "rubric-cam-default" in llm.prompts[0]
