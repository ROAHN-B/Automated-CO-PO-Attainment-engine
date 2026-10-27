
"""HTTP layer: contract request/response shapes, status codes, error envelope and the internal token."""

from unittest.mock import patch

import pytest
from conftest import ScriptedLLM, cell_suggestion, stage1_context, stage2_context, unit_suggestion
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.errors import LlmTimeoutError, LlmUnavailableError
from app.main import app

STAGE1 = "/cam/unit-mapping/suggestions"
STAGE2 = "/cam/co-po-correlation/suggestions"

client = TestClient(app, raise_server_exceptions=False)


def post(path, body, llm=None, headers=None):
    with patch("app.api.routes.cam.get_llm_provider", return_value=llm or ScriptedLLM()):
        return client.post(path, json=body, headers=headers or {})


def assert_error(response, status, code):
    assert response.status_code == status, response.text
    body = response.json()
    assert body["success"] is False
    assert body["errorCode"] == code
    assert body["message"]
    assert body["traceId"] and body["timestamp"]
    return body


# --------------------------------------------------------------- success shapes


def test_stage1_accepts_the_contract_request_and_returns_the_contract_shape():
    llm = ScriptedLLM({"suggestions": [unit_suggestion(1, "co-1")]})
    response = post(STAGE1, {"context": stage1_context(), "basedOnCamVersion": 3}, llm)

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    # Provenance sits flat on the set (UnitCoSuggestionSet extends AiProvenance).
    assert {"suggestionSetId", "basedOnCamVersion", "suggestions", "modelUsed", "templateId",
            "templateVersion", "generatedAt"} <= set(data)
    assert "provenance" not in data
    assert data["basedOnCamVersion"] == 3
    assert data["templateId"] == "cam_unit_co_mapping"
    assert data["suggestions"][0]["coId"] == "co-1"


def test_stage2_records_cam_and_rubric_versions():
    llm = ScriptedLLM({"suggestions": [cell_suggestion()]})
    response = post(STAGE2, {"context": stage2_context(), "basedOnCamVersion": 5}, llm)

    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["basedOnCamVersion"] == 5
    assert data["rubricVersion"] == 2
    assert data["templateId"] == "cam_co_po_correlation"
    assert data["suggestions"][0]["evidence"] == {"unitNumbers": [1], "itemIds": []}


def test_health_and_root():
    assert client.get("/health").json()["data"]["status"] == "healthy"
    assert client.get("/").json()["success"] is True


# --------------------------------------------------------------- caller errors: 400 / 422


@pytest.mark.parametrize(
    "body",
    [
        {"context": stage2_context()},                                           # missing basedOnCamVersion
        {"context": stage2_context(), "basedOnCamVersion": 0},                   # not positive
        {"context": stage2_context(), "basedOnCamVersion": 1, "unitMappingStatus": "CONFIRMED"},  # extra field
        {"context": {**stage2_context(), "rubric": None}, "basedOnCamVersion": 1},  # stage 2 without rubric
    ],
)
def test_malformed_requests_are_400_validation_failed(body):
    body = assert_error(post(STAGE2, body), 400, "VALIDATION_FAILED")
    assert body["fieldErrors"]


def test_old_stage1_shape_is_400_with_field_errors():
    old = {"context": {"courseOutcomes": [{"coId": "CO1", "statement": "x"}],
                       "units": [{"unitNumber": 1, "title": "U", "topics": ["a"]}]}}
    body = assert_error(post(STAGE1, old), 400, "VALIDATION_FAILED")
    assert "context.stage" in body["fieldErrors"]


def test_inconsistent_context_is_400():
    assert_error(post(STAGE1, {"context": stage1_context(coIds=["co-9"]), "basedOnCamVersion": 1}),
                 400, "VALIDATION_FAILED")


def test_wrong_stage_for_endpoint_is_400():
    assert_error(post(STAGE2, {"context": stage1_context(), "basedOnCamVersion": 1}), 400, "VALIDATION_FAILED")


def test_unconfirmed_co_is_422_precondition_failed():
    ctx = stage2_context(unitLinks=[{"unitNumber": 1, "coId": "co-1", "source": "FACULTY"}])
    assert_error(post(STAGE2, {"context": ctx, "basedOnCamVersion": 1}), 422, "PRECONDITION_FAILED")


# --------------------------------------------------------------- AI failures: 502 / 503 / 504 / 500


def test_unusable_llm_output_is_502_not_the_callers_fault():
    llm = ScriptedLLM({"suggestions": [unit_suggestion(9, "co-1")]}, {"suggestions": [unit_suggestion(9, "co-1")]})
    assert_error(post(STAGE1, {"context": stage1_context(), "basedOnCamVersion": 1}, llm), 502, "AI_SERVICE_UNAVAILABLE")


def test_provider_failure_is_503():
    llm = ScriptedLLM(LlmUnavailableError("Gemini request failed: quota"))
    assert_error(post(STAGE1, {"context": stage1_context(), "basedOnCamVersion": 1}, llm), 503, "AI_SERVICE_UNAVAILABLE")


def test_provider_timeout_is_504():
    llm = ScriptedLLM(LlmTimeoutError("Gemini didn't answer in time."))
    assert_error(post(STAGE2, {"context": stage2_context(), "basedOnCamVersion": 1}, llm), 504, "UPSTREAM_TIMEOUT")


def test_unexpected_crash_is_500_in_the_envelope():
    llm = ScriptedLLM(RuntimeError("boom"))
    body = assert_error(post(STAGE1, {"context": stage1_context(), "basedOnCamVersion": 1}, llm), 500, "INTERNAL_ERROR")
    assert "boom" not in body["message"]


# --------------------------------------------------------------- internal token


def test_token_is_required_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_token", "s3cret")
    body = {"context": stage1_context(), "basedOnCamVersion": 1}

    assert_error(post(STAGE1, body), 401, "UNAUTHENTICATED")
    assert_error(post(STAGE1, body, headers={"X-Internal-Token": "wrong"}), 401, "UNAUTHENTICATED")

    ok = post(STAGE1, body, ScriptedLLM({"suggestions": []}), headers={"X-Internal-Token": "s3cret"})
    assert ok.status_code == 200


def test_health_needs_no_token(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_token", "s3cret")
    assert client.get("/health").status_code == 200
