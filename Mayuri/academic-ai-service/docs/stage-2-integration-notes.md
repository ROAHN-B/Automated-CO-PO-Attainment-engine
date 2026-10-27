# Stage 2 Integration Notes

## 1. Purpose

Document the validation requirements and integration boundary for Stage 2 CO–PO/PSO correlation suggestions in the FastAPI AI service.

## 2. Confirmation Requirement

Stage 2 suggestions must be generated only when the unit-to-CO mapping has been confirmed in persisted CAM data.

If the mapping is not confirmed, the request must be rejected with:

- **HTTP status:** `422`
- **Error code:** `PRECONDITION_FAILED`

The confirmation status must come from a trusted backend source, not from a frontend-supplied status field.

## 3. Current FastAPI Implementation

Both stages accept the same `CamSuggestionContext` (API_CONTRACT §9.5); stage 2 also requires `unitLinks` and `rubric`. The service validates the supplied mapping for duplicate links, unknown units and unknown COs (400 `VALIDATION_FAILED`), and for selected COs without a mapped unit (422 `PRECONDITION_FAILED`). It also checks that generated evidence is consistent with the supplied mapping.

The service does **not** independently verify whether the mapping has been confirmed in persisted CAM data.

The request field `basedOnCamVersion` must be a positive integer. FastAPI records this version in the response but does not independently verify it against a saved CAM record.

The current request schema rejects unexpected fields, including an outer `unitMappingStatus` field (400 `VALIDATION_FAILED`).

Therefore, current validation establishes consistency of the supplied context, not authoritative confirmation or saved-version freshness.

## 4. Spring Boot Integration Requirements

When the Spring Boot backend is implemented, it must:

1. Retrieve the authoritative saved CAM for the offering.
2. Compare the requested context's CAM version with the persisted CAM version.
3. Verify that the unit-to-CO mapping is persisted and has status `CONFIRMED`.
4. Reject requests that fail either precondition before calling FastAPI.
5. Construct the AI request context from trusted saved data.
6. Call the internal FastAPI endpoint with the `X-Internal-Token` header and translate the result into the frontend API contract.
7. Pass AI failures through as they are: 502/503 `AI_SERVICE_UNAVAILABLE` and 504 `UPSTREAM_TIMEOUT` mean the request was fine but the AI couldn't answer, so the UI offers "Try again".

The frontend-facing contract route is:

`POST /api/v1/offerings/{offeringId}/cam/suggestions`

The current internal FastAPI routes are:

- `POST /cam/unit-mapping/suggestions` (stage 1, for CAM-5)
- `POST /cam/co-po-correlation/suggestions` (stage 2, for CAM-4)

These routes have different responsibilities and request formats. The Spring Boot backend will act as the adapter between them.

## 5. Mapping Changes After Confirmation

If the unit-to-CO mapping changes after confirmation, the updated mapping must be confirmed again before generating Stage 2 suggestions.

The backend must verify confirmation against the current persisted mapping, rather than relying on a status supplied by the frontend or an unverified request context.

## 6. Team Review

This document describes the current FastAPI behavior and the planned Spring Boot integration requirements. The persisted-state checks remain pending until the backend and its persistence layer are implemented.

The team should review the request schema, CAM version ownership, mapping confirmation rules, and error-response behavior before finalizing integration.
