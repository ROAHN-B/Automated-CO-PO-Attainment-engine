
"""Real Gemini calls. Skipped unless LIVE_GEMINI=1 and a real GEMINI_API_KEY is in .env.

Run with:  LIVE_GEMINI=1 python -m pytest -m integration
These spend API quota, so they never run in the normal test suite.
"""

import asyncio
import os

import pytest
from conftest import stage1_context

from app.pipelines.cam.unit_co_mapping import UnitCoMappingPipeline
from app.schemas.cam_context import CamSuggestionContext
from app.services.llm.factory import get_llm_provider

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(os.environ.get("LIVE_GEMINI") != "1", reason="set LIVE_GEMINI=1 to call the real Gemini API"),
]


@pytest.fixture(autouse=True)
def fresh_provider():
    """Each test runs its own event loop, so it needs a client created inside that loop.

    (The service itself runs on one uvicorn loop, where the cached provider is fine.)
    """
    get_llm_provider.cache_clear()
    yield
    get_llm_provider.cache_clear()


def test_gemini_answers():
    text = asyncio.run(get_llm_provider().generate_text("Reply with exactly: Hello", temperature=0))
    assert "hello" in text.lower()


def test_stage1_end_to_end_on_the_network_security_sample():
    pipeline = UnitCoMappingPipeline(get_llm_provider())
    result = asyncio.run(pipeline.generate_suggestions(CamSuggestionContext.model_validate(stage1_context())))
    assert all(s["coId"] in {"co-1", "co-2"} and s["unitNumber"] in {1, 2} for s in result)
