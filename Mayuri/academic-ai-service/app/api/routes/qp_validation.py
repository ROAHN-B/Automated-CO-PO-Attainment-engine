
"""Internal routes for AI question-paper validation."""

from fastapi import APIRouter, Depends

from app.api.security import require_internal_token
from app.core.config import settings
from app.pipelines.qp_validation.pipeline import validate_question_paper
from app.prompts.qp_validation.validation import (
    QP_VALIDATION_TEMPLATE_ID,
    QP_VALIDATION_TEMPLATE_VERSION,
)
from app.schemas.common import ApiResponse
from app.schemas.qp_validation import QpAiAnalysis, QpValidateRequest
from app.services.llm.factory import get_llm_provider

router = APIRouter(
    prefix="/question-paper",
    tags=["Question Paper Validation"],
    dependencies=[Depends(require_internal_token)],
)


@router.post(
    "/validate",
    response_model=ApiResponse[QpAiAnalysis],
    response_model_by_alias=True,
)
async def validate_question_paper_route(request: QpValidateRequest):
    """Validate question-paper questions against the supplied academic context."""

    analysis = await validate_question_paper(
        request,
        llm=get_llm_provider(),
        model_used=settings.llm_model,
        retries=settings.llm_output_retries,
    )

    return ApiResponse(
        success=True,
        data=analysis,
        message="Question-paper validation completed successfully.",
    )
