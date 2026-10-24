# API Contract — Automated CO-PO Attainment Engine

**Version 2.0 (draft) · 24 Oct 2026 · Owner: Rohan (frontend)**

This document is the agreement between the Angular frontend and the two backends. It replaces v1, which assumed CockroachDB and a single blueprint-based question generator.

> **Status of this draft.** The frontend TypeScript models in `src/app/core/models/` still follow v1. They will be updated to match this document **after** Abhijeet and Mayuri review it. Until then, **this document is the source of truth**, not the `.ts` files.

| Person | Owns | Stack | Marked as |
| --- | --- | --- | --- |
| **Rohan** | UI/UX, Angular app, this contract | Angular 19, Tailwind | — |
| **Abhijeet** | Academic data, auth, RBAC, assessments, marks, attainment engine, question bank, exports | Spring Boot, Spring Data MongoDB | **[A]** |
| **Mayuri** | Document ingestion, retrieval, question generation, AI analysis | Python FastAPI, MongoDB Atlas Vector Search, LLM | **[M]** |

**Sources used:** Notion "new database design" (Module 1, locked 4 Oct 2026), Updated user stories (EP-001 → EP-005), AI Arch pages (Pipelines 1–3), the frontend workflow diagram, and the project brief / `AGENTS.md`.

---

## Contents

1. [How to read this document](#1-how-to-read-this-document)
2. [Conventions](#2-conventions)
3. [Shared types](#3-shared-types)
4. [Roles and access](#4-roles-and-access)
5. [Auth & session](#5-auth--session-a)
6. [Academic structure (read)](#6-academic-structure-read-a)
7. [Faculty workspace](#7-faculty-workspace-a)
8. [Assessment plan](#8-assessment-plan-a)
9. [Course Articulation Matrix (CAM)](#9-course-articulation-matrix-cam-a--m)
10. [Question paper validation](#10-question-paper-validation-a--m)
11. [Knowledge base & AI question generation](#11-knowledge-base--ai-question-generation-m--a)
12. [Marksheet structure](#12-marksheet-structure-a)
13. [Marks upload & review](#13-marks-upload--review-a)
14. [CO-PO attainment](#14-co-po-attainment-a)
15. [Coordination (coordinator)](#15-coordination-coordinator-a)
16. [Super Admin](#16-super-admin-a)
17. [HOD](#17-hod-pending)
18. [Error codes](#18-error-codes)
19. [Open questions](#19-open-questions)
20. [Changes from v1](#20-changes-from-v1)

---

## 1. How to read this document

Every section carries a **status** taken from `AGENTS.md`:

| Status | Meaning |
| --- | --- |
| **CONFIRMED** | The requirement is agreed. Build against this shape. |
| **ASSUMPTION** | A frontend proposal to unblock work. Accept, change or reject it in review. |
| **PENDING** | The requirement itself isn't specified yet. The shape is a placeholder; don't implement business logic for it. |

Open questions are tagged like **[O-3]** and listed in [§19](#19-open-questions).

**What the frontend will never do** (so the backends must):

- Calculate CO, PO or PSO attainment, threshold levels, or any score.
- Classify Bloom levels, map questions to COs, or score question papers.
- Decide authorization. Hidden buttons are convenience only; every endpoint enforces its own access check.
- Generate PDFs or Excel workbooks. The frontend only requests them and downloads them.

---

## 2. Conventions

### 2.1 Base URL

```
{API_BASE}/api/v1
```

`API_BASE` comes from `src/environments/environment*.ts`. The frontend uses **one** base URL for everything. Whether `/ai/*` and other AI-backed routes are proxied by Spring Boot or by a gateway to FastAPI is a deployment decision **[O-6]**; the paths in this document don't change either way.

### 2.2 Envelope

Every JSON response is wrapped:

```ts
interface ApiResponse<T> {
  success: boolean;
  data: T;                 // present when success === true
  message?: string;        // human-readable, safe to show in a toast
  errorCode?: string;      // see §18
  timestamp: IsoDateTime;
}

interface ApiError {
  success: false;
  errorCode: string;                    // see §18
  message: string;                      // safe to show; never a stack trace
  fieldErrors?: Record<string, string>; // key = request field path, e.g. "assessments[2].maxMarks"
  traceId?: string;                     // for support logs
  timestamp: IsoDateTime;
}
```

File downloads are the only responses that aren't wrapped (see §2.6).

### 2.3 Data rules

- **IDs** are opaque strings. MongoDB `ObjectId`s are sent as 24-character hex strings. The frontend never parses or builds IDs.
- **Timestamps** are ISO-8601 UTC strings: `"2026-10-24T09:30:00Z"`. Dates without time are `"2026-10-24"`.
- **Enums** are `UPPER_SNAKE_CASE` strings. Numeric exceptions: `AttainmentLevel` (0–3) and `CorrelationLevel` (1–3).
- **Percentages** are numbers from 0 to 100, not 0–1.
- **Nulls:** an optional field the backend doesn't know is omitted or `null`; the frontend treats both the same.

### 2.4 Paging, sorting, filtering

List endpoints that can grow return `Page<T>`. Query params: `?page=0&size=20&sort=updatedAt,desc`.

```ts
interface Page<T> {
  content: T[];
  page: number;        // 0-based
  size: number;
  totalElements: number;
  totalPages: number;
}
```

Short lists that are naturally bounded (e.g. a course's COs) return a plain array.

### 2.5 Drafts and concurrency

Editable documents (assessment plan, CAM, marksheet structure, threshold config) carry a `version: number`.

- `PUT` must send the `version` it loaded.
- If someone else saved first, the server returns **409 `VERSION_CONFLICT`** and the frontend asks the user to reload.
- `.../finalize` locks the document. Further `PUT`s return **409 `ALREADY_FINALIZED`**.

### 2.6 Files

**Uploads** use `multipart/form-data` with two parts:

```
part "meta" → JSON (Content-Type: application/json)
part "file" → the binary file
```

**Generated files** (PDF, XLSX, DOCX) are returned as an `ExportFile`. The frontend then opens `downloadUrl`:

```ts
interface ExportFile {
  fileId: ID;
  fileName: string;          // e.g. "CS301_ISE1_validation.pdf"
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;       // short-lived, authenticated or signed
  expiresAt: IsoDateTime;
}
```

If generation is slow, the export endpoint may return **202** with an `AsyncJob` instead (see §2.7).

### 2.7 Long-running work

Ingestion, question generation, paper analysis, marks validation and attainment runs are asynchronous.

1. The `POST` returns **202** with the resource in a non-terminal status (e.g. `PROCESSING`).
2. The frontend polls the matching `GET` every 2 s, backing off to 10 s, until it reaches a terminal status. It stops after 5 minutes and shows a retry option.
3. The server may send `Retry-After` to slow polling down.

Push updates (SSE or WebSocket) can replace polling later without changing resource shapes **[O-13]**.

For exports that need a job:

```ts
interface AsyncJob {
  jobId: ID;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  result?: ExportFile;       // when SUCCEEDED
  error?: { errorCode: string; message: string }; // when FAILED
  updatedAt: IsoDateTime;
}
// GET /jobs/{jobId} → AsyncJob   [A]
```

### 2.8 Auth header

Every endpoint except `/auth/login` and the password-reset endpoints needs:

```
Authorization: Bearer <accessToken>
```

**401** means the token is missing or expired (the frontend sends the user to `/login`). **403** means the user is signed in but not allowed (the frontend shows a "no access" state).

### 2.9 AI-produced data

Anything produced by an LLM carries enough metadata for the UI to label it as AI output and for faculty to override it:

```ts
interface AiProvenance {
  modelUsed: string;         // e.g. "gemini-2.5-pro"
  templateId?: string;       // Prompt Library template
  templateVersion?: string;
  generatedAt: IsoDateTime;
}
```

The frontend treats AI payloads as untrusted. It validates their structure and shows an error state instead of crashing when a field is missing or malformed.

---

## 3. Shared types

```ts
type ID = string;
type IsoDateTime = string;
type IsoDate = string;

/** Bloom's Taxonomy — matches Module 1 `courseOutcomes[].bloomLevel`. */
type BloomLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';

/** Examination scheme components — matches Module 1 (locked). */
type AssessmentComponentType = 'ESE' | 'ISE' | 'ICA' | 'POE' | 'OE' | 'OE_POE';

type OutcomeKind = 'PO' | 'PSO';
type CorrelationLevel = 1 | 2 | 3;            // 1 low · 2 medium · 3 high
type AttainmentLevel = 0 | 1 | 2 | 3;         // 0 = not attained
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type QuestionType = 'MCQ' | 'FILL_IN_THE_BLANK' | 'SHORT_ANSWER' | 'LONG_ANSWER';

/** A CO as it appears inside a Syllabus Course (Module 1). */
interface CourseOutcome {
  coId: ID;               // stable internal ID used by every downstream reference
  code: string;           // "CO1"
  statement: string;
  bloomLevel: BloomLevel; // faculty-confirmed
}

/** A Program Outcome or Program Specific Outcome. */
interface ProgramOutcome {
  outcomeId: ID;
  kind: OutcomeKind;
  code: string;           // "PO1", "PSO2"
  statement: string;
}

/** Lightweight reference used in lists and headers. */
interface CourseRef {
  syllabusCourseId: ID;
  courseCode: string;     // "25ECU4O55T"
  courseName: string;
}

/** Generic label/value row. Used where the backend owns the meaning (see §14). */
interface BreakdownRow {
  label: string;          // "Students meeting target"
  value: number | string;
  unit?: string;          // "%", "students", "/3"
  hint?: string;          // tooltip text
}
```

---

## 4. Roles and access

**Status: CONFIRMED (role set) · ASSUMPTION (coordinator code) [O-3]**

### 4.1 System roles

A user can hold several. The login response lists all of them.

| Role code | Portal after login | Notes |
| --- | --- | --- |
| `SUPER_ADMIN` | `/admin` | Institution and academic setup |
| `HOD` | `/analytics` | Workflow **PENDING** ([§17](#17-hod-pending)) |
| `FACULTY` | `/faculty` | Teaching workflows |
| `COORDINATOR` | `/faculty` (extra "Coordination" section) | Always held together with `FACULTY`. No separate portal. |
| `LAB_ASSISTANT` | `/lab-assistant` | Marks upload only |

Landing priority when a user has several roles: `SUPER_ADMIN` → `HOD` → `FACULTY` → `LAB_ASSISTANT`, unless `primaryRole` says otherwise.

### 4.2 Course-level responsibilities

Separate from system roles: what a faculty member does **for a specific subject**. These come from subject allocation ([§15](#15-coordination-coordinator-a)) and match the July `courseFaculty.role` enum.

```ts
type CourseAssignmentRole =
  | 'COURSE_COORDINATOR'
  | 'THEORY_FACULTY'
  | 'PRACTICAL_FACULTY'
  | 'LAB_INCHARGE'
  | 'QUESTION_SETTER'
  | 'MODERATOR';
```

`MODERATOR` is the recipient of "Send to moderator" in [§10](#10-question-paper-validation-a--m). The moderator's own screens are not built yet.

### 4.3 Who can call what

| Area | SUPER_ADMIN | HOD | FACULTY | COORDINATOR | LAB_ASSISTANT |
| --- | :-: | :-: | :-: | :-: | :-: |
| §6 Academic structure (read) | ✓ | ✓ | ✓ | ✓ | ✓ (own dept) |
| §7–§12 Faculty workspace | — | PENDING | ✓ own allocations | ✓ own allocations | — |
| §13 Marks upload | — | — | ✓ upload + review | ✓ | ✓ upload only |
| §14 Attainment | — | PENDING | ✓ own allocations | ✓ | — |
| §15 Coordination | — | — | — | ✓ own scope | — |
| §16 Admin | ✓ | — | — | — | — |

"Own allocations" means the server checks the user is allocated to that offering. The frontend only lists allocated subjects, but **the server must enforce it**.

---

## 5. Auth & session **[A]**

**Status: CONFIRMED** (EP-001 F-002, F-009)

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| AUTH-1 | POST | `/auth/login` | `LoginRequest` | `LoginResult` |
| AUTH-2 | POST | `/auth/refresh` | `{ refreshToken }` | `LoginResult` — **[O-15]** |
| AUTH-3 | POST | `/auth/logout` | — | `null` |
| AUTH-4 | GET | `/auth/me` | — | `SessionUser` |
| AUTH-5 | POST | `/auth/password/forgot` | `{ email }` | `null` (always succeeds; no account enumeration) |
| AUTH-6 | POST | `/auth/password/reset` | `{ token, newPassword }` | `null` |

```ts
type SystemRole = 'SUPER_ADMIN' | 'HOD' | 'FACULTY' | 'COORDINATOR' | 'LAB_ASSISTANT';

interface LoginRequest {
  username: string;       // username or institutional email
  password: string;
}

interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: IsoDateTime;
  user: SessionUser;
}

interface SessionUser {
  userId: ID;
  userCode: string;       // employee / faculty ID
  fullName: string;
  email: string;
  roles: SystemRole[];
  primaryRole: SystemRole;
  departmentId?: ID;      // absent for SUPER_ADMIN
  departmentName?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED';
  currentAcademicYear?: { academicYearId: ID; name: string }; // "2026-27"
}
```

- AUTH-4 is how the frontend restores a session after a page reload. It must not trust a role stored in the browser.
- Failed login returns **401 `INVALID_CREDENTIALS`** with the same message whether the user exists or not. A locked account returns **403 `ACCOUNT_LOCKED`**.

---

## 6. Academic structure (read) **[A]**

**Status: CONFIRMED shapes from Module 1 · fields marked TBD in Module 1 are left out**

Read-only lookups used to fill pickers across the app. Admin writes are in [§16](#16-super-admin-a).

| # | Method | Path | Query | Response |
| --- | --- | --- | --- | --- |
| ACAD-1 | GET | `/academic-years` | `status?` | `AcademicYear[]` |
| ACAD-2 | GET | `/academic-years/current` | — | `AcademicYear` |
| ACAD-3 | GET | `/departments` | — | `Department[]` |
| ACAD-4 | GET | `/programs` | `departmentId?` | `Program[]` |
| ACAD-5 | GET | `/syllabi` | `programId?`, `scope?` | `Syllabus[]` |
| ACAD-6 | GET | `/syllabi/{syllabusId}/semesters` | — | `Semester[]` |
| ACAD-7 | GET | `/semesters/{semesterId}/courses` | — | `SyllabusCourseSummary[]` |
| ACAD-8 | GET | `/syllabus-courses/{syllabusCourseId}` | — | `SyllabusCourse` |
| ACAD-9 | GET | `/programs/{programId}/outcomes` | `kind?` | `ProgramOutcome[]` — **[O-16]** |

```ts
interface AcademicYear {
  academicYearId: ID;
  name: string;            // "2026-27"
  startDate: IsoDate;
  endDate: IsoDate;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  isCurrent: boolean;
}

interface Department { departmentId: ID; departmentCode: string; departmentName: string; status: 'ACTIVE' | 'INACTIVE'; }

interface Program {
  programId: ID;
  departmentId: ID;
  programCode: string;
  programName: string;     // "B.Tech Electronics & Computer Engineering"
  programLevel: 'UG' | 'PG';
  status: 'ACTIVE' | 'INACTIVE';
}

interface Syllabus {
  syllabusId: ID;
  scope: 'PROGRAM' | 'FIRST_YEAR';
  programId?: ID;          // null when scope = FIRST_YEAR
  syllabusName: string;
  schemeCode?: string;
  effectiveFrom?: IsoDate;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

interface Semester {
  semesterId: ID;
  syllabusId: ID;
  semesterNumber: number;  // 1..8
  studyYear?: 'FIRST' | 'SECOND' | 'THIRD' | 'FINAL'; // Program Year / Study Year
}

type CourseType =
  | 'CORE' | 'PROGRAM_ELECTIVE' | 'OPEN_ELECTIVE' | 'SKILL_BASED' | 'SELF_LEARNING'
  | 'SEMINAR' | 'MINI_PROJECT' | 'PROJECT' | 'INTERNSHIP' | 'FIELD_PROJECT'
  | 'DISSERTATION' | 'MOOC' | 'OTHER';

interface SyllabusCourseSummary extends CourseRef {
  courseType: CourseType;
  credits: number;
  semesterId: ID;
  electiveGroupName?: string;   // when the course is an elective option
}

/** Full Syllabus Course — mirrors the Module 1 document. */
interface SyllabusCourse extends SyllabusCourseSummary {
  syllabusId: ID;
  introduction?: string;
  prerequisite?: string;
  objectives: string[];
  courseOutcomes: CourseOutcome[];
  units: SyllabusUnit[];
  teachingScheme: { lectureHours: number; tutorialHours: number; practicalHours: number };
  examinationScheme: { components: { type: AssessmentComponentType; maxMarks: number }[] };
  icaDescription?: string;
  textBooks: string[];
  referenceBooks: string[];
  learningResources: { title: string; resourceType: LearningResourceType; resourceLocation: string }[];
  guidelines?: string;          // project / internship / MOOC courses
}

interface SyllabusUnit {
  unitNumber: number;     // the only unit reference in Module 1 — no unitId [O-1]
  title: string;
  content: string;
  hours?: number;
}

type LearningResourceType = 'NOTES' | 'PPT' | 'PDF' | 'VIDEO' | 'COURSE' | 'WEB_RESOURCE' | 'OTHER';
```

---

## 7. Faculty workspace **[A]**

**Status: CONFIRMED** (faculty subject selection)

A faculty member works on an **offering**: one subject, in one academic year, for their division (if any). Module 1 hasn't finalized the offering/section model yet, so `offeringId` is an **opaque ID issued by the backend** **[O-2]**. Every per-subject endpoint below hangs off it.

| # | Method | Path | Query | Response |
| --- | --- | --- | --- | --- |
| FAC-1 | GET | `/me/offerings` | `academicYearId?`, `semesterId?` | `FacultyOffering[]` |
| FAC-2 | GET | `/offerings/{offeringId}` | — | `FacultyOffering` |
| FAC-3 | GET | `/me/dashboard` | `academicYearId?` | `FacultyDashboard` |

```ts
interface FacultyOffering {
  offeringId: ID;
  course: CourseRef;
  courseType: CourseType;
  academicYear: { academicYearId: ID; name: string };
  semester: { semesterId: ID; semesterNumber: number };
  programName?: string;
  division?: string;              // "A"
  batch?: string;                 // practical batch
  myResponsibilities: CourseAssignmentRole[];
  progress: OfferingProgress;     // drives the stage cards on the dashboard
}

/** Per-stage status. The backend decides each value; the frontend only displays. */
interface OfferingProgress {
  assessmentPlan: 'NOT_STARTED' | 'DRAFT' | 'FINALIZED';
  cam:            'NOT_STARTED' | 'DRAFT' | 'FINALIZED';
  paperValidation:'NOT_STARTED' | 'IN_PROGRESS' | 'SENT_TO_MODERATOR';
  marksheets:     'NOT_STARTED' | 'PARTIAL' | 'COMPLETE';  // structures finalized
  marks:          'NOT_STARTED' | 'PARTIAL' | 'COMPLETE';  // approved uploads
  attainment:     'NOT_STARTED' | 'CALCULATED' | 'SUBMITTED';
}

interface FacultyDashboard {
  offeringsCount: number;
  pendingMarksReviews: number;     // lab uploads waiting for this faculty
  draftsInProgress: number;
  offerings: FacultyOffering[];
}
```

- FAC-1 returns **only** offerings the coordinator allocated to the caller. An empty list is a normal state ("No subjects allocated yet").
- Requesting another faculty's `offeringId` returns **403**, not 404.

---

## 8. Assessment plan **[A]**

**Status: CONFIRMED** · categories **[O-8]**

The faculty lists every assessment for the subject (ISE-1, ISE-2, ICA activities, ESE…) with marks and the COs each one covers.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| PLAN-1 | GET | `/offerings/{offeringId}/assessment-plan` | — | `AssessmentPlan` (empty `DRAFT` if none) |
| PLAN-2 | PUT | `/offerings/{offeringId}/assessment-plan` | `AssessmentPlanUpdate` | `AssessmentPlan` |
| PLAN-3 | POST | `/offerings/{offeringId}/assessment-plan/finalize` | `{ version }` | `AssessmentPlan` |

```ts
type AssessmentCategory =
  | 'ISE' | 'ICA' | 'ACTIVITY' | 'PRACTICAL' | 'POE' | 'OE' | 'OE_POE' | 'ESE';

interface AssessmentPlan {
  planId: ID;
  offeringId: ID;
  status: 'DRAFT' | 'FINALIZED';
  version: number;
  /** Read-only echo of the syllabus exam scheme, so the UI can show totals per component. */
  examinationScheme: { components: { type: AssessmentComponentType; maxMarks: number }[] };
  assessments: PlannedAssessment[];
  /** Server-side checks, e.g. "ISE total 50 ≠ scheme 40". Shown as warnings; finalize may reject. */
  issues: { code: string; message: string; assessmentId?: ID }[];
  updatedAt: IsoDateTime;
  updatedBy: string;
}

interface PlannedAssessment {
  assessmentId?: ID;             // absent for rows not yet saved
  category: AssessmentCategory;
  componentType: AssessmentComponentType; // backend fills from category [O-8]
  name: string;                  // "ISE-1"
  sequence: number;              // 1, 2, 3 within the category
  maxMarks: number;              // > 0
  coIds: ID[];                   // min 1; must belong to this syllabus course
  plannedDate?: IsoDate;
}

interface AssessmentPlanUpdate {
  version: number;
  assessments: PlannedAssessment[];
}
```

- Several assessments of the same category are allowed (ISE-1, ISE-2, ISE-3).
- Removing an assessment that already has a marksheet or marks returns **409 `ASSESSMENT_IN_USE`**.
- No attainment maths here.

---

## 9. Course Articulation Matrix (CAM) **[A + M]**

**Status: CONFIRMED**

The CAM is the CO → PO/PSO correlation matrix for this offering, plus descriptive sections. Faculty fills it in. AI can **suggest** values, but it never writes into the matrix by itself.

| # | Method | Path | Body | Response | Owner |
| --- | --- | --- | --- | --- | --- |
| CAM-1 | GET | `/offerings/{offeringId}/cam` | — | `Cam` (empty `DRAFT` if none) | A |
| CAM-2 | PUT | `/offerings/{offeringId}/cam` | `CamUpdate` | `Cam` | A |
| CAM-3 | POST | `/offerings/{offeringId}/cam/finalize` | `{ version }` | `Cam` | A |
| CAM-4 | POST | `/offerings/{offeringId}/cam/suggestions` | `{ coIds?: ID[] }` | `CamSuggestionSet` | M |

```ts
interface Cam {
  camId: ID;
  offeringId: ID;
  status: 'DRAFT' | 'FINALIZED';
  version: number;
  courseOutcomes: CourseOutcome[];      // read-only, from the syllabus course
  programOutcomes: ProgramOutcome[];    // POs and PSOs of the program, read-only
  cells: CamCell[];                     // only non-empty cells are sent
  description?: string;
  activities: CamItem[];
  practicals: CamItem[];
  tutorials: CamItem[];
  updatedAt: IsoDateTime;
  updatedBy: string;
}

interface CamCell {
  coId: ID;
  outcomeId: ID;                        // a PO or PSO
  level: CorrelationLevel;
  justification?: string;
  /** Where the value came from. Lets the UI and audit tell AI and faculty input apart. */
  source: 'FACULTY' | 'AI_ACCEPTED' | 'AI_EDITED';
  suggestionId?: ID;                    // set when source is AI_*
}

interface CamItem {
  itemId?: ID;
  title: string;
  description?: string;
  coIds: ID[];
}

interface CamUpdate {
  version: number;
  cells: CamCell[];
  description?: string;
  activities: CamItem[];
  practicals: CamItem[];
  tutorials: CamItem[];
}

interface CamSuggestionSet extends AiProvenance {
  suggestionSetId: ID;
  suggestions: CamSuggestion[];
}

interface CamSuggestion {
  suggestionId: ID;
  coId: ID;
  outcomeId: ID;
  suggestedLevel: CorrelationLevel | null;   // null = "no correlation"
  rationale: string;
  confidence?: number;                       // 0..1, display only
}
```

**Rules**

- CAM-4 only returns suggestions. It never changes the saved CAM.
- The faculty accepts, edits or rejects each suggestion in the UI. Accepted ones are saved through CAM-2 with `source: 'AI_ACCEPTED' | 'AI_EDITED'` and the `suggestionId`.
- A suggestion never overwrites a cell the faculty has already filled, unless the faculty explicitly accepts it for that cell.
- CAM-3 is the faculty's final review. After it, the matrix is read-only and becomes the input to attainment.

---

## 10. Question paper validation **[A + M]**

**Status: CONFIRMED**

Faculty uploads an exam paper. The AI checks each question against the course outcomes and Bloom levels and scores it. The faculty reviews the result, exports a PDF report and sends it to a moderator.

**Ownership:** Abhijeet owns the resource, file storage, export and moderator hand-off. Mayuri owns text extraction and analysis. The frontend sees one resource either way.

### 10.1 Lifecycle

```
UPLOADED → EXTRACTING → AWAITING_CONFIGURATION → ANALYZING → ANALYSIS_READY → SENT_TO_MODERATOR
               ↓                                      ↓
        EXTRACTION_FAILED                       ANALYSIS_FAILED   (both can be retried)
```

### 10.2 Endpoints

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| QPV-1 | POST | `/qp-validations` | multipart: `meta` = `QpValidationCreate`, `file` | `QpValidation` (202, `UPLOADED`) |
| QPV-2 | GET | `/qp-validations/{validationId}` | — | `QpValidation` |
| QPV-3 | GET | `/qp-validations` | query `offeringId`, `page`, `size` | `Page<QpValidationSummary>` |
| QPV-4 | PUT | `/qp-validations/{validationId}/configuration` | `QpValidationConfiguration` | `QpValidation` |
| QPV-5 | POST | `/qp-validations/{validationId}/analysis` | — | `QpValidation` (202, `ANALYZING`) |
| QPV-6 | GET | `/qp-validations/{validationId}/result` | — | `QpValidationResult` |
| QPV-7 | POST | `/qp-validations/{validationId}/report` | — | `ExportFile` (PDF) or `AsyncJob` |
| QPV-8 | POST | `/qp-validations/{validationId}/submit-to-moderator` | `ModeratorSubmission` | `QpValidation` |
| QPV-9 | GET | `/bloom-keywords/defaults` | — | `BloomKeywordMap` — ASSUMPTION |
| QPV-10 | POST | `/qp-validations/{validationId}/retry` | — | `QpValidation` (re-runs the failed step) |

**Upload limits (ASSUMPTION):** PDF or DOCX, 10 MB max. Wrong type → **415 `UNSUPPORTED_FILE_TYPE`**. Too large → **413 `FILE_TOO_LARGE`**.

### 10.3 Types

```ts
type ExamCategory = 'ISE' | 'ESE';

type QpValidationStatus =
  | 'UPLOADED' | 'EXTRACTING' | 'EXTRACTION_FAILED'
  | 'AWAITING_CONFIGURATION' | 'ANALYZING' | 'ANALYSIS_FAILED'
  | 'ANALYSIS_READY' | 'SENT_TO_MODERATOR';

interface QpValidationCreate {
  offeringId: ID;
  examCategory: ExamCategory;
  assessmentId?: ID;             // link to a planned assessment, if known
}

interface QpValidation {
  validationId: ID;
  offeringId: ID;
  course: CourseRef;
  examCategory: ExamCategory;
  status: QpValidationStatus;
  file: { fileName: string; mimeType: string; sizeBytes: number; uploadedAt: IsoDateTime };
  extractedQuestionCount?: number;              // after EXTRACTING
  configuration?: QpValidationConfiguration;    // pre-filled from the syllabus COs [O-14]
  error?: { errorCode: string; message: string }; // when *_FAILED
  updatedAt: IsoDateTime;
}

type QpValidationSummary = Pick<QpValidation,
  'validationId' | 'examCategory' | 'status' | 'updatedAt'> & {
  fileName: string;
  overallValidationScore?: number;
};

interface QpValidationConfiguration {
  courseOutcomes: { coId?: ID; code: string; description: string }[]; // order = display order; min 1
  bloomKeywords: BloomKeywordMap;
}

/** Faculty-defined keywords that guide the AI. The frontend only edits them. */
type BloomKeywordMap = Record<BloomLevel, string[]>;

interface QpValidationResult extends AiProvenance {
  validationId: ID;
  status: 'ANALYSIS_READY' | 'SENT_TO_MODERATOR';
  overallValidationScore: number;            // 0..100, computed by the backend
  summary?: string;                          // short AI overview
  questions: ValidatedQuestion[];
  /** Optional roll-ups for charts. Backend-computed, display only. */
  coCoverage?: { code: string; questionCount: number; marks?: number }[];
  bloomDistribution?: { level: BloomLevel; questionCount: number; marks?: number }[];
}

interface ValidatedQuestion {
  questionId: ID;
  questionNumber: string;                    // "1", "2(a)", "Q3 b"
  questionText: string;                      // may be long; UI truncates and expands
  marks?: number;
  assignedCoCode?: string;                   // as printed or parsed on the paper
  coAlignment: 'ALIGNED' | 'PARTIAL' | 'MISALIGNED' | 'UNKNOWN';
  suggestedCoCode?: string;                  // AI's best match, if different
  detectedBloomLevel?: BloomLevel;
  bloomAlignment: 'ALIGNED' | 'PARTIAL' | 'MISALIGNED' | 'UNKNOWN';
  aiAnalysis: string;                        // explanation shown in the detail panel
  validationScore: number;                   // 0..100
  flags?: string[];                          // e.g. "AMBIGUOUS_WORDING"
}

interface ModeratorSubmission {
  moderatorUserId?: ID;   // omit → the backend picks the offering's assigned MODERATOR
  note?: string;
}
```

**Rules**

- Questions are **extracted from the file by the backend**. The frontend never parses the paper.
- QPV-4 is allowed in `AWAITING_CONFIGURATION` and `ANALYSIS_READY`. Changing the configuration after analysis means running QPV-5 again.
- The scoring formula belongs to the backend. The frontend shows `validationScore` and `overallValidationScore` as given.
- QPV-8 needs status `ANALYSIS_READY`. Otherwise it returns **409 `INVALID_STATE`**.

---

## 11. Knowledge base & AI question generation **[M + A]**

**Status: CONFIRMED** (EP-002 F-014 → F-019; Pipelines 1–3)

### 11.1 Knowledge base (Pipeline 1) **[M]**

Faculty uploads study material for an offering. Pipeline 1 parses, chunks, embeds and stores it. Only `ACTIVE` material is used for generation.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| KB-1 | GET | `/offerings/{offeringId}/materials` | query `unitNumber?`, `status?` | `LearningMaterial[]` |
| KB-2 | POST | `/offerings/{offeringId}/materials` | multipart: `meta` = `MaterialCreate`, `file` | `LearningMaterial` (202, `PROCESSING`) |
| KB-3 | GET | `/materials/{materialId}` | — | `LearningMaterial` |
| KB-4 | POST | `/materials/{materialId}/versions` | multipart: `file` | `LearningMaterial` (new version, `PROCESSING`) |
| KB-5 | DELETE | `/materials/{materialId}` | — | `null` (soft delete: chunks leave retrieval) |
| KB-6 | GET | `/offerings/{offeringId}/knowledge-base/summary` | — | `KnowledgeBaseSummary` |

```ts
type MaterialType =
  | 'LECTURE_NOTES' | 'LECTURE_PPT' | 'TEXTBOOK' | 'QUESTION_BANK' | 'PREVIOUS_PAPER' | 'OTHER'; // [O-7]

type MaterialStatus = 'PROCESSING' | 'ACTIVE' | 'FAILED' | 'INACTIVE';

interface MaterialCreate {
  materialType: MaterialType;
  unitNumbers?: number[];   // which units this material covers [O-1]
  coIds?: ID[];             // optional tagging
  title?: string;
}

interface LearningMaterial {
  materialId: ID;
  version: number;
  title?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  materialType: MaterialType;
  unitNumbers: number[];
  coIds: ID[];
  status: MaterialStatus;
  /** Present while PROCESSING. */
  stage?: 'PARSING' | 'NORMALIZING' | 'CHUNKING' | 'EMBEDDING' | 'STORING';
  progressPercent?: number;            // 0..100, best effort
  chunkCount?: number;                 // when ACTIVE
  warnings: { code: string; message: string }[]; // e.g. OCR used, missing provenance
  error?: { errorCode: string; message: string };
  isDuplicate?: boolean;               // same file hash already ingested
  uploadedAt: IsoDateTime;
  uploadedBy: string;
}

interface KnowledgeBaseSummary {
  offeringId: ID;
  activeMaterials: number;
  processingMaterials: number;
  failedMaterials: number;
  /** Per unit: whether generation has any ACTIVE material to draw on. */
  units: { unitNumber: number; title: string; activeMaterials: number; ready: boolean }[];
}
```

**Version rule (from Pipeline 1 storage):** while version N+1 is `PROCESSING`, version N stays `ACTIVE`. If N+1 fails, N stays `ACTIVE` and N+1 becomes `FAILED`. The UI shows both.

### 11.2 Generation sessions (Pipelines 2 + 3) **[M]**

A session is one generation request plus its evidence and the questions it produced. Faculty works through the questions one by one.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| GEN-1 | POST | `/generation-sessions` | `GenerationRequest` | `GenerationSession` (202, `RETRIEVING`) |
| GEN-2 | GET | `/generation-sessions/{sessionId}` | — | `GenerationSession` |
| GEN-3 | GET | `/offerings/{offeringId}/generation-sessions` | query `page`, `size` | `Page<GenerationSessionSummary>` |
| GEN-4 | PATCH | `/generation-sessions/{sessionId}/questions/{questionId}` | `QuestionReviewUpdate` | `GeneratedQuestion` |
| GEN-5 | POST | `/generation-sessions/{sessionId}/questions/{questionId}/regenerate` | `{ instructions?: string }` | `GeneratedQuestion` |
| GEN-6 | GET | `/generation-sessions/{sessionId}/questions/{questionId}/history` | — | `GeneratedQuestion[]` (all versions) |

```ts
type RetrievalMode = 'TOPIC_SPECIFIC' | 'OVERALL_CO';

interface GenerationRequest {
  offeringId: ID;
  mode: RetrievalMode;
  coId: ID;
  unitNumber?: number;          // required when mode = TOPIC_SPECIFIC [O-1]
  topic?: string;               // optional; narrows TOPIC_SPECIFIC retrieval
  questionCount?: number;       // omit → AI suggests a count from the evidence
  marks: number;                // per question
  questionType: QuestionType;
  difficulty: Difficulty;
  bloomLevel: BloomLevel;
  instructions?: string;        // free-text faculty instructions
}

type GenerationStatus = 'RETRIEVING' | 'GENERATING' | 'READY' | 'FAILED';
type EvidenceStatus = 'SUFFICIENT' | 'INSUFFICIENT' | 'ASSESSMENT_FAILED';

interface GenerationSession extends AiProvenance {
  sessionId: ID;
  offeringId: ID;
  status: GenerationStatus;
  request: GenerationRequest;
  evidence?: {
    status: EvidenceStatus;
    explanation: string;          // shown when INSUFFICIENT: why fewer questions came back
    chunks: EvidenceChunk[];
  };
  requestedCount?: number;
  generatedCount: number;
  questions: GeneratedQuestion[];
  error?: { errorCode: string; message: string };
  createdAt: IsoDateTime;
}

type GenerationSessionSummary = Pick<GenerationSession,
  'sessionId' | 'status' | 'generatedCount' | 'createdAt'> & {
  coCode: string;
  mode: RetrievalMode;
  acceptedCount: number;
};

/** Source excerpt shown next to questions so faculty can check grounding. */
interface EvidenceChunk {
  chunkId: ID;
  excerpt: string;                // trimmed text; vectors are never sent
  materialId: ID;
  materialVersion: number;
  provenance: { fileName: string; page?: number; slide?: number; section?: string };
}

interface QuestionOption { key: string; text: string; isCorrect?: boolean } // MCQ only

interface GeneratedQuestion {
  questionId: ID;                 // stable across regenerations
  version: number;                // increments on regenerate or edit
  text: string;
  marks: number;
  questionType: QuestionType;
  options?: QuestionOption[];
  coId: ID;
  coCode: string;
  unitNumber?: number;
  topic?: string;
  bloomLevel: BloomLevel;
  difficulty: Difficulty;
  evidenceChunkIds: ID[];
  /** AI checks (Pipeline 3 step 6). NOT_VALIDATED after a manual edit. */
  validationStatus: 'PASSED' | 'FAILED_VALIDATION' | 'NOT_VALIDATED';
  validationNotes: string[];
  reviewStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  origin: 'AI_GENERATED' | 'AI_REGENERATED' | 'FACULTY_EDITED';
  originalText?: string;          // first AI version, kept for audit and compare
}

interface QuestionReviewUpdate {
  version: number;
  reviewStatus?: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  text?: string;                  // presence = manual edit
  marks?: number;
  options?: QuestionOption[];
}
```

**Rules**

- `INSUFFICIENT` evidence is **not** an error. The session is `READY` with fewer questions and an explanation. `ASSESSMENT_FAILED` makes the session `FAILED`.
- GEN-5 replaces **one** question. CO, topic and marks stay the same unless the instructions say otherwise. Other questions don't change. If regeneration fails, the server returns **422 `REGENERATION_FAILED`** and the existing question is untouched.
- A manual edit sets `origin: 'FACULTY_EDITED'` and `validationStatus: 'NOT_VALIDATED'`. The UI keeps "faculty approved" and "AI validated" visibly separate.
- Rejected questions stay in the session for history but are never saved to the bank.

### 11.3 Question bank and papers **[A]**

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| QB-1 | POST | `/generation-sessions/{sessionId}/save-to-bank` | `{ questionIds: ID[] }` | `SaveToBankResult` |
| QB-2 | GET | `/offerings/{offeringId}/question-bank` | query `marks?`, `coId?`, `bloomLevel?`, `page`, `size` | `Page<BankQuestion>` |
| QP-1 | POST | `/question-papers` | `QuestionPaperCreate` | `QuestionPaper` (`DRAFT`) |
| QP-2 | GET | `/question-papers/{paperId}` | — | `QuestionPaper` |
| QP-3 | PUT | `/question-papers/{paperId}` | `QuestionPaperCreate & { version }` | `QuestionPaper` |
| QP-4 | POST | `/question-papers/{paperId}/approve` | `{ version, remarks? }` | `QuestionPaper` (`APPROVED`, read-only) |
| QP-5 | POST | `/question-papers/{paperId}/export` | `{ format: 'PDF' \| 'DOCX', includeAnswerKey?: boolean }` | `ExportFile` or `AsyncJob` |
| QP-6 | GET | `/offerings/{offeringId}/question-papers` | — | `QuestionPaperSummary[]` |

```ts
interface SaveToBankResult {
  saved: { questionId: ID; bankQuestionId: ID }[];
  possibleDuplicates: { questionId: ID; similarBankQuestionId: ID }[]; // warning only; still saved
  failed: { questionId: ID; message: string }[];                       // can be retried
}

interface BankQuestion {
  bankQuestionId: ID;
  text: string;
  marks: number;
  questionType: QuestionType;
  options?: QuestionOption[];
  coId: ID;
  coCode: string;
  bloomLevel: BloomLevel;
  difficulty: Difficulty;
  origin: 'AI_GENERATED' | 'FACULTY_EDITED' | 'MANUAL';
  sourceSessionId?: ID;
  createdAt: IsoDateTime;
}

interface QuestionPaperCreate {
  offeringId: ID;
  title: string;
  examName?: string;
  durationMinutes?: number;
  instructions?: string;
  sections: { title: string; bankQuestionIds: ID[] }[];
}

interface QuestionPaper extends QuestionPaperCreate {
  paperId: ID;
  status: 'DRAFT' | 'APPROVED';
  version: number;
  totalMarks: number;          // backend-computed
  totalQuestions: number;
  approvedAt?: IsoDateTime;
  approvedBy?: string;
  createdAt: IsoDateTime;
}

type QuestionPaperSummary = Pick<QuestionPaper,
  'paperId' | 'title' | 'status' | 'totalMarks' | 'createdAt'>;
```

- Reusing a bank question in a paper copies it, so editing the paper never changes the saved bank question.
- The answer key (`isCorrect`) is only included when `includeAnswerKey: true`. The student copy never has it.

---

## 12. Marksheet structure **[A]**

**Status: CONFIRMED** (structure editor) · Excel template layout **PENDING**

For each planned assessment, the faculty defines its questions and sub-questions, which CO each one tests, the marks, and how many must be attempted. The backend generates the Excel marksheet from this. This structure is also where questions get mapped to COs (F-021).

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| MS-1 | GET | `/assessments/{assessmentId}/structure` | — | `AssessmentStructure` |
| MS-2 | PUT | `/assessments/{assessmentId}/structure` | `AssessmentStructureUpdate` | `AssessmentStructure` |
| MS-3 | POST | `/assessments/{assessmentId}/structure/finalize` | `{ version }` | `AssessmentStructure` |
| MS-4 | POST | `/assessments/{assessmentId}/marksheet-template` | — | `ExportFile` (XLSX) |

```ts
interface AssessmentStructure {
  assessmentId: ID;
  offeringId: ID;
  assessmentName: string;            // "ISE-1"
  plannedMaxMarks: number;           // from the assessment plan
  status: 'DRAFT' | 'FINALIZED';
  version: number;
  questions: StructureQuestion[];
  /** Paper-level rule, e.g. "attempt any 4 of 5 questions". */
  attemptRule?: AttemptRule;
  /** Backend-computed, taking attempt rules into account. Display only. */
  computedMaxMarks?: number;
  issues: { code: string; message: string; path?: string }[];
}

interface StructureQuestion {
  questionNo: string;                // "Q1"
  /** Either sub-questions OR (coIds + maxMarks) on the question itself. */
  subQuestions?: SubQuestion[];
  coIds?: ID[];                      // [O-9]
  maxMarks?: number;
  bloomLevel?: BloomLevel;
  attemptRule?: AttemptRule;         // e.g. attempt 2 of Q1(a), (b), (c)
}

interface SubQuestion {
  label: string;                     // "a"
  coIds: ID[];                       // min 1 [O-9]
  maxMarks: number;
  bloomLevel?: BloomLevel;
}

interface AttemptRule {
  attempt: number;                   // must answer this many…
  outOf: number;                     // …out of this many
}

interface AssessmentStructureUpdate {
  version: number;
  questions: StructureQuestion[];
  attemptRule?: AttemptRule;
}
```

- The frontend may show running totals as a preview, but `computedMaxMarks` and `issues` from the server are what count.
- MS-4 needs status `FINALIZED`. The workbook layout and columns belong to the backend and are **PENDING** until the reference Excel files are shared.

---

## 13. Marks upload & review **[A]**

**Status: CONFIRMED** (EP-003 F-022, F-023; lab assistant workflow)

A lab assistant (or the faculty) uploads a filled marksheet. The backend validates it. The faculty reviews it and approves it before it counts towards attainment.

| # | Method | Path | Body | Response | Who |
| --- | --- | --- | --- | --- | --- |
| MK-1 | GET | `/lab/assessments` | query `academicYearId?` | `UploadableAssessment[]` | LAB_ASSISTANT |
| MK-2 | POST | `/assessments/{assessmentId}/marks-uploads` | multipart: `file` (.xlsx) | `MarksUpload` (202, `VALIDATING`) | LAB_ASSISTANT, FACULTY |
| MK-3 | GET | `/marks-uploads/{uploadId}` | — | `MarksUpload` | uploader, faculty |
| MK-4 | GET | `/marks-uploads` | query `assessmentId?`, `offeringId?`, `status?`, `mine?`, `page`, `size` | `Page<MarksUpload>` | all three |
| MK-5 | GET | `/marks-uploads/{uploadId}/rows` | query `onlyErrors?`, `page`, `size` | `Page<MarksRow>` | uploader, faculty |
| MK-6 | POST | `/marks-uploads/{uploadId}/approve` | `{ note? }` | `MarksUpload` | FACULTY |
| MK-7 | POST | `/marks-uploads/{uploadId}/reject` | `{ reason }` | `MarksUpload` | FACULTY |

```ts
interface UploadableAssessment {
  assessmentId: ID;
  assessmentName: string;
  offeringId: ID;
  course: CourseRef;
  division?: string;
  structureFinalized: boolean;   // false → upload disabled with a reason
  latestUploadStatus?: MarksUploadStatus;
}

type MarksUploadStatus =
  | 'VALIDATING'
  | 'VALIDATION_FAILED'         // file rejected; nothing stored
  | 'PENDING_FACULTY_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED';               // a later upload for the same assessment was approved

interface MarksUpload {
  uploadId: ID;
  assessmentId: ID;
  assessmentName: string;
  course: CourseRef;
  fileName: string;
  status: MarksUploadStatus;
  uploadedBy: { userId: ID; fullName: string; role: SystemRole };
  uploadedAt: IsoDateTime;
  validation?: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    errors: MarksRowError[];     // first 100; the rest via MK-5
  };
  reviewedBy?: { userId: ID; fullName: string };
  reviewedAt?: IsoDateTime;
  reviewNote?: string;
}

interface MarksRowError {
  row: number;                   // 1-based Excel row
  rollNumber?: string;
  column?: string;               // "Q1(a)"
  code: 'UNKNOWN_STUDENT' | 'DUPLICATE_STUDENT' | 'MISSING_VALUE' | 'NOT_A_NUMBER'
      | 'OUT_OF_RANGE' | 'BAD_TEMPLATE' | 'OTHER';
  message: string;
}

interface MarksRow {
  row: number;
  rollNumber: string;
  studentName?: string;
  marks: Record<string, number | 'AB' | null>; // key = question label, "AB" = absent
  total?: number;                // backend-computed
  errors: MarksRowError[];
}
```

**Limits (from F-022):** `.xlsx` only, the institution template only, up to 5,000 student rows. Size limit is configured server-side → **413** when exceeded.

---

## 14. CO-PO attainment **[A]**

**Status: CONFIRMED** (screens, flow) · **formulas PENDING**

The CO and PO formulas aren't specified yet (`AGENTS.md`). So this contract describes **what the screen shows**, not how it's calculated:

- Each result has a few fixed fields the UI needs for layout (code, level, met/not met).
- Everything else goes in a `breakdown: BreakdownRow[]` list. When the formula is agreed, Abhijeet can add, rename or reorder breakdown rows **without a contract change**, and the UI renders them as they come.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| ATT-1 | GET | `/offerings/{offeringId}/attainment/readiness` | — | `AttainmentReadiness` |
| ATT-2 | POST | `/offerings/{offeringId}/attainment/runs` | `{ confirmRecalculation?: boolean }` | `AttainmentRun` (202, `RUNNING`) |
| ATT-3 | GET | `/attainment/runs/{runId}` | — | `AttainmentRun` |
| ATT-4 | GET | `/offerings/{offeringId}/attainment/runs` | — | `AttainmentRunSummary[]` (newest first) |
| ATT-5 | POST | `/attainment/runs/{runId}/export` | `{ format: 'XLSX' \| 'PDF' }` | `ExportFile` or `AsyncJob` |
| ATT-6 | POST | `/attainment/runs/{runId}/submit` | `{ note? }` | `AttainmentRun` (`SUBMITTED_TO_HOD`) |
| ATT-7 | GET | `/offerings/{offeringId}/attainment-targets` | — | `AttainmentTargetConfig` (read-only for faculty) |

```ts
interface AttainmentReadiness {
  ready: boolean;
  checks: {
    code: 'ASSESSMENT_PLAN_FINALIZED' | 'CAM_FINALIZED' | 'QUESTION_CO_MAPPING'
        | 'VALIDATED_MARKS' | 'TARGETS_CONFIGURED';
    satisfied: boolean;
    detail?: string;            // "ISE-2 has no approved marks"
  }[];
}

type AttainmentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';
type AttainmentReviewStatus = 'DRAFT' | 'SUBMITTED_TO_HOD' | 'APPROVED' | 'REVISION_REQUESTED'; // HOD actions PENDING

interface AttainmentRun {
  runId: ID;
  offeringId: ID;
  course: CourseRef;
  academicYear: string;
  version: number;              // each recalculation is a new version; old ones are kept
  status: AttainmentRunStatus;
  reviewStatus: AttainmentReviewStatus;
  targets: AttainmentTargetConfig;   // snapshot used for this run
  coResults: CoAttainmentResult[];
  outcomeResults: OutcomeAttainmentResult[]; // POs and PSOs
  summary: BreakdownRow[];           // headline figures for the top of the page
  error?: { errorCode: string; message: string };
  generatedAt?: IsoDateTime;
  generatedBy: string;
}

interface CoAttainmentResult {
  coId: ID;
  code: string;                  // "CO1"
  statement: string;
  attainmentLevel: AttainmentLevel | null;
  targetMet: boolean | null;     // null when not computable (e.g. no data)
  headlineValue?: number;        // the single number the table shows; meaning PENDING
  headlineUnit?: string;         // "%", "/3"
  breakdown: BreakdownRow[];     // everything else — formula-agnostic
}

interface OutcomeAttainmentResult {
  outcomeId: ID;
  kind: OutcomeKind;
  code: string;                  // "PO2", "PSO1"
  statement: string;
  attainmentLevel: AttainmentLevel | null;
  headlineValue?: number;
  headlineUnit?: string;
  contributingCoCodes: string[];
  breakdown: BreakdownRow[];
}

type AttainmentRunSummary = Pick<AttainmentRun,
  'runId' | 'version' | 'status' | 'reviewStatus' | 'generatedAt' | 'generatedBy'>;
```

**Rules**

- ATT-2 while a completed run already exists and `confirmRecalculation` isn't `true` → **409 `RECALCULATION_NEEDS_CONFIRMATION`**. The UI then asks the faculty to confirm.
- ATT-2 when readiness fails → **422 `PRECONDITION_FAILED`** with the failing checks in `fieldErrors`.
- ATT-5 `XLSX` is the institution workbook (sheets *Main*, *PO&PSO Attainment*, *Data*). How it's filled is **PENDING** and backend-owned.
- ATT-6 only changes the status. What HOD does next is **PENDING**.

---

## 15. Coordination (coordinator) **[A]**

**Status: CONFIRMED** (faculty management, subject allocation, threshold/target) · scope **[O-3] [O-4] [O-5]**

Shown inside the Faculty portal under **Coordination** to users with the `COORDINATOR` role. Every endpoint is limited to the coordinator's own scope (department or program, per [O-3]).

### 15.1 Faculty management

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| CRD-1 | GET | `/coordination/faculty` | query `status?`, `search?`, `page`, `size` | `Page<FacultyMember>` |
| CRD-2 | POST | `/coordination/faculty` | `FacultyCreate` | `FacultyMember` |
| CRD-3 | PATCH | `/coordination/faculty/{userId}` | `FacultyUpdate` | `FacultyMember` |
| CRD-4 | POST | `/coordination/faculty/{userId}/resend-invite` | — | `FacultyMember` |

```ts
interface FacultyMember {
  userId: ID;
  facultyCode: string;           // "Faculty ID"
  fullName: string;
  email: string;
  departmentId: ID;
  status: 'ACTIVE' | 'INACTIVE';
  /** Credential workflow. The frontend never sees or sets passwords. */
  credentialStatus: 'INVITE_PENDING' | 'INVITE_SENT' | 'ACTIVATED' | 'INVITE_EXPIRED';
  allocationCount: number;
  createdAt: IsoDateTime;
}

interface FacultyCreate {
  facultyCode: string;           // unique → 409 DUPLICATE_FACULTY_CODE
  fullName: string;
  email: string;                 // unique → 409 DUPLICATE_EMAIL
  departmentId?: ID;             // defaults to the coordinator's department
}

interface FacultyUpdate {
  fullName?: string;
  email?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}
```

Creating a faculty member makes the backend send an activation link by email. Deactivating keeps history; there's no hard delete.

### 15.2 Subject allocation

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| CRD-5 | GET | `/coordination/allocations` | query `academicYearId`, `semesterId?`, `facultyUserId?` | `SubjectAllocation[]` |
| CRD-6 | POST | `/coordination/allocations` | `AllocationCreate` | `SubjectAllocation` |
| CRD-7 | PATCH | `/coordination/allocations/{allocationId}` | `AllocationUpdate` | `SubjectAllocation` |
| CRD-8 | POST | `/coordination/allocations/{allocationId}/end` | `{ effectiveTo?: IsoDate }` | `SubjectAllocation` |

Subjects to pick from come from ACAD-6/ACAD-7.

```ts
interface SubjectAllocation {
  allocationId: ID;
  academicYearId: ID;
  semester: { semesterId: ID; semesterNumber: number };
  course: CourseRef;
  faculty: { userId: ID; fullName: string; facultyCode: string };
  assignmentRole: CourseAssignmentRole;
  isPrimary: boolean;
  division?: string;
  batch?: string;
  offeringId: ID;                // what the faculty will see in FAC-1
  effectiveFrom: IsoDate;
  effectiveTo?: IsoDate;
  status: 'ACTIVE' | 'ENDED';
}

interface AllocationCreate {
  academicYearId: ID;
  semesterId: ID;
  syllabusCourseId: ID;
  facultyUserId: ID;
  assignmentRole: CourseAssignmentRole;
  isPrimary?: boolean;
  division?: string;
  batch?: string;
}

type AllocationUpdate = Partial<Pick<AllocationCreate,
  'assignmentRole' | 'isPrimary' | 'division' | 'batch'>>;
```

Server rules from the July design: one active primary `COURSE_COORDINATOR` per course per academic year (**409 `PRIMARY_ALREADY_ASSIGNED`**); allocating an inactive faculty member → **422**.

### 15.3 Threshold and target configuration

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| CRD-9 | GET | `/coordination/attainment-targets` | query `academicYearId` | `AttainmentTargetConfig` |
| CRD-10 | PUT | `/coordination/attainment-targets` | `AttainmentTargetUpdate` | `AttainmentTargetConfig` |
| CRD-11 | GET | `/coordination/attainment-targets/history` | query `academicYearId` | `AttainmentTargetConfig[]` |

```ts
interface AttainmentTargetConfig {
  configId: ID;
  version: number;
  scope: { academicYearId: ID; departmentId?: ID; programId?: ID };
  targetPercentage: number;          // 0..100
  thresholds: ThresholdBand[];       // ascending, non-overlapping
  updatedBy: string;
  updatedAt: IsoDateTime;
}

interface ThresholdBand {
  level: 1 | 2 | 3;
  minPercentage: number;             // inclusive
  maxPercentage?: number;            // inclusive; omit for the top band
}

interface AttainmentTargetUpdate {
  version: number;
  academicYearId: ID;
  targetPercentage: number;
  thresholds: ThresholdBand[];
}
```

- Saving creates a new version. Earlier versions stay readable (CRD-11) for audit, and attainment runs keep the snapshot they used.
- Faculty only ever read these values (ATT-7); they get no edit control.
- Direct/indirect weightages are **not** here. They belong to the formula, which is **PENDING** **[O-11]**.

---

## 16. Super Admin **[A]**

**Status: CONFIRMED** (screens exist) · shapes follow Module 1, which isn't fully closed

Standard list/create/update for the Module 1 collections. All use the shapes in [§6](#6-academic-structure-read-a) plus `status`. Records are deactivated, never hard-deleted.

| # | Collection | Endpoints |
| --- | --- | --- |
| ADM-1 | Institution | `GET /institution` · `PUT /institution` |
| ADM-2 | Academic years | `POST /academic-years` · `PATCH /academic-years/{id}` · `POST /academic-years/{id}/make-current` |
| ADM-3 | Departments | `POST /departments` · `PATCH /departments/{id}` |
| ADM-4 | Programs | `POST /programs` · `PATCH /programs/{id}` |
| ADM-5 | Syllabi | `POST /syllabi` · `PATCH /syllabi/{id}` (a revision is a **new** syllabus, never an edit) |
| ADM-6 | Semesters | `POST /syllabi/{id}/semesters` · `PATCH /semesters/{id}` |
| ADM-7 | Course master | `GET /courses` · `POST /courses` · `PATCH /courses/{id}` — fields: `courseCode`, `courseName`, `courseType` |
| ADM-8 | Syllabus courses | `POST /syllabus-courses` · `PUT /syllabus-courses/{id}` (full `SyllabusCourse`) |
| ADM-9 | Elective groups | `GET /syllabi/{id}/elective-groups` · `POST /elective-groups` · `PATCH /elective-groups/{id}` — `{ groupName, electiveType, semesterId, courseOptions: syllabusCourseId[] }` |
| ADM-10 | First Year groups | `GET /syllabi/{fySyllabusId}/fy-groups` · `POST /fy-groups` · `PATCH /fy-groups/{id}` — `{ groupCode, groupName, semesterCourseAssignments: { semesterId, syllabusCourseIds[] }[] }` |
| ADM-11 | PO / PSO | `POST /programs/{programId}/outcomes` · `PATCH /outcomes/{id}` **[O-16]** |
| ADM-12 | Users & roles | `GET /users` · `POST /users` · `PATCH /users/{id}` · `PUT /users/{id}/roles` `{ roles: SystemRole[], primaryRole }` |

```ts
interface Institution { institutionId: ID; institutionCode: string; institutionName: string; status: 'ACTIVE' | 'INACTIVE'; }
```

Module 1 deliberately keeps Institution lean. The current institution-setup screen has extra fields (address, NAAC grade, logo…) that the backend doesn't store, so the screen will be cut down to match.

---

## 17. HOD **(PENDING)**

The HOD workflow isn't specified (`AGENTS.md`). The existing `/analytics/hod-dashboard` screen keeps running on mock data, and **no HOD endpoints are contracted yet**. Attainment runs can already reach `SUBMITTED_TO_HOD` (ATT-6); approving or returning them will be added here once HOD is specified.

---

## 18. Error codes

| HTTP | `errorCode` | Frontend behaviour |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Show `fieldErrors` next to the matching fields |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS` | Go to login (or show login error) |
| 403 | `FORBIDDEN`, `ACCOUNT_LOCKED` | "You don't have access" state |
| 404 | `NOT_FOUND` | Not-found state |
| 409 | `VERSION_CONFLICT` | "Someone else saved changes" → reload |
| 409 | `ALREADY_FINALIZED`, `INVALID_STATE`, `ASSESSMENT_IN_USE`, `DUPLICATE_*`, `PRIMARY_ALREADY_ASSIGNED`, `RECALCULATION_NEEDS_CONFIRMATION` | Inline explanation; confirmation dialog where relevant |
| 413 | `FILE_TOO_LARGE` | Upload error with the limit in `message` |
| 415 | `UNSUPPORTED_FILE_TYPE` | Upload error |
| 422 | `PRECONDITION_FAILED`, `REGENERATION_FAILED`, `BAD_TEMPLATE` | Inline explanation; keeps the user's work |
| 429 | `RATE_LIMITED` | Retry after `Retry-After` |
| 502/503/504 | `AI_SERVICE_UNAVAILABLE`, `UPSTREAM_TIMEOUT` | "Try again" with retry button |
| 500 | `INTERNAL_ERROR` | Generic error + `traceId` for support |

`message` must always be safe to show to a user. Stack traces and internal details go in server logs only.

---

## 19. Open questions

| # | Question | Owner | Blocks |
| --- | --- | --- | --- |
| **O-1** | **Unit references and Unit → CO mapping.** Module 1 stores units with `unitNumber` only (no `unitId`) and deliberately stores **no** Unit → CO mapping. Pipeline 2 needs a `unitId` and, for `OVERALL_CO`, the "Units officially mapped to the CO". User story F-013 also asks for CO-Unit mapping. Which is it? This contract uses `unitNumber` until decided. | A + M | §11 |
| **O-2** | **Offering model.** Course Offering / Section is still TBD in Module 1. Agree that the backend issues an opaque `offeringId` per (syllabus course, academic year, division)? | A | §7–§14 |
| **O-3** | **Coordinator role.** Is `COORDINATOR` a system role (as proposed)? Is its scope a department or a program? How does it relate to the per-course `COURSE_COORDINATOR`? | A | §4, §15 |
| **O-4** | **Who sets thresholds and targets?** `AGENTS.md` says Coordinator; user story F-028 says Super Admin / authorized HOD. This contract follows `AGENTS.md`. | Team | §15.3 |
| **O-5** | **Allocation vs admin offerings.** Super Admin has a course-offerings screen. Who creates offerings and who allocates faculty to them? Exactly one owner each. | A + Rohan | §15.2, §16 |
| **O-6** | **Routing to FastAPI.** Does the frontend reach AI routes through Spring Boot or a gateway? Paths stay the same either way; CORS and auth setup differ. | A + M | deployment |
| **O-7** | **Material types.** Module 1 `LearningResourceType` (`NOTES`, `PPT`, `PDF`…) describes format; RAG needs purpose (`QUESTION_BANK`, `PREVIOUS_PAPER`…). One enum or two? | A + M | §11.1 |
| **O-8** | **Assessment plan categories.** The brief lists ISE, ICA, Activity, Practical, POE/OE, ESE. Module 1 exam components are ESE, ISE, ICA, POE, OE, OE_POE. Do Activity and Practical roll up into ICA? | A | §8 |
| **O-9** | **Question → CO cardinality.** Data flow says one question → one CO; F-021 and the July `questionCoMapping` allow several. Contract allows `coIds[]` (min 1). | A | §12 |
| **O-10** | **Bloom enum.** Contract drops the `L1_` prefix to match Module 1. Mayuri's prompts and outputs must use `REMEMBER…CREATE` too. | M | §10, §11 |
| **O-11** | **Weightages and formulas.** Direct/indirect weightage and the CO/PO formulas are PENDING. Where will weightage be configured once specified? | Team | §14, §15.3 |
| **O-12** | **Question paper DOCX export.** The workflow diagram mentions Word as well as PDF. Is DOCX needed in v1? | A | QP-5 |
| **O-13** | **Polling vs push.** Polling is the v1 default. Do we want SSE for long AI jobs later? | M | §2.7 |
| **O-14** | **COs in paper validation.** The brief has faculty typing COs for each validation. Contract pre-fills them from the syllabus and lets faculty edit. OK? | Rohan | §10 |
| **O-15** | **Refresh tokens.** Will the backend issue refresh tokens, or is re-login on expiry acceptable for v1? | A | §5 |
| **O-16** | **PO/PSO storage.** Not yet in the October Mongo design. Program-level collection as assumed in ACAD-9 / ADM-11? | A | §6, §9 |

---

## 20. Changes from v1

| v1 | v2 | Why |
| --- | --- | --- |
| CockroachDB, UUID/STRING IDs | MongoDB, opaque string IDs | Database moved to MongoDB |
| `BloomLevel = 'L1_REMEMBER' …` | `'REMEMBER' …` | Matches Module 1 |
| `GET /courses` (faculty's courses) | `GET /me/offerings` (FAC-1) | Allocations come from the coordinator per academic year |
| `/courses/{id}/outcomes` | COs inside `SyllabusCourse` (ACAD-8) | COs are part of a syllabus course |
| `/courses/{id}/units`, `/units/ingest`, `/ingest/jobs/{id}` | KB-1…KB-6, `LearningMaterial` with versions | Pipeline 1 storage design |
| `POST /generation/questions` with a blueprint | Generation sessions GEN-1…GEN-6 | Pipelines 2 + 3: retrieval modes, evidence status, per-question review and regeneration |
| `POST /papers` | QB-1, QP-1…QP-6 | Question bank + approve-then-export flow (F-018, F-019) |
| `/courses/{id}/copo-matrix` | CAM-1…CAM-4 | CAM with AI suggestions and finalize |
| `/attainment/config` with weightages and thresholds | Targets in CRD-9…CRD-11, read via ATT-7 | Coordinator owns targets; weightage is formula-related (PENDING) |
| `AttainmentReport` with formula fields | `AttainmentRun` with `breakdown[]` | Formulas not specified; contract must not lock them in |
| `/dashboard/metrics`, `/dashboard/courses`, `/dashboard/activity` | `GET /me/dashboard` (FAC-3) | One call, based on offerings |
| `POST /analysis/report` (AI report narrative) | Not in v2 | Not in confirmed scope. Will be re-added when EP-004 is scheduled |
| — | New: auth, assessment plan, paper validation, marksheet structure, marks upload, coordination, admin | Confirmed requirements with no contract yet |
