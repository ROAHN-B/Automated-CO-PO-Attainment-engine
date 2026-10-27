
from fastapi import APIRouter, Depends

from app.api.security import require_internal_token
from app.core.config import settings
from app.pipelines.cam.co_po_correlation import CoPoCorrelationPipeline
from app.pipelines.cam.unit_co_mapping import UnitCoMappingPipeline
from app.prompts.cam.co_po_correlation import (
    CO_PO_CORRELATION_TEMPLATE_ID,
    CO_PO_CORRELATION_TEMPLATE_VERSION,
)
from app.prompts.cam.unit_co_mapping import (
    UNIT_CO_MAPPING_TEMPLATE_ID,
    UNIT_CO_MAPPING_TEMPLATE_VERSION,
)
from app.schemas.cam import CamSuggestionSet, UnitCoSuggestionSet
from app.schemas.cam_requests import CamSuggestionRequest
from app.schemas.common import ApiResponse
from app.services.llm.factory import get_llm_provider

# Internal routes called by Spring Boot for CAM-5 and CAM-4 (API_CONTRACT §9.2, §9.5).
router = APIRouter(
    prefix="/cam",
    tags=["Course Articulation Matrix (CAM)"],
    dependencies=[Depends(require_internal_token)],
)


@router.post(
    "/unit-mapping/suggestions",
    response_model=ApiResponse[UnitCoSuggestionSet],
    response_model_by_alias=True,
)
async def suggest_unit_co_mappings(request: CamSuggestionRequest):
    """Stage 1: suggest syllabus unit-to-CO links."""

    pipeline = UnitCoMappingPipeline(llm_provider=get_llm_provider())
    suggestions = await pipeline.generate_suggestions(request.context)

    return ApiResponse(
        success=True,
        data=UnitCoSuggestionSet(
            based_on_cam_version=request.based_on_cam_version,
            suggestions=suggestions,
            model_used=settings.llm_model,
            template_id=UNIT_CO_MAPPING_TEMPLATE_ID,
            template_version=UNIT_CO_MAPPING_TEMPLATE_VERSION,
        ),
        message="Unit-to-CO mapping suggestions generated successfully.",
    )


@router.post(
    "/co-po-correlation/suggestions",
    response_model=ApiResponse[CamSuggestionSet],
    response_model_by_alias=True,
)
async def suggest_co_po_correlations(request: CamSuggestionRequest):
    """Stage 2: suggest CO-to-PO/PSO correlation levels."""

    pipeline = CoPoCorrelationPipeline(llm_provider=get_llm_provider())
    suggestions = await pipeline.generate_suggestions(request.context)

    return ApiResponse(
        success=True,
        data=CamSuggestionSet(
            based_on_cam_version=request.based_on_cam_version,
            rubric_version=request.context.rubric.version,
            suggestions=suggestions,
            model_used=settings.llm_model,
            template_id=CO_PO_CORRELATION_TEMPLATE_ID,
            template_version=CO_PO_CORRELATION_TEMPLATE_VERSION,
        ),
        message="CO-to-PO/PSO correlation suggestions generated successfully.",
    )
