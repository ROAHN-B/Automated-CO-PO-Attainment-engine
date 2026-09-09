# API Contract — Automated CO-PO Attainment Engine

**Contract-first handoff.** The Angular frontend is already built against these
endpoints using typed mock services. The TypeScript interfaces in
`src/app/core/models/` are the **single source of truth** for the whole team:

| Teammate | Owns | Stack | Turns the contract into |
| --- | --- | --- | --- |
| **Rohan** | Frontend + these interfaces | Angular 19 + Tailwind | UI, typed services, mock data |
| **Abhijeet** | Backend + database | Java Spring Boot + CockroachDB | DTOs + SQL tables + REST controllers |
| **Mayuri** | AI / RAG | FastAPI (or Spring) + LLM + vector store | ingestion + generation + analysis endpoints |

> Keep the JSON field names **exactly** as typed here. The frontend deserialises
> straight into these interfaces — a renamed field silently becomes `undefined`.

---

## 1. Conventions

**Base URL** — configured in `src/environments/environment.ts`:

```
http://localhost:8080/api/v1
```

**Mock switch** — `environment.useMockData`. While `true` (current default) the
services return hardcoded fixtures with simulated latency and make **no HTTP
calls**, so the UI is fully demoable before any backend exists. Flip to `false`
to hit the real API. Each teammate can go live independently — the frontend
does not care which endpoints are real yet.

**Response envelope** — every endpoint wraps its payload in `ApiResponse<T>`.
The frontend unwraps `.data` automatically (`.pipe(map(r => r.data))`).

```ts
interface ApiResponse<T> {
  success: boolean;
  data: T;              // present when success === true
  message?: string;     // human-readable (toasts / errors)
  errorCode?: string;   // machine-readable, e.g. "UNIT_NOT_FOUND"
  timestamp: string;    // ISO-8601 UTC
}
```

**Errors** — non-2xx responses should return `ApiError` (`success:false`,
`errorCode`, `message`, optional `fieldErrors`).

**Types** — all IDs are strings (CockroachDB UUID/STRING). All timestamps are
ISO-8601 UTC strings (`"2026-08-23T09:30:00Z"`). Enums are UPPER_SNAKE_CASE
string unions (never numeric except `AttainmentLevel` 0–3 and `CoPoCorrelation`
1–3).

**Auth** — endpoints are expected to sit behind a Bearer JWT
(`Authorization: Bearer <token>`). The interceptor is not wired into the mock
build yet; add it when auth lands. Treat "the signed-in faculty" as the token
subject.

---

## 2. Shared enums (`common.model.ts`)

| Type | Values |
| --- | --- |
| `BloomLevel` | `L1_REMEMBER` `L2_UNDERSTAND` `L3_APPLY` `L4_ANALYZE` `L5_EVALUATE` `L6_CREATE` |
| `AttainmentLevel` | `0` `1` `2` `3` (Not attained / Low / Moderate / High) |
| `CoPoCorrelation` | `1` `2` `3` (low / medium / high) |
| `TermType` | `ODD` `EVEN` |

Core entities `Course`, `CourseOutcome`, `ProgramOutcome` are also defined in
`common.model.ts`.

---

## 3. Endpoints

Legend: **[A]** = Abhijeet (deterministic, CockroachDB) · **[M]** = Mayuri (AI/RAG).

### 3.1 Courses & Outcomes **[A]** — `course.service.ts`

| # | Method | Path | Request | Response |
| --- | --- | --- | --- | --- |
| 1 | GET | `/courses` | — | `Course[]` |
| 2 | GET | `/courses/{courseId}/outcomes` | — | `CourseOutcome[]` |

`/courses` returns courses assigned to the signed-in faculty.

### 3.2 Dashboard **[A]** — `dashboard.service.ts`

| # | Method | Path | Request | Response |
| --- | --- | --- | --- | --- |
| 3 | GET | `/dashboard/metrics` | — | `DashboardMetrics` |
| 4 | GET | `/dashboard/courses` | — | `CourseSummary[]` |
| 5 | GET | `/dashboard/activity` | — | `ActivityItem[]` |

These are aggregate queries (counts, averages, latest N activity rows). Shapes
in `dashboard.model.ts`.

```ts
interface DashboardMetrics {
  activeCourses: number; cosDefined: number; embeddedUnits: number;
  aiQuestionsGenerated: number; pendingReviews: number; reportsGenerated: number;
  avgCoAttainment: number;   // %
  gapsDetected: number;
}
interface CourseSummary {
  courseId: string; courseCode: string; courseName: string; semester: number;
  knowledgeBaseStatus: 'EMPTY' | 'PARTIAL' | 'READY';
  aiQuestionStatus:   'NONE' | 'GENERATED' | 'REVIEWED';
  coPoStatus:         'NOT_STARTED' | 'IN_PROGRESS' | 'CALCULATED' | 'SUBMITTED';
  attainmentPercentage?: number; gapCount: number;
}
interface ActivityItem {
  activityId: string;
  kind: 'INGESTION' | 'GENERATION' | 'CALCULATION' | 'SUBMISSION' | 'ANALYSIS';
  summary: string; courseCode?: string; occurredAt: string;
}
```

### 3.3 Vector Knowledge Base **[M]** — `ai-generation.service.ts` (Part A)

"Upload once, query many." Faculty attach reference docs to a syllabus unit;
Mayuri's pipeline parses → chunks → embeds them into the unit's vector store.

| # | Method | Path | Request | Response |
| --- | --- | --- | --- | --- |
| 6 | GET | `/courses/{courseId}/units` | — | `SyllabusUnit[]` |
| 7 | GET | `/units/{unitId}/materials` | — | `ReferenceMaterial[]` |
| 8 | POST | `/units/ingest` | `multipart/form-data` (see below) | `IngestionJob` |
| 9 | GET | `/ingest/jobs/{jobId}` | — | `IngestionJob` |
| 10 | POST | `/units` | `CreateUnitRequest` | `SyllabusUnit` |

**Endpoint 8 is multipart**, not JSON:

```
part "meta"  → IngestReferenceRequest as application/json
part "files" → one or more binary files (repeat the "files" part per file)
```

```ts
interface IngestReferenceRequest {
  unitId?: string;            // target an EXISTING unit …
  newUnit?: CreateUnitRequest; // … OR create a new one in the same call
  materialType: ReferenceMaterialType;
}
type ReferenceMaterialType =
  'QUESTION_BANK' | 'PREVIOUS_PAPER' | 'LECTURE_PPT' | 'TEXTBOOK' | 'NOTES' | 'OTHER';

interface CreateUnitRequest {
  courseId: string; unitNumber: number; unitName: string; description?: string;
}
interface SyllabusUnit {
  unitId: string; courseId: string; unitNumber: number; unitName: string;
  description?: string; documentCount: number; chunkCount: number;
  isEmbedded: boolean; lastIngestedAt?: string;
}
interface ReferenceMaterial {
  materialId: string; unitId: string; courseId: string; fileName: string;
  mimeType: string; fileSizeBytes: number; materialType: ReferenceMaterialType;
  ingestionStatus: IngestionStatus; progressPercent: number;
  chunkCount?: number; errorMessage?: string; uploadedAt: string; uploadedBy: string;
}
type IngestionStatus =
  'PENDING' | 'PARSING' | 'CHUNKING' | 'EMBEDDING' | 'COMPLETED' | 'FAILED';

interface IngestionJob {
  jobId: string; unitId: string; courseId: string;
  materials: ReferenceMaterial[];
  overallStatus: IngestionStatus; overallProgressPercent: number;
  startedAt: string; completedAt?: string;
}
```

Ingestion is asynchronous: POST `/units/ingest` returns a job immediately; the
UI polls `/ingest/jobs/{jobId}` until `overallStatus` is `COMPLETED` or `FAILED`.
Full model in `vector-kb.model.ts`.

### 3.4 Question Generation **[M]** — `ai-generation.service.ts` (Part B)

RAG over an already-embedded unit. **No file upload here** — the unit must
already be embedded.

| # | Method | Path | Request | Response |
| --- | --- | --- | --- | --- |
| 11 | POST | `/generation/questions` | `QuestionGenerationRequest` | `QuestionGenerationResponse` |
| 12 | POST | `/papers` | `QuestionPaperRequest` | `QuestionPaper` |

```ts
// Each blueprint row asks the LLM for N questions of one weight AND one format.
type QuestionType = 'MCQ' | 'FILL_IN_THE_BLANK' | 'SHORT_ANSWER' | 'LONG_ANSWER';

interface BlueprintRow {
  marks: number;              // 1, 2, 4, 6, 10 ...
  count: number;              // how many questions of this weight
  questionType: QuestionType; // the format Mayuri's prompt must produce
}
interface QuestionGenerationRequest {
  courseId: string; unitId: string;
  coIds: string[];                       // COs to target
  blueprint: BlueprintRow[];             // e.g. [{marks:2,count:5,questionType:'MCQ'}]
  bloomLevels?: BloomLevel[];            // optional filter
  additionalInstructions?: string;
}
interface QuestionOption {               // MCQ choices only
  key: string;                           // "A", "B", "C", "D"
  text: string;
  isCorrect?: boolean;                   // answer key — hide in the student paper
}
interface GeneratedQuestion {
  questionId: string; questionText: string; marks: number;
  questionType: QuestionType;            // mirrors the blueprint row it came from
  options?: QuestionOption[];            // present iff questionType === 'MCQ'
  coId: string; coCode: string; bloomLevel: BloomLevel;
  sourceChunkIds?: string[];             // RAG provenance
  confidenceScore?: number;              // 0..1
  status: 'GENERATED' | 'ACCEPTED' | 'EDITED' | 'REJECTED';
  selected: boolean;
}
interface QuestionGenerationResponse {
  generationId: string; courseId: string; unitId: string;
  modelUsed: string; requestedAt: string; completedAt: string;
  questions: GeneratedQuestion[];
}
interface QuestionPaperRequest {
  generationId: string; courseId: string; title: string;
  selectedQuestionIds: string[];
  examName?: string; durationMinutes?: number; instructions?: string;
}
interface QuestionPaper {
  paperId: string; title: string; courseId: string; courseCode: string;
  questions: GeneratedQuestion[]; totalMarks: number; totalQuestions: number;
  createdAt: string;
  pdfUrl?: string;   // if set, UI opens it; if omitted, UI prints client-side
}
```

**Mayuri (LLM prompt generator):** branch the prompt on `questionType` per
blueprint row — `MCQ` must return `options` (4 choices, exactly one
`isCorrect: true`); `FILL_IN_THE_BLANK` marks the blank with `____`;
`SHORT_ANSWER` / `LONG_ANSWER` are descriptive (no `options`). Echo the row's
`questionType` back on every `GeneratedQuestion`.

**Abhijeet (backend):** persist `questionType` and `options` (incl. the
`isCorrect` answer key) alongside each question. In the **student** PDF from
`/papers`, render option text **without** the answer key; keep `isCorrect` for
a separate answer-key export only.

For `/papers`: if the backend renders a PDF (e.g. Apache PDFBox) return its
`pdfUrl`. If `pdfUrl` is omitted the frontend falls back to a client-side
print-to-PDF, so the endpoint is still usable without server rendering. Full
model in `question-gen.model.ts`.

### 3.5 CO-PO Attainment **[A]** — `attainment.service.ts`

Deterministic calculation — **no AI**. Config + CO⇄PO matrix + engine + submit.

| # | Method | Path | Request | Response |
| --- | --- | --- | --- | --- |
| 13 | GET | `/courses/{courseId}/attainment/config` | — | `AttainmentConfiguration` |
| 14 | PUT | `/courses/{courseId}/attainment/config` | `AttainmentConfiguration` | `AttainmentConfiguration` |
| 15 | GET | `/courses/{courseId}/copo-matrix` | — | `CoPoMappingEntry[]` |
| 16 | POST | `/courses/{courseId}/attainment/calculate` | `CalculateAttainmentRequest` | `AttainmentReport` |
| 17 | POST | `/attainment/reports/{reportId}/submit` | — | `AttainmentReport` |

```ts
interface AttainmentConfiguration {
  configId: string; courseId: string;
  targetPercentage: number;      // a student "attains" a CO at ≥ this score
  directWeightage: number;       // e.g. 80  (direct + indirect must == 100)
  indirectWeightage: number;     // e.g. 20
  level1Threshold: number;       // % of class meeting target → Level 1
  level2Threshold: number;       // → Level 2   (must ascend)
  level3Threshold: number;       // → Level 3
}
interface CoPoMappingEntry {
  coId: string; coCode: string; poCode: string; correlation: CoPoCorrelation;
}
interface CalculateAttainmentRequest {
  courseId: string;
  config?: AttainmentConfiguration; // override saved config for this run
  assessmentIds?: string[];         // limit to specific assessments
}
interface CoAttainmentResult {
  coId: string; coCode: string; targetPercentage: number;
  studentsMeetingTarget: number; totalStudents: number;
  attainmentPercentage: number;   // % meeting target
  directAttainment: number; indirectAttainment: number; finalAttainment: number;
  attainmentLevel: AttainmentLevel; gapDetected: boolean;
}
interface PoAttainmentResult {
  poCode: string; poDescription: string;
  attainmentValue: number;        // 0..3 scale
  attainmentLevel: AttainmentLevel; contributingCoCodes: string[];
}
interface AttainmentReport {
  reportId: string; courseId: string; courseCode: string;
  academicYear: string; term: TermType;
  config: AttainmentConfiguration;
  coResults: CoAttainmentResult[]; poResults: PoAttainmentResult[];
  overallCoAttainment: number; overallPoAttainment: number;
  gapCount: number;
  status: 'DRAFT' | 'SUBMITTED_TO_HOD' | 'APPROVED' | 'REVISION_REQUESTED';
  generatedAt: string;
}
```

`finalAttainment = direct×directWeightage% + indirect×indirectWeightage%`.
`attainmentLevel` is derived from the class-meeting-% against the three
thresholds. Submit (17) transitions `status` `DRAFT → SUBMITTED_TO_HOD`. Full
model in `attainment.model.ts`.

### 3.6 Report Analysis **[M]** — `report-analysis.service.ts`

Generative narrative over an `AttainmentReport` (RAG/LLM) — distinct from the
deterministic math above.

| # | Method | Path | Request | Response |
| --- | --- | --- | --- | --- |
| 18 | POST | `/analysis/report` | `ReportAnalysisRequest` | `ReportAnalysis` |

```ts
interface ReportAnalysisRequest {
  courseId: string;
  reportId?: string;   // omit → analyse the most recent report for the course
  focusAreas?: string[]; // e.g. ["CO2","PO3"]
}
interface AiInsight {
  insightId: string;
  category: 'ATTAINMENT_GAP' | 'STRENGTH' | 'TREND' | 'RECOMMENDATION' | 'ACTION_ITEM';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string; description: string;
  relatedCoCodes?: string[]; relatedPoCodes?: string[];
  recommendedActions?: string[]; confidenceScore?: number; // 0..1
}
interface AttainmentTrendPoint {
  period: string;              // "2024-25 ODD"
  overallCoAttainment: number; // %
  overallPoAttainment: number; // 0..3 scale
}
interface ReportAnalysis {
  analysisId: string; courseId: string; courseCode: string;
  modelUsed: string; generatedAt: string;
  executiveSummary: string;
  insights: AiInsight[]; trends: AttainmentTrendPoint[];
  gapCount: number; strengthCount: number;
}
```

Full model in `report-analysis.model.ts`.

---

## 4. Model files (source of truth)

| File | Exports |
| --- | --- |
| `core/models/common.model.ts` | `ApiResponse`, `ApiError`, `AuditFields`, `Page*`, enums, `Course`, `CourseOutcome`, `ProgramOutcome` |
| `core/models/dashboard.model.ts` | `DashboardMetrics`, `CourseSummary`, `ActivityItem` + status enums |
| `core/models/vector-kb.model.ts` | `SyllabusUnit`, `ReferenceMaterial`, `IngestReferenceRequest`, `CreateUnitRequest`, `IngestionJob`, status enums |
| `core/models/question-gen.model.ts` | `QuestionGenerationRequest/Response`, `GeneratedQuestion`, `QuestionPaper*`, `BlueprintRow`, `QuestionType`, `QuestionOption` |
| `core/models/attainment.model.ts` | `AttainmentConfiguration`, `CoPoMappingEntry`, `Calculate…Request`, `CoAttainmentResult`, `PoAttainmentResult`, `AttainmentReport` |
| `core/models/report-analysis.model.ts` | `ReportAnalysisRequest`, `AiInsight`, `AttainmentTrendPoint`, `ReportAnalysis` |

Import everything from the barrel: `import { … } from 'src/app/core/models';`

---

## 5. Endpoint summary (18 total)

| # | Method | Path | Owner |
| --- | --- | --- | --- |
| 1 | GET | `/courses` | A |
| 2 | GET | `/courses/{courseId}/outcomes` | A |
| 3 | GET | `/dashboard/metrics` | A |
| 4 | GET | `/dashboard/courses` | A |
| 5 | GET | `/dashboard/activity` | A |
| 6 | GET | `/courses/{courseId}/units` | M |
| 7 | GET | `/units/{unitId}/materials` | M |
| 8 | POST | `/units/ingest` (multipart) | M |
| 9 | GET | `/ingest/jobs/{jobId}` | M |
| 10 | POST | `/units` | M |
| 11 | POST | `/generation/questions` | M |
| 12 | POST | `/papers` | M |
| 13 | GET | `/courses/{courseId}/attainment/config` | A |
| 14 | PUT | `/courses/{courseId}/attainment/config` | A |
| 15 | GET | `/courses/{courseId}/copo-matrix` | A |
| 16 | POST | `/courses/{courseId}/attainment/calculate` | A |
| 17 | POST | `/attainment/reports/{reportId}/submit` | A |
| 18 | POST | `/analysis/report` | M |

---

## 6. Working against this contract

1. **Frontend today** — `useMockData: true`. All 18 endpoints return realistic
   fixtures; the whole app is clickable end-to-end with no backend.
2. **Going live** — implement an endpoint, then set `useMockData: false` to test
   it. Endpoints can be switched on one at a time; the contract shape is what
   keeps mock and real interchangeable.
3. **Changing the contract** — edit the interface in `core/models/` first,
   then update backend DTOs and the mock fixture together. The interface is the
   agreement; a change there is a change everyone sees.
