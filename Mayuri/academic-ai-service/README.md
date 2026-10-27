# Academic AI Service

Internal FastAPI service that generates **CAM suggestions** for the Automated CO-PO Attainment Engine:

| Stage | Route (internal) | Called by Spring Boot for | Returns |
| --- | --- | --- | --- |
| 1 · Unit → CO mapping | `POST /cam/unit-mapping/suggestions` | CAM-5 | `UnitCoSuggestionSet` |
| 2 · CO → PO/PSO correlation | `POST /cam/co-po-correlation/suggestions` | CAM-4 | `CamSuggestionSet` |

Shapes follow `frontend/API_CONTRACT.md` §9.3 and §9.5. The service only **suggests**; it never stores CAM data.
The frontend never calls it directly: Spring Boot builds the context from the saved CAM and calls it.

## Setup

Python 3.12 or newer.

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements-dev.txt
copy .env.example .env          # then fill in GEMINI_API_KEY (and INTERNAL_API_TOKEN outside local dev)
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` | (required) | Gemini API key. Never commit it; share it privately. |
| `LLM_PROVIDER` | `gemini` | Only `gemini` is implemented. |
| `LLM_MODEL` | `gemini-2.5-flash` | Model name, recorded in every suggestion set as `modelUsed`. |
| `LLM_TIMEOUT_SECONDS` | `60` | Per-call timeout; exceeding it returns `504 UPSTREAM_TIMEOUT`. |
| `LLM_OUTPUT_RETRIES` | `1` | Extra attempts when the model's answer breaks a rule. |
| `INTERNAL_API_TOKEN` | empty | Shared secret Spring Boot sends as `X-Internal-Token`. Empty disables the check (local dev only). |

## Run

```bash
uvicorn app.main:app --port 8000 --reload
```

Spring Boot runs on 8081, the Angular app on 4200. Interactive docs: http://localhost:8000/docs. Health check: `GET /health`.

## Request

Both routes take the same body. `stage` must match the route; `unitLinks` and `rubric` are required for stage 2 and not allowed for stage 1.

```json
{
  "basedOnCamVersion": 6,
  "context": {
    "stage": "UNIT_CO_MAPPING",
    "offeringId": "off-ec306",
    "course": { "syllabusCourseId": "sc-ec306", "courseCode": "EC306", "courseName": "Network Security",
                "courseType": "CORE", "assessmentScheme": "THEORY" },
    "inputs": {
      "courseObjectives": ["..."],
      "courseOutcomes": [{ "coId": "co-1", "code": "CO1", "statement": "..." }],
      "units": [{ "unitNumber": 1, "title": "...", "content": "...", "hours": 8 }],
      "programOutcomes": [{ "outcomeId": "out-po1", "kind": "PO", "code": "PO1", "title": "...", "statement": "..." }],
      "activities": [], "practicals": [], "tutorials": []
    },
    "coIds": ["co-1"]
  }
}
```

## Errors

Every error uses the contract envelope `{ success: false, errorCode, message, fieldErrors?, traceId, timestamp }`.

| Status | `errorCode` | When |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Malformed body, wrong stage for the route, duplicate or unknown IDs in the context |
| 401 | `UNAUTHENTICATED` | Missing or wrong `X-Internal-Token` (when configured) |
| 422 | `PRECONDITION_FAILED` | Stage 2: a selected CO has no unit in the confirmed mapping |
| 502 | `AI_SERVICE_UNAVAILABLE` | The model's answer stayed unusable after the retry (bad JSON, invented IDs, rule breaks) |
| 503 | `AI_SERVICE_UNAVAILABLE` | Gemini failed or refused the call (network, quota, server error) |
| 504 | `UPSTREAM_TIMEOUT` | Gemini didn't answer within `LLM_TIMEOUT_SECONDS` |
| 500 | `INTERNAL_ERROR` | Anything unexpected (details only in the server log) |

## Tests

```bash
pytest                                   # unit and API tests; Gemini is mocked, no key needed
LIVE_GEMINI=1 pytest -m integration      # optional: real Gemini calls, uses the key in .env and spends quota
```

## Layout

```
app/
  main.py                    FastAPI app, error envelope and handlers
  api/routes/cam.py          the two internal routes
  api/security.py            X-Internal-Token check
  core/config.py, errors.py  settings and error types (status + errorCode)
  schemas/                   contract models: context, requests, suggestion sets, envelope
  pipelines/cam/             stage 1 and 2 pipelines, shared context checks
  pipelines/llm_json.py      JSON parsing, validation and one retry
  prompts/cam/               versioned prompt templates
  services/llm/              provider interface and the Gemini provider
docs/stage-2-integration-notes.md   what Spring Boot must verify before calling stage 2
```
