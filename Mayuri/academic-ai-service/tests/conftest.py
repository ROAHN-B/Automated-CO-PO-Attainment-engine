
"""Shared test setup: a dummy API key, contract-shaped contexts and a scripted LLM."""

import copy
import json
import os

import pytest

# Settings() reads the key at import time. Unit tests never call Gemini, so a dummy key is
# enough; LIVE_GEMINI=1 keeps the real key from .env for the integration test.
if os.environ.get("LIVE_GEMINI") != "1":
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-tests"
os.environ.setdefault("INTERNAL_API_TOKEN", "")

from app.core.config import settings  # noqa: E402


class ScriptedLLM:
    """Returns the queued answers in order (str or dict), or raises queued exceptions."""

    model_name = "scripted"

    def __init__(self, *answers):
        self.answers = list(answers)
        self.prompts: list[str] = []
        self.calls: list[dict] = []

    async def generate_text(self, prompt, *, system_instruction=None, temperature=0.2, response_format="text"):
        self.prompts.append(prompt)
        self.calls.append({"system_instruction": system_instruction, "response_format": response_format})
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer if isinstance(answer, str) else json.dumps(answer)


INPUTS = {
    "courseObjectives": ["Introduce network security models and classical encryption."],
    "courseOutcomes": [
        {"coId": "co-1", "code": "CO1", "statement": "Explain network security models and classical ciphers."},
        {"coId": "co-2", "code": "CO2", "statement": "Illustrate block ciphers and public-key cryptography."},
    ],
    "units": [
        {"unitNumber": 1, "title": "Security fundamentals", "content": "OSI security architecture; classical ciphers", "hours": 8},
        {"unitNumber": 2, "title": "Block ciphers and DES", "content": "Feistel structure; DES; RSA", "hours": 7},
    ],
    "programOutcomes": [
        {"outcomeId": "out-po1", "kind": "PO", "code": "PO1", "title": "Engineering knowledge", "statement": "Apply engineering knowledge."},
        {"outcomeId": "out-po2", "kind": "PO", "code": "PO2", "statement": "Analyze problems."},
        {"outcomeId": "out-pso1", "kind": "PSO", "code": "PSO1", "statement": "Develop algorithms."},
    ],
    "activities": [
        {"itemId": "act-1", "title": "Cipher toolkit", "description": "Classical ciphers app", "coIds": ["co-1"]},
        {"itemId": "act-2", "title": "Block cipher lab", "coIds": ["co-2"]},
    ],
    "practicals": [],
    "tutorials": [],
}

COURSE = {
    "syllabusCourseId": "sc-ec306",
    "courseCode": "EC306",
    "courseName": "Network Security",
    "courseType": "CORE",
    "assessmentScheme": "THEORY",
}

RUBRIC = {
    "rubricId": "rubric-cam-default",
    "version": 2,
    "status": "PROPOSED",
    "levels": [
        {"level": 3, "label": "High", "meaning": "Directly and strongly develops"},
        {"level": 2, "label": "Medium", "meaning": "Develops relevant knowledge"},
        {"level": 1, "label": "Low", "meaning": "Limited but meaningful"},
        {"level": None, "label": "Blank", "meaning": "No meaningful relationship"},
    ],
    "rules": ["Justify every non-blank level with evidence."],
}


def stage1_context(**overrides) -> dict:
    ctx = {"stage": "UNIT_CO_MAPPING", "offeringId": "off-ec306", "course": COURSE, "inputs": INPUTS}
    ctx = copy.deepcopy(ctx)
    ctx.update(overrides)
    return ctx


def stage2_context(**overrides) -> dict:
    ctx = {
        "stage": "CO_PO_CORRELATION",
        "offeringId": "off-ec306",
        "course": COURSE,
        "inputs": INPUTS,
        "unitLinks": [
            {"unitNumber": 1, "coId": "co-1", "source": "FACULTY"},
            {"unitNumber": 2, "coId": "co-2", "source": "AI_ACCEPTED", "suggestionId": "us-2-co-2"},
        ],
        "rubric": RUBRIC,
    }
    ctx = copy.deepcopy(ctx)
    ctx.update(overrides)
    return ctx


def unit_suggestion(unit=1, co="co-1", **extra) -> dict:
    return {"unitNumber": unit, "coId": co, "rationale": "Unit topics cover the CO.", "needsReview": False,
            "reviewNote": None, "confidence": 0.9, **extra}


def cell_suggestion(co="co-1", outcome="out-po1", level=2, units=None, items=None, **extra) -> dict:
    return {
        "coId": co, "outcomeId": outcome, "suggestedLevel": level,
        "rationale": "The supplied evidence supports this level.",
        "evidence": {"unitNumbers": [1] if units is None else units, "itemIds": [] if items is None else items},
        "needsReview": False, "confidence": 0.8, **extra,
    }


@pytest.fixture(autouse=True)
def no_internal_token(monkeypatch):
    """Tests run without the internal token unless a test sets one."""
    monkeypatch.setattr(settings, "internal_api_token", "")
