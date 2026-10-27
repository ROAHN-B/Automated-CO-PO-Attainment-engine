# API Contract — Automated CO-PO Attainment Engine

**Version 2.5 (draft) · 27 Oct 2026 · Owner: Rohan (frontend)**

> **New in 2.5:** the lab assistant role is removed. The faculty creates the marksheet and enters the marks, by uploading the filled Excel sheet or typing into a grid, then submits them in one "Marks entry" step ([§13](#13-marks-entry-a)).
>
> **New in 2.4:** the faculty types or pastes the CAM inputs (objectives, COs, units, POs/PSOs, activities, practicals, tutorials); COs carry no Bloom level and the CAM no expected percentages ([§9](#9-course-articulation-matrix-cam-a--m)).
>
> **New in 2.3:** CAM suggestions come in two stages: the AI suggests a unit → CO mapping that the faculty confirms, then CO → PO/PSO levels with evidence, judged by a shared scoring rubric ([§9.1](#91-building-the-cam)).
>
> **New in 2.2:**
> - a strictly ordered course lifecycle with server-enforced stage locks ([§7.1](#71-course-lifecycle-strictly-ordered))
> - cumulative CO-PO attainment, previewed then approved by the faculty, with a full calculation trace ([§14.2](#142-attainment-calculation-flow))
> - a live course workbook the backend fills all semester and faculty only view ([§14.4](#144-live-course-workbook))
> - marks uploads by the lab assistant only (superseded in 2.5: faculty enter marks)
>
> **New in 2.1:** the CO and PO attainment formulas became official ([§14.1](#141-calculation-spec-backend)).
>
> See [§20](#20-changes) for every change.

This document is the agreement between the Angular frontend and the two backends. It replaces v1, which assumed CockroachDB and a single blueprint-based question generator.

> **Status of this draft.** The frontend TypeScript models in `src/app/core/models/` still follow v1. They will be updated to match this document **after** Abhijeet and Mayuri review it. Until then, **this document is the source of truth**, not the `.ts` files.

| Person | Owns | Stack | Marked as |
| --- | --- | --- | --- |
| **Rohan** | UI/UX, Angular app, this contract | Angular 19, Tailwind | — |
| **Abhijeet** | Academic data, auth, RBAC, assessments, marks, attainment engine, question bank, exports | Spring Boot, Spring Data MongoDB | **[A]** |
| **Mayuri** | Document ingestion, retrieval, question generation, AI analysis | Python FastAPI, MongoDB Atlas Vector Search, LLM | **[M]** |

**Sources used:** Notion "new database design" (Module 1, locked 4 Oct 2026), Updated user stories (EP-001 → EP-005), AI Arch pages (Pipelines 1–3), the frontend workflow diagram, the project brief / `AGENTS.md`, and three institution reference documents:

| Reference | What it defines |
| --- | --- |
| `CO Attainment_60 ESE(TH)V0.2.xlsx` (theory template) | ISE I–III + activities, ESE theory paper + POE/OE, attainment formula, PO & PSO sheet |
| `CO Attainment_60 ESE(PR)V0.1.xlsx` (practical template) | ISE I–III + practical assignments/tutorials, ESE as a single POE/OE mark |
| "Course Articulation Matrix in Syllabus" (example image) | CAM layout: objectives, COs, CO-PO and CO-PSO grid (its Bloom and expected-% columns are not used, see §9) |

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
13. [Marks entry](#13-marks-entry-a)
14. [CO-PO attainment & course workbook](#14-co-po-attainment--course-workbook-a)
15. [Coordination (coordinator)](#15-coordination-coordinator-a)
16. [Super Admin](#16-super-admin-a)
17. [HOD](#17-hod-pending)
18. [Error codes](#18-error-codes)
19. [Open questions](#19-open-questions)
20. [Changes](#20-changes)

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

/** Bloom's Taxonomy. Used on questions only (§10, §11); COs carry no Bloom level. */
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
}

/** A Program Outcome or Program Specific Outcome. */
interface ProgramOutcome {
  outcomeId: ID;
  kind: OutcomeKind;
  code: string;           // "PO1", "PSO2"
  title?: string;         // "Engineering knowledge"
  statement: string;
}

/** Lightweight reference used in lists and headers. */
interface CourseRef {
  syllabusCourseId: ID;
  courseCode: string;     // "25ECU4O55T"
  courseName: string;
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

Landing priority when a user has several roles: `SUPER_ADMIN` → `HOD` → `FACULTY`, unless `primaryRole` says otherwise.

There is **no lab assistant role** (removed in 2.5). Faculty create marksheets and enter marks themselves ([§13](#13-marks-entry-a)).

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

| Area | SUPER_ADMIN | HOD | FACULTY | COORDINATOR |
| --- | :-: | :-: | :-: | :-: |
| §6 Academic structure (read) | ✓ | ✓ | ✓ | ✓ |
| §7–§12 Faculty workspace | — | PENDING | ✓ own allocations | ✓ own allocations |
| §13 Marks entry | — | — | ✓ own allocations | ✓ own allocations |
| §14 Attainment | — | PENDING | ✓ own allocations | ✓ |
| §15 Coordination | — | — | — | ✓ own scope |
| §16 Admin | ✓ | — | — | — |

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
type SystemRole = 'SUPER_ADMIN' | 'HOD' | 'FACULTY' | 'COORDINATOR';

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

**Status: CONFIRMED** (faculty subject selection, strictly ordered lifecycle)

A faculty member works on an **offering**: one subject, in one academic year, for their division (if any). Module 1 hasn't finalized the offering/section model yet, so `offeringId` is an **opaque ID issued by the backend** **[O-2]**. Every per-subject endpoint below hangs off it.

### 7.1 Course lifecycle (strictly ordered)

Every offering moves through three phases. **Each step unlocks only when the previous one is done.** The server enforces this: a call to a locked step returns **409 `STAGE_LOCKED`** with the reason. The UI shows locked steps and what will unlock them, but never decides locks itself.

| Phase | Steps, in order | Done when |
| --- | --- | --- |
| **A · Setup** (once) | 1. Subject selection → 2. Assessment plan → 3. CAM | CAM finalized. The course workbook skeleton is generated ([§14.4](#144-live-course-workbook)). |
| **B · Assessment cycles** (one per planned assessment, in plan order) | Exams (ISE I–III, ESE theory): **paper validation → marksheet → marks entry → attainment approval** | That cycle's cumulative attainment run is approved |
| | Activities, practicals, tutorials, POE/OE: **marksheet → marks entry → attainment approval** | |
| **C · Close-out** (once, after every cycle is done) | Indirect surveys → final attainment approval → submit to HOD | Submitted |

Assessment cycles run **one after another**. Cycle *n + 1* (e.g. ISE-2) opens only when cycle *n* (e.g. ISE-1) has its cumulative attainment approved. The order is the assessment plan's `order` field ([§8](#8-assessment-plan-a)).

### 7.2 Endpoints

| # | Method | Path | Query | Response |
| --- | --- | --- | --- | --- |
| FAC-1 | GET | `/me/offerings` | `academicYearId?`, `semesterId?` | `FacultyOffering[]` |
| FAC-2 | GET | `/offerings/{offeringId}` | — | `FacultyOffering` |
| FAC-3 | GET | `/me/dashboard` | `academicYearId?` | `FacultyDashboard` |

### 7.3 Types

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
  /** Which reference workbook the course follows; decides ICA items and the ESE rule (§14.1). */
  assessmentScheme: AssessmentScheme;
  classStrength: number;          // students on the roll — the N in every attainment %
  courseCoordinator?: { userId: ID; fullName: string };
  readOnly: boolean;              // true for past terms and after submission
  progress: OfferingProgress;     // drives the dashboard card and the course stepper
}

/** THEORY = ISE + activities, ESE theory paper + POE/OE.  PRACTICAL = ISE + activities + practicals/tutorials, ESE = POE/OE only. */
type AssessmentScheme = 'THEORY' | 'PRACTICAL';

/** One step's state. The backend decides every value; the frontend only displays. */
interface StepState {
  status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'DONE';
  lockedReason?: string;          // "Finalize the CAM first", "Waiting for ISE-1 attainment approval"
  updatedAt?: IsoDateTime;
}

interface OfferingProgress {
  phase: 'SETUP' | 'ASSESSMENTS' | 'CLOSE_OUT' | 'SUBMITTED';
  setup: {
    subjectSelection: StepState;
    assessmentPlan: StepState;
    cam: StepState;
  };
  /** One entry per planned assessment, in plan order. Empty until the plan is finalized. */
  cycles: AssessmentCycle[];
  closeOut: {
    indirectSurveys: StepState;
    finalAttainment: StepState;
    submission: StepState;
  };
  /** The single next thing to do — the dashboard's primary action for this course. */
  nextAction?: {
    step: StepKey;
    assessmentId?: ID;            // set for cycle steps
    label: string;                // "Enter ISE-2 marks", "Calculate and approve ISE-2 attainment"
  };
}

interface AssessmentCycle {
  assessmentId: ID;
  name: string;                   // "ISE-1", "Activity 2", "POE"
  category: AssessmentCategory;
  order: number;                  // 1-based position in the plan
  requiresPaperValidation: boolean; // true only for ISE and ESE theory papers
  steps: {
    paperValidation?: StepState;  // present iff requiresPaperValidation
    marksheet: StepState;
    marksEntry: StepState;        // faculty uploads or types the marks, then submits (§13)
    attainmentApproval: StepState;
  };
}

type StepKey =
  | 'SUBJECT_SELECTION' | 'ASSESSMENT_PLAN' | 'CAM'
  | 'PAPER_VALIDATION' | 'MARKSHEET' | 'MARKS_ENTRY' | 'ATTAINMENT_APPROVAL'
  | 'INDIRECT_SURVEYS' | 'FINAL_ATTAINMENT' | 'SUBMISSION';

interface FacultyDashboard {
  offeringsCount: number;
  /** Ordered queue of things waiting for this faculty member across all courses. */
  attention: {
    offeringId: ID;
    courseCode: string;
    step: StepKey;
    assessmentId?: ID;
    label: string;                // "ISE-1 marks: 3 rows need fixing before you submit"
    since: IsoDateTime;
  }[];
  offerings: FacultyOffering[];
}
```

- FAC-1 returns **only** offerings the coordinator allocated to the caller. An empty list is a normal state ("No subjects allocated yet").
- `assessmentScheme`, `classStrength` and `courseCoordinator` are the course header shown on every faculty screen. They mirror the Main sheet of the reference workbook.
- Requesting another faculty's `offeringId` returns **403**, not 404.
- Every write endpoint in §8–§14 checks the lock state. Calling a step whose `status` is `LOCKED` returns **409 `STAGE_LOCKED`**, with the `lockedReason` as the `message`.

---

## 8. Assessment plan **[A]**

**Status: CONFIRMED** · categories now follow the reference workbooks

The faculty lists every assessment for the subject (ISE-1, ISE-2, ICA activities or practicals, ESE…) with marks and the COs each one covers. Which ICA items are allowed depends on the offering's `assessmentScheme`:

| Category | Phase in the formula | Theory scheme | Practical scheme | Notes |
| --- | --- | :-: | :-: | --- |
| `ISE` | ISE | ✓ | ✓ | ISE I, II, III. Questions set in the marksheet ([§12](#12-marksheet-structure-a)). |
| `ACTIVITY` | ISE (ICA) | ✓ | ✓ | Typed from the activity catalogue below. |
| `PRACTICAL` | ISE (ICA) | — | ✓ | Practical assignments A1, A2… |
| `TUTORIAL` | ISE (ICA) | — | ✓ | Tutorials, counted with practicals. |
| `ESE` | ESE | ✓ | — | End-semester theory paper. |
| `POE` / `OE` / `OE_POE` | ESE | ✓ | ✓ | Practical-oral or oral exam. In the practical scheme this is the whole ESE. |

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| PLAN-1 | GET | `/offerings/{offeringId}/assessment-plan` | — | `AssessmentPlan` (empty `DRAFT` if none) |
| PLAN-2 | PUT | `/offerings/{offeringId}/assessment-plan` | `AssessmentPlanUpdate` | `AssessmentPlan` |
| PLAN-3 | POST | `/offerings/{offeringId}/assessment-plan/finalize` | `{ version }` | `AssessmentPlan` |

```ts
type AssessmentCategory =
  | 'ISE' | 'ACTIVITY' | 'PRACTICAL' | 'TUTORIAL' | 'ESE' | 'POE' | 'OE' | 'OE_POE';

/** The workbook's activity catalogue (Data sheet). */
type ActivityType =
  | 'ASSIGNMENT' | 'CRITICAL_PROBLEM' | 'SEMINAR_PRESENTATION'
  | 'CASE_STUDY' | 'MINI_PROJECT' | 'REAL_LIFE_PROBLEM';

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
  activityType?: ActivityType;   // required when category = ACTIVITY
  phase: 'ISE' | 'ESE';          // backend-derived from category; read-only
  componentType: AssessmentComponentType; // backend-derived exam-scheme component
  name: string;                  // "ISE-1", "Activity 2", "A7"
  sequence: number;              // 1, 2, 3 within the category
  order: number;                 // 1-based position across the whole plan — the assessment-cycle order (§7.1)
  maxMarks: number;              // > 0
  /**
   * COs covered. For items marked without a question breakdown (activities,
   * practicals, POE/OE) this is the CO mapping used by the formula: max 2 COs,
   * or `appliesToAllCos` (§12).
   */
  coIds: ID[];
  appliesToAllCos?: boolean;     // theory POE/OE: marks spread over all ESE COs (§14.1 step 2)
  plannedDate?: IsoDate;
}

interface AssessmentPlanUpdate {
  version: number;
  assessments: PlannedAssessment[];
}
```

- Several assessments of the same category are allowed (ISE-1, ISE-2, ISE-3).
- `order` sets the sequence of assessment cycles. Once the plan is finalized, the order is fixed, because cycles run one after another (§7.1).
- A category not allowed for the offering's scheme returns **400 `VALIDATION_FAILED`**, for example `PRACTICAL` on a theory course.
- Removing an assessment that already has a marksheet or marks returns **409 `ASSESSMENT_IN_USE`**.
- No attainment maths here.

---

## 9. Course Articulation Matrix (CAM) **[A + M]**

**Status: CONFIRMED** · two-stage AI suggestion flow confirmed 25 Oct 2026 · faculty-entered inputs confirmed 25 Oct 2026 · scoring rubric is **proposed**, not institutional **[O-21]**

The CAM is the CO → PO/PSO correlation matrix for this offering, plus the course inputs it rests on. Faculty fills it in. AI can **suggest** values, but it never writes into the CAM by itself.

Cells hold 1, 2, 3 or blank. The number of POs and PSOs is whatever the faculty enters for the program. The UI never assumes 11 or 12 **[O-17]**.

COs carry **no Bloom level** and the CAM holds no expected percentages. Bloom levels exist only on questions (§10, §11), and attainment uses only the coordinator's targets (§15.3).

### 9.1 Building the CAM

The faculty builds the CAM on one screen, in four steps. AI suggestions come in **two stages**, and stage 2 opens only after the faculty confirms stage 1, so one wrong unit link can't spread across the whole matrix.

| Step | What the faculty does | AI |
| --- | --- | --- |
| 1. Course inputs | Types or pastes the objectives, COs, units, POs and PSOs, activities, practicals and tutorials, and picks the COs each item covers | — |
| 2. **Stage 1:** Unit → CO mapping | Starts from AI suggestions (CAM-5), links or unlinks each unit and CO, then **confirms** (CAM-6) | Suggests |
| 3. **Stage 2:** CO → PO/PSO grid | Sets every cell (blank, 1, 2 or 3) with an optional justification, starting from AI suggestions (CAM-4) or by hand | Suggests |
| 4. Finalize | Reviews the checklist and finalizes (CAM-3); the CAM becomes read-only | — |

**Inputs are faculty-entered.** The faculty types them, or pastes a list where each line becomes one entry. When the syllabus course (ACAD-8) or the program (ACAD-9) already holds some of them, a new CAM starts pre-filled with those, and the faculty can still edit them. The CAM's copy is the one the AI, the matrix and the course workbook use.

The unit → CO mapping belongs to the **offering's CAM**, not the syllabus: Module 1 stores no such mapping. Once the CAM is finalized, its mapping is the "units officially mapped to the CO" that question generation uses in `OVERALL_CO` mode ([§11.2](#112-generation-sessions-pipelines-2--3-m)).

### 9.2 Endpoints

| # | Method | Path | Body | Response | Owner |
| --- | --- | --- | --- | --- | --- |
| CAM-1 | GET | `/offerings/{offeringId}/cam` | — | `Cam` (a new `DRAFT`, pre-filled where possible, if none) | A |
| CAM-2 | PUT | `/offerings/{offeringId}/cam` | `CamUpdate` | `Cam` | A |
| CAM-3 | POST | `/offerings/{offeringId}/cam/finalize` | `{ version }` | `Cam` | A |
| CAM-4 | POST | `/offerings/{offeringId}/cam/suggestions` | `{ coIds?: ID[] }` | `CamSuggestionSet` (stage 2) | M |
| CAM-5 | POST | `/offerings/{offeringId}/cam/unit-mapping/suggestions` | `{ coIds?: ID[] }` | `UnitCoSuggestionSet` (stage 1) | M |
| CAM-6 | POST | `/offerings/{offeringId}/cam/unit-mapping/confirm` | `{ version }` | `Cam` | A |

### 9.3 Types

```ts
interface Cam {
  camId: ID;
  offeringId: ID;
  status: 'DRAFT' | 'FINALIZED';
  version: number;
  inputs: CamInputs;                    // step 1, faculty-entered
  unitMapping: UnitMapping;             // step 2
  cells: CamCell[];                     // step 3; only non-empty cells are sent
  scoringRubric: CamScoringRubric;      // read-only legend for step 3
  updatedAt: IsoDateTime;
  updatedBy: string;
}

interface CamInputs {
  courseObjectives: string[];           // in order
  courseOutcomes: CamCourseOutcome[];   // in display order; at least one to confirm the mapping
  units: CamUnit[];
  programOutcomes: CamProgramOutcome[]; // POs then PSOs, in display order
  activities: CamItem[];
  practicals: CamItem[];
  tutorials: CamItem[];
}

/** A new entry is sent without its ID; the server assigns one and returns it. */
interface CamCourseOutcome {
  coId?: ID;
  code: string;                         // "CO1", unique in the CAM
  statement: string;
}

interface CamUnit {
  unitNumber: number;                   // unique in the CAM; the unit's reference everywhere [O-1]
  title: string;
  content: string;                      // topics, as in the syllabus
  hours?: number;
}

interface CamProgramOutcome {
  outcomeId?: ID;
  kind: OutcomeKind;
  code: string;                         // "PO1", "PSO2", unique in the CAM
  title?: string;                       // "Engineering knowledge"
  statement: string;
}

interface CamItem {
  itemId?: ID;
  title: string;                        // "Mini project — Classical cryptography toolkit"
  description?: string;
  coIds: ID[];                          // faculty-entered; never AI-suggested
}

/** Where a value came from. Lets the UI and audit tell AI and faculty input apart. */
type CamValueSource = 'FACULTY' | 'AI_ACCEPTED' | 'AI_EDITED';

interface UnitMapping {
  status: 'DRAFT' | 'CONFIRMED';
  links: UnitCoLink[];                  // one entry per linked (unit, CO) pair; absent = not linked
  confirmedAt?: IsoDateTime;
  confirmedBy?: string;
}

interface UnitCoLink {
  unitNumber: number;
  coId: ID;
  source: CamValueSource;
  suggestionId?: ID;                    // set when source is AI_*
}

interface CamCell {
  coId: ID;
  outcomeId: ID;                        // a PO or PSO
  level: CorrelationLevel;
  justification?: string;
  source: CamValueSource;
  suggestionId?: ID;                    // set when source is AI_*
}

interface CamUpdate {
  version: number;
  inputs: CamInputs;
  unitLinks: UnitCoLink[];
  cells: CamCell[];
}

/** How the correlation levels are meant. Shown as the step 3 legend and sent to the AI, so both judge by the same rules. */
interface CamScoringRubric {
  rubricId: ID;
  version: number;
  status: 'PROPOSED' | 'OFFICIAL';      // PROPOSED until the institution confirms it [O-21]
  levels: {
    level: CorrelationLevel | null;     // null = blank
    label: string;                      // "High"
    meaning: string;
  }[];
  rules: string[];
}

/** Stage 1 (CAM-5). Each suggestion proposes linking one unit to one CO. */
interface UnitCoSuggestionSet extends AiProvenance {
  suggestionSetId: ID;
  basedOnCamVersion: number;
  suggestions: UnitCoSuggestion[];
}

interface UnitCoSuggestion {
  suggestionId: ID;
  unitNumber: number;
  coId: ID;
  rationale: string;                    // which unit topics support the CO
  needsReview: boolean;                 // the AI is unsure, e.g. a CO verb the unit topics don't cover
  reviewNote?: string;                  // why it needs review
  confidence?: number;                  // 0..1, display only
}

/** Stage 2 (CAM-4). */
interface CamSuggestionSet extends AiProvenance {
  suggestionSetId: ID;
  basedOnCamVersion: number;
  rubricVersion: number;
  suggestions: CamSuggestion[];
}

interface CamSuggestion {
  suggestionId: ID;
  coId: ID;
  outcomeId: ID;
  suggestedLevel: CorrelationLevel | null;   // null = "no correlation"
  rationale: string;                         // tied to the rubric level, never to similar wording alone
  evidence: {
    unitNumbers: number[];                   // from the confirmed unit → CO mapping
    itemIds: ID[];                           // activities, practicals or tutorials that support it
  };
  needsReview: boolean;
  reviewNote?: string;
  confidence?: number;                       // 0..1, display only
}
```

**Default scoring rubric** (status `PROPOSED`, from Mayuri's CAM experiment, 25 Oct 2026):

| Level | Label | Meaning |
| --- | --- | --- |
| 3 | High | The CO directly and strongly develops the ability described by the PO/PSO |
| 2 | Medium | The CO develops relevant knowledge or skills described by the PO/PSO |
| 1 | Low | The CO makes a limited but meaningful contribution to the PO/PSO |
| blank | — | The course evidence doesn't establish a meaningful relationship |

Rule: every non-blank level is justified with evidence from the official CO, the relevant units and the PO/PSO statement. A level is never given only because the wording looks similar.

### 9.4 Rules

**Inputs (CAM-2)**

- COs, units and outcomes need unique codes or unit numbers; a duplicate returns **400 `VALIDATION_FAILED`** with `fieldErrors` (e.g. `inputs.courseOutcomes[2].code`).
- Removing a CO, unit or outcome also removes its unit links, cells and item CO links.
- Any change to the COs or units (added, removed or reworded) returns a confirmed mapping to `DRAFT`: the AI's evidence changed. Saved cells stay.
- Links, cells and item CO links can only point at COs and outcomes that already have an ID. The UI saves a new CO first, then lets the faculty map it.

**Suggestions**

- CAM-4 and CAM-5 only return suggestions. They never change the saved CAM.
- The faculty accepts, edits or rejects each suggestion in the UI. Accepted ones are saved through CAM-2 with `source: 'AI_ACCEPTED' | 'AI_EDITED'` and the `suggestionId`.
- A suggestion never overwrites a value the faculty has already set, unless the faculty explicitly accepts it for that unit link or cell.
- Suggestions with `needsReview: true` are highlighted with their `reviewNote` and are left out of any "accept all" action. The faculty decides on each one individually.
- Activity, practical and tutorial CO links are faculty-entered only. The AI reads them as evidence but never suggests them.

**Stage order**

- CAM-5 works whenever the CAM is `DRAFT` and has at least one CO and one unit.
- CAM-6 confirms the unit mapping. Every CO must be linked to at least one unit; otherwise it returns **422 `PRECONDITION_FAILED`** naming the unlinked COs.
- CAM-4 returns **422 `PRECONDITION_FAILED`** until `unitMapping.status` is `CONFIRMED`.
- Changing `unitLinks` through CAM-2 after confirmation sets `unitMapping.status` back to `DRAFT`. Saved cells stay as they are. The UI tells the faculty to re-check the grid, and CAM-4 needs a new confirmation.
- The faculty can set or change any cell by hand at any time while the CAM is `DRAFT`, with or without a suggestion.

**Finalize**

- CAM-3 needs `unitMapping.status = CONFIRMED`. It is the faculty's final review: afterwards the whole CAM, inputs and mapping included, is read-only, and every write returns **409 `ALREADY_FINALIZED`**.
- The finalized CAM is the input to attainment. Its correlations are the `corr(c, p)` in [§14.1](#141-calculation-spec-backend) step 5, and its COs are the course's CO list in the workbook (§14.4).

**Rubric**

- The UI shows the rubric as the step 3 legend. While `status` is `PROPOSED` it is labelled "Proposed, not yet confirmed by the institution".
- Every stage 2 suggestion set records the `rubricVersion` it used.
- The rubric isn't editable through the API yet. Who maintains it (coordinator config or a fixed institutional rule) is open **[O-21]**.

### 9.5 Suggestion context (Spring Boot → FastAPI, internal)

The frontend never sends these inputs to the AI directly. Spring Boot reads them from the saved CAM and passes them to Mayuri's pipeline for CAM-5 and CAM-4. It's written down here so **[A]** and **[M]** build to the same shape.

```ts
interface CamSuggestionContext {
  stage: 'UNIT_CO_MAPPING' | 'CO_PO_CORRELATION';
  offeringId: ID;
  course: CourseRef & { courseType: CourseType; assessmentScheme: 'THEORY' | 'PRACTICAL' };
  inputs: CamInputs;                     // the saved CAM inputs, IDs filled in
  coIds?: ID[];                          // limit suggestions to these COs
  unitLinks?: UnitCoLink[];              // CO_PO_CORRELATION only: the confirmed mapping
  rubric?: CamScoringRubric;             // CO_PO_CORRELATION only
}
```

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

- Paper validation exists only for **ISE and ESE theory papers**. It is the first step of their assessment cycle (§7.1), and its marksheet step unlocks once the paper is sent to the moderator. Activities, practicals, tutorials and POE/OE have no paper and start at the marksheet.
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
/** OVERALL_CO retrieves from the units linked to the CO in the finalized CAM (§9.1). */
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

**Status: CONFIRMED** (structure editor, CO rules, faculty creates and fills) · cell-level template formatting **PENDING**

For each planned assessment, the faculty defines its questions and sub-questions, which CO each one tests, the marks, and how many must be attempted. The backend generates the Excel marksheet from this. This structure is also where questions get mapped to COs (F-021).

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| MS-1 | GET | `/assessments/{assessmentId}/structure` | — | `AssessmentStructure` |
| MS-2 | PUT | `/assessments/{assessmentId}/structure` | `AssessmentStructureUpdate` | `AssessmentStructure` |
| MS-3 | POST | `/assessments/{assessmentId}/structure/finalize` | `{ version }` | `AssessmentStructure` |
| MS-4 | POST | `/assessments/{assessmentId}/marksheet-template` | query `withMarks?` | `ExportFile` (XLSX) |

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
  coIds?: ID[];                      // 1 or 2 COs (workbook rows 5 and 6)
  appliesToAllCos?: boolean;         // ESE theory only: marks shared across all ESE COs
  maxMarks?: number;
  bloomLevel?: BloomLevel;
  attemptRule?: AttemptRule;         // e.g. attempt 2 of Q1(a), (b), (c)
}

interface SubQuestion {
  label: string;                     // "a"
  coIds: ID[];                       // 1 or 2 COs
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

- Each question or sub-question maps to **one or two** COs, or to **all** COs (`appliesToAllCos`, ESE theory papers only). The workbook formula gives a two-CO item its full marks on both COs ([§14.1](#141-calculation-spec-backend) step 2). Anything else returns **400 `VALIDATION_FAILED`**: zero COs, three or more, or `appliesToAllCos` outside an ESE theory paper.
- The frontend may show running totals as a preview, but `computedMaxMarks` and `issues` from the server are what count.
- MS-4 needs status `FINALIZED`. The generated sheet follows the reference workbook's **Data** sheet:
  - one header block per assessment, with a question row, a max-marks row and one or two CO rows
  - then one row per student: serial number, roll number, name, and one mark per question
- The faculty fills in this template and imports it (MK-3). The import must keep its layout, otherwise it's rejected with `BAD_TEMPLATE`. `?withMarks=true` returns it with the draft's current marks filled in.
- Finalizing the structure (MS-3) also creates the assessment's column block in the course workbook ([§14.4](#144-live-course-workbook)). The backend owns the cell-level formatting of the downloadable template.

---

## 13. Marks entry **[A]**

**Status: CONFIRMED** (EP-003 F-022, F-023; faculty-only marks entry confirmed 27 Oct 2026)

The faculty creates the marksheet ([§12](#12-marksheet-structure-a)) **and fills it in**. There is no lab assistant role. The faculty can work either way, on the same draft:

- **Upload:** download the generated Excel marksheet (MS-4), fill it in, and import it (MK-3).
- **Type:** enter or correct marks in a grid on screen (MK-2).

The backend validates every value. The faculty fixes any errors, then **submits** (MK-5). Submitting writes the marks into the course workbook's Data sheet ([§14.4](#144-live-course-workbook)) and makes the assessment's "Calculate CO-PO attainment" action available. There is no separate approval step.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| MK-1 | GET | `/assessments/{assessmentId}/marks` | — | `MarksSheet` (a `NOT_STARTED` sheet with the class roster if nothing is entered yet) |
| MK-2 | PUT | `/assessments/{assessmentId}/marks` | `MarksUpdate` | `MarksSheet` |
| MK-3 | POST | `/assessments/{assessmentId}/marks/import` | multipart: `file` (.xlsx) | `MarksSheet` |
| MK-4 | GET | `/assessments/{assessmentId}/marks/rows` | query `onlyErrors?`, `search?`, `page`, `size` (max 500) | `Page<MarksRow>` |
| MK-5 | POST | `/assessments/{assessmentId}/marks/submit` | `{ version }` | `MarksSheet` |
| MK-6 | POST | `/assessments/{assessmentId}/marks/reopen` | `{ version, reason }` | `MarksSheet` |

All six are for the `FACULTY` allocated to the offering (§4.3).

```ts
type MarksSheetStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED';

interface MarksSheet {
  assessmentId: ID;
  assessmentName: string;         // "ISE-1"
  offeringId: ID;
  status: MarksSheetStatus;
  version: number;
  /** From the finalized marksheet structure (§12), in sheet order. Read-only. */
  columns: { label: string; maxMarks: number; coCodes: string[]; appliesToAllCos: boolean }[];
  /** Backend-computed counts over the whole roster. */
  summary: {
    totalStudents: number;
    complete: number;             // every column has a mark, or the student is marked absent
    absent: number;
    incomplete: number;           // at least one column empty
    withErrors: number;
  };
  lastImport?: { fileName: string; importedAt: IsoDateTime; importedRows: number };
  submittedAt?: IsoDateTime;
  submittedBy?: string;
  updatedAt?: IsoDateTime;
  updatedBy?: string;
}

interface MarksRow {
  rollNumber: string;
  studentName?: string;
  /** key = column label ("Q1(a)"); "AB" = absent; null = not entered yet. */
  marks: Record<string, number | 'AB' | null>;
  total?: number;                 // backend-computed, attempt rules applied
  errors: MarksRowError[];
}

interface MarksRowError {
  rollNumber?: string;
  row?: number;                   // 1-based Excel row; set for import errors only
  column?: string;                // "Q1(a)"
  code: 'UNKNOWN_STUDENT' | 'DUPLICATE_STUDENT' | 'NOT_A_NUMBER' | 'OUT_OF_RANGE'
      | 'ATTEMPT_RULE' | 'OTHER';
  message: string;
}

/** Only the rows the faculty changed. */
interface MarksUpdate {
  version: number;
  rows: { rollNumber: string; marks: Record<string, number | 'AB' | null> }[];
}
```

**Saving and importing**

- The roster (roll numbers and names) comes from the backend. Faculty can't add or remove students here.
- MK-2 saves typed marks as a draft, even when some are invalid. Each invalid value comes back as a `MarksRowError` on its row, so the faculty can fix it later without losing their typing.
- MK-3 replaces **every mark** in the draft with the file's contents. The UI asks for confirmation first when the draft already holds marks. A file that doesn't match the generated template is refused as a whole with **422 `BAD_TEMPLATE`**, and nothing changes.
- Import limits (F-022): `.xlsx` only, the generated template only, up to 5,000 rows. An oversized file returns **413**, and a different file type **415**.
- MS-4 can return the template with the draft's current marks filled in (`?withMarks=true`), so the faculty can continue in Excel.
- Every write uses `version`; a stale one returns **409 `VERSION_CONFLICT`**.

**Submitting (MK-5)**

- Submitting needs **no errors**, and every student either has a mark in every column or is marked absent. Otherwise it returns **422 `PRECONDITION_FAILED`** with the counts in the message.
- Submitting writes the marks into the workbook (WB-1), sets the cycle's `marksEntry` step to `DONE`, and unlocks `attainmentApproval` (§7.1).
- A submitted sheet is read-only. MK-6 reopens it as a draft. If that cycle's attainment was already approved, reopening also reopens the attainment step, and the UI warns before this happens.

**Absent students** (`'AB'`) stay on the roll. In the attainment formula they count towards class strength `N` but never above target, matching the workbook **[O-20]**.

---

## 14. CO-PO attainment & course workbook **[A]**

**Status: CONFIRMED** — screens, flow, **formulas**, cumulative runs and the live workbook. The formulas come from the institution workbooks ([§14.1](#141-calculation-spec-backend)) and run **only in the backend**. The frontend displays the numbers it receives and never recomputes them.

### 14.1 Calculation spec (backend)

This is the official CO/PO attainment method, transcribed from `CO Attainment_60 ESE(TH)V0.2.xlsx` and `CO Attainment_60 ESE(PR)V0.1.xlsx`. Every constant below is a **default**: its live value comes from the coordinator's configuration ([§15.3](#153-threshold-and-target-configuration)), snapshotted into each run.

**Inputs for one offering**

- `N` — class strength (the number of students on the roll, not the number who sat the exam).
- The finalized assessment plan ([§8](#8-assessment-plan-a)) and marksheet structures ([§12](#12-marksheet-structure-a)): every question or item has max marks and its CO(s).
- Submitted marks ([§13](#13-marks-entry-a)).
- Indirect survey scores per CO ([ATT-8](#143-endpoints)).
- The finalized CAM correlations ([§9](#9-course-articulation-matrix-cam-a--m)).

**Step 1 — split assessments into two phases**

| Phase | Theory template | Practical template |
| --- | --- | --- |
| **ISE** (in-semester) | ISE I–III questions + ICA **activities** | ISE I–III questions + ICA **activities** and **practical assignments / tutorials** |
| **ESE** (end-semester) | ESE theory questions + POE/OE marks | A single POE/OE mark for the whole course |

**Step 2 — per-CO marks for each student, per phase**

- An item mapped to a CO adds its full marks to that CO. An item mapped to **two** COs adds its full marks to **both**.
- *Theory ESE only:* the POE/OE mark plus any ESE question marked **All COs** is divided equally among the COs examined in the ESE paper, and that share is added to each of them.
- *Practical ESE:* there is no per-CO split. The POE/OE mark is evaluated once, and the resulting ESE level applies to every CO.
- `max(c, phase)` is computed the same way from the max marks.

**Step 3 — level per CO, per phase**

```
target(c, phase)      = targetMarksPct[phase] / 100 × max(c, phase)        defaults: ISE 60 %, ESE 50 %
pctAbove(c, phase)    = (number of students with marks  >  target) / N × 100   (strictly greater; absentees count as below)
level(c, phase)       = 3 if pctAbove ≥ L3[phase]
                        2 if pctAbove ≥ L2[phase]
                        1 if pctAbove ≥ L1[phase]
                        0 otherwise                                          defaults: ISE 50/60/70, ESE 60/70/80 (theory), 50/60/70 (practical)
```

**Step 4 — direct, indirect and overall CO attainment** (each on a 0–3 scale)

```
direct(c)    = wISE × level(c, ISE) + wESE × level(c, ESE)          defaults: wISE 0.4, wESE 0.6 (wESE = 1 − wISE)
indirect(c)  = mean of the survey scores entered for c              course exit survey, examiner survey, additional survey (each 0–3)
overall(c)   = wDirect × direct(c) + wIndirect × indirect(c)        defaults: wDirect 0.8, wIndirect 0.2
```

A CO with `max(c, ISE) = 0` (no marks mapped to it) is **excluded** from the run instead of reported as zero.

**Step 5 — PO and PSO attainment**

```
attainment(p)     = Σc overall(c) × corr(c, p)  /  Σc corr(c, p)     over COs with a correlation to p (1–3)
averageCorr(p)    = mean of corr(c, p) over those COs
courseMapping(p)  = averageCorr(p) rounded half up to 1, 2 or 3       (the workbook's CEILING(x − 0.49))
```

A PO or PSO with no correlations is left blank, not zero.

**Cumulative runs (confirmed 25 Oct 2026)**

Attainment is calculated **cumulatively** during the semester: after each assessment cycle, using every assessment whose marks are submitted so far.

- `max(c, phase)` and each student's marks sum over the **assessments with submitted marks in scope only**. Planned assessments that haven't happened yet don't count towards the maximum.
- **Before any ESE assessment is approved** (option (a), chosen 25 Oct 2026):
  - the ISE phase is calculated as normal: target, students above target, level;
  - `ese`, `direct`, `overall` and every PO/PSO `attainment` are **pending**, returned as `null` with `pendingReason: 'AWAITING_ESE'`;
  - nothing is rescaled, and no ESE value is assumed to be 0.
- **Before the indirect surveys are entered** (close-out), `indirect` is pending and `overall` is pending (`'AWAITING_INDIRECT'`). `direct` is still shown once ESE exists.
- The run approved in close-out, with every assessment and the surveys included, is the **final** run (`isFinal: true`). Only the final run can be submitted to the HOD.

**Workbook discrepancies — how the backend must behave**

- The theory workbook computes the ESE level with the **ISE** thresholds, although its Main sheet defines separate ESE thresholds. The practical workbook uses the ESE thresholds. **Use the ESE thresholds for ESE** **[O-19]**.
- The workbook hard-codes 0.8 / 0.2 for direct / indirect. These are configurable defaults here (F-028 requires configurable weightages).
- The workbook caps a course at 8 COs, 3 ISE papers × 8 questions, 6 activities and 15 practicals. The API imposes **no** such caps. The backend may enforce institutional limits through validation `issues`.

### 14.2 Attainment calculation flow

This is the confirmed faculty flow, e.g. for ISE-1:

1. The faculty member enters the ISE-1 marks, by importing the filled marksheet or typing them, and submits them (MK-5). The marks appear in the workbook's Data sheet.
2. Under the ISE-1 block, the workbook shows **"Calculate CO-PO attainment"** (`WorkbookBlock.canCalculate`).
3. The button opens the **attainment calculation page**, scoped to "cumulative up to ISE-1" (ATT-1). The page shows the inputs, auto-filled and read-only: the submitted marks in scope, the max marks per CO, the class strength, and the coordinator's targets and thresholds. These are visible but **not editable**.
4. The faculty member clicks **"Calculate CO-PO attainment"** (ATT-2). The backend runs [§14.1](#141-calculation-spec-backend) and returns a run with status `CALCULATED`.
5. The page shows **every step of the calculation** from the run's trace (`CoAttainmentResult`, `OutcomeAttainmentResult.contributions`, ATT-10 for students).
6. The faculty member **approves** (ATT-11). The run becomes `APPROVED`, its values are written to the workbook (Main summary, PO & PSO attainment row, labelled "as of ISE-1"), and the cycle's `attainmentApproval` step is `DONE`, which unlocks the next cycle.
7. If the faculty member disagrees, they **discard** the run (ATT-12) and fix the inputs, e.g. reopen the marks (MK-6), correct them and submit again. A discarded run is never written to the workbook.

### 14.3 Endpoints

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| ATT-1 | GET | `/offerings/{offeringId}/attainment/readiness` | query `upToAssessmentId?` | `AttainmentReadiness` (incl. the read-only inputs) |
| ATT-2 | POST | `/offerings/{offeringId}/attainment/runs` | `{ upToAssessmentId?: ID; final?: boolean }` | `AttainmentRun` (202, `RUNNING` → `CALCULATED`) |
| ATT-3 | GET | `/attainment/runs/{runId}` | — | `AttainmentRun` |
| ATT-4 | GET | `/offerings/{offeringId}/attainment/runs` | query `status?` | `AttainmentRunSummary[]` (newest first) |
| ATT-5 | POST | `/attainment/runs/{runId}/export` | `{ format: 'PDF' }` | `ExportFile` or `AsyncJob` — calculation report (the Excel is WB-3) |
| ATT-6 | POST | `/attainment/runs/{runId}/submit` | `{ note? }` | `AttainmentRun` (`SUBMITTED_TO_HOD`) — final runs only |
| ATT-7 | GET | `/offerings/{offeringId}/attainment-targets` | — | `AttainmentTargetConfig` (read-only for faculty) |
| ATT-8 | GET | `/offerings/{offeringId}/indirect-attainment` | — | `IndirectAttainmentInput` |
| ATT-9 | PUT | `/offerings/{offeringId}/indirect-attainment` | `IndirectAttainmentUpdate` | `IndirectAttainmentInput` |
| ATT-10 | GET | `/attainment/runs/{runId}/cos/{coId}/students` | query `phase?`, `onlyBelowTarget?`, `page`, `size` | `Page<StudentCoScore>` |
| ATT-11 | POST | `/attainment/runs/{runId}/approve` | `{ version }` | `AttainmentRun` (`APPROVED`; workbook updated) |
| ATT-12 | POST | `/attainment/runs/{runId}/discard` | `{ reason? }` | `AttainmentRun` (`DISCARDED`) |

### 14.4 Live course workbook

One workbook per offering, generated from the reference template for its `assessmentScheme`. The **backend** maintains it all semester. **Faculty only view and download it**; there is no endpoint that writes to it directly.

**What fills which sheet** (the confirmed population logic):

| Trigger | Fills | Sheet |
| --- | --- | --- |
| Allocation (subject, semester) | Institution, department, program, class, course, course coordinator, year, semester, class strength | Main · header |
| Coordinator targets (§15.3) | Criteria for course attainment: ISE/ESE weights, target-marks %, level thresholds | Main · criteria |
| Assessment plan finalized (§8) | One column block per planned assessment: ISE I–III, activities / practicals / tutorials, ESE theory, POE/OE | Data |
| CAM finalized (§9) | The CO list | Main |
| CAM finalized (§9) | The CO-PO and CO-PSO correlations, the average and the course mapping | PO & PSO attainment |
| Marksheet finalized (§12) | The block's question numbers, max-marks row and CO rows (1–2 COs or "All") | Data |
| Marks submitted (MK-5) | One row per student with every question's marks; per-CO totals | Data (and CO1…COn) |
| Indirect surveys saved (ATT-9) | Course exit, examiner and additional survey scores per CO | Data · indirect block |
| Attainment run approved (ATT-11) | CO summary (overall attainment per CO) and the PO/PSO attainment row, with "as of …" | Main · summary, PO & PSO attainment |

Cells that aren't filled yet carry a `pendingReason` instead of a value. The UI shows the reason, e.g. "Waiting for ISE-2 marks".

| # | Method | Path | Query | Response |
| --- | --- | --- | --- | --- |
| WB-1 | GET | `/offerings/{offeringId}/workbook` | — | `CourseWorkbook` (Main, PO & PSO, Data headers — no student rows) |
| WB-2 | GET | `/offerings/{offeringId}/workbook/data/students` | `page`, `size`, `search?` | `Page<WorkbookStudentRow>` |
| WB-3 | POST | `/offerings/{offeringId}/workbook/export` | — | `ExportFile` (XLSX, the reference workbook filled to date) or `AsyncJob` |

### 14.5 Types

```ts
interface AttainmentReadiness {
  ready: boolean;
  scope: AttainmentScope;               // what a run started now would include
  /** Read-only inputs shown on the calculation page before calculating. */
  inputs: {
    classStrength: number;
    targets: AttainmentTargetConfig;    // locked for faculty
    coMaxMarks: { coId: ID; coCode: string; ise: number; ese: number | null }[];
  };
  checks: {
    code: 'ASSESSMENT_PLAN_FINALIZED' | 'CAM_FINALIZED' | 'QUESTION_CO_MAPPING'
        | 'VALIDATED_MARKS' | 'TARGETS_CONFIGURED' | 'INDIRECT_SURVEYS' | 'STAGE_ORDER';
    satisfied: boolean;
    /** Blocking checks stop ATT-2. INDIRECT_SURVEYS is a warning before close-out. */
    severity: 'BLOCKING' | 'WARNING';
    detail?: string;                    // "ISE-2 marks aren't submitted yet"
  }[];
}

interface AttainmentScope {
  upToAssessmentId: ID;
  label: string;                        // "Cumulative up to ISE-2"
  includedAssessments: { assessmentId: ID; name: string; phase: 'ISE' | 'ESE' }[];
  isFinal: boolean;                     // every planned assessment + surveys included
}

type AttainmentRunStatus = 'RUNNING' | 'CALCULATED' | 'APPROVED' | 'DISCARDED' | 'FAILED';
type AttainmentReviewStatus = 'NOT_SUBMITTED' | 'SUBMITTED_TO_HOD' | 'APPROVED' | 'REVISION_REQUESTED'; // HOD actions PENDING
type PendingReason = 'AWAITING_ESE' | 'AWAITING_INDIRECT' | 'NO_DATA';

interface AttainmentRun {
  runId: ID;
  offeringId: ID;
  course: CourseRef;
  academicYear: string;
  assessmentScheme: AssessmentScheme;   // THEORY | PRACTICAL — which ESE rule applied
  classStrength: number;                // N used in every pctAbove
  scope: AttainmentScope;
  version: number;                      // increments per run of the offering; all versions are kept
  status: AttainmentRunStatus;
  reviewStatus: AttainmentReviewStatus;
  targets: AttainmentTargetConfig;      // snapshot of the config used for this run
  coResults: CoAttainmentResult[];
  outcomeResults: OutcomeAttainmentResult[]; // POs and PSOs
  excludedCoCodes: string[];            // COs with no mapped marks in scope
  error?: { errorCode: string; message: string };
  generatedAt?: IsoDateTime;
  generatedBy: string;
  approvedAt?: IsoDateTime;
  approvedBy?: string;
}

/** One phase (ISE or ESE) of one CO — every number the "show each step" page needs. */
interface PhaseAttainment {
  maxMarks: number;
  targetMarksPct: number;               // e.g. 60 — from the snapshot, repeated for display
  targetMarks: number;                  // targetMarksPct × maxMarks
  studentsAboveTarget: number;
  classStrength: number;
  percentAboveTarget: number;           // studentsAboveTarget / classStrength × 100
  levelPct: { l1: number; l2: number; l3: number }; // thresholds applied
  level: AttainmentLevel;               // 0..3
}

interface CoAttainmentResult {
  coId: ID;
  code: string;                         // "CO1"
  statement: string;
  ise: PhaseAttainment;
  ese: PhaseAttainment | null;          // null → pendingReason AWAITING_ESE
  direct: number | null;                // wISE × ise.level + wESE × ese.level
  indirect: {
    courseExitSurvey?: number;          // 0..3, as entered (ATT-9)
    examinerSurvey?: number;
    additionalSurvey?: number;
    value: number | null;               // mean of the entered surveys; null if none
  };
  overall: number | null;               // wDirect × direct + wIndirect × indirect
  pendingReason?: PendingReason;        // why direct/overall are null
}

interface OutcomeAttainmentResult {
  outcomeId: ID;
  kind: OutcomeKind;
  code: string;                         // "PO2", "PSO1"
  statement: string;
  /** Step 5 working: one row per CO with a correlation to this outcome. */
  contributions: {
    coCode: string;
    correlation: CorrelationLevel;
    coOverall: number | null;
    product: number | null;             // coOverall × correlation
  }[];
  sumOfProducts: number | null;
  sumOfCorrelations: number;
  attainment: number | null;            // sumOfProducts / sumOfCorrelations; 0..3
  averageCorrelation: number | null;    // 1..3
  courseMapping: CorrelationLevel | null; // rounded averageCorrelation
  pendingReason?: PendingReason;
}

type AttainmentRunSummary = Pick<AttainmentRun,
  'runId' | 'version' | 'status' | 'reviewStatus' | 'scope' | 'generatedAt' | 'generatedBy' | 'approvedAt'>;

/** Indirect attainment inputs — entered by the faculty per CO in close-out. */
interface IndirectAttainmentInput {
  offeringId: ID;
  version: number;
  rows: {
    coId: ID;
    coCode: string;
    courseExitSurvey?: number;          // 0..3
    examinerSurvey?: number;            // 0..3
    additionalSurvey?: number;          // 0..3 — e.g. guest-lecture / expert feedback
  }[];
  updatedAt?: IsoDateTime;
  updatedBy?: string;
}

interface IndirectAttainmentUpdate {
  version: number;
  rows: IndirectAttainmentInput['rows'];
}

/** One student's standing on one CO — the workbook's per-CO sheets (CO1…COn). */
interface StudentCoScore {
  rollNumber: string;
  studentName?: string;
  ise: { obtained: number; max: number; aboveTarget: boolean };
  ese: { obtained: number; max: number; aboveTarget: boolean } | null;
  absent: boolean;
}

/** The live workbook, structured for an in-app read-only view. */
interface CourseWorkbook {
  offeringId: ID;
  template: AssessmentScheme;           // which reference workbook it follows
  asOf?: string;                        // "Cumulative up to ISE-2" — the last approved run
  main: {
    header: { label: string; value: string | null; pendingReason?: string }[]; // Class, Course, Course coordinator…
    criteria: AttainmentTargetConfig;
    coSummary: { coCode: string; statement: string; overall: number | null; pendingReason?: string }[];
  };
  poPso: {
    outcomes: { code: string; kind: OutcomeKind; shortName: string }[]; // column headers
    matrix: { coCode: string; coOverall: number | null; correlations: Record<string, CorrelationLevel | null> }[];
    average: Record<string, number | null>;
    courseMapping: Record<string, CorrelationLevel | null>;
    attainment: Record<string, number | null>; // from the last approved run
  };
  data: {
    blocks: WorkbookBlock[];            // in plan order
    studentCount: number;               // rows via WB-2
  };
}

/** One assessment's column block in the Data sheet. */
interface WorkbookBlock {
  assessmentId: ID;
  name: string;                         // "ISE-1"
  category: AssessmentCategory;
  phase: 'ISE' | 'ESE';
  status: 'AWAITING_MARKSHEET' | 'AWAITING_MARKS' | 'FILLED' | 'LOCKED';
  questions: { label: string; maxMarks: number; coCodes: string[]; appliesToAllCos: boolean }[];
  /** True once marks are submitted and this cycle's attainment isn't approved yet — shows the button. */
  canCalculate: boolean;
  attainmentApprovedRunId?: ID;         // set once this cycle's run is approved
}

interface WorkbookStudentRow {
  serial: number;
  rollNumber: string;
  studentName?: string;
  /** assessmentId → question label → mark. Missing blocks are omitted. */
  marks: Record<ID, Record<string, number | 'AB' | null>>;
  coTotals: Record<string, { ise: number; ese: number | null }>; // per CO code
}
```

**Rules**

- ATT-2 without `upToAssessmentId` scopes to the latest assessment with submitted marks. `final: true` is allowed only in close-out, after the indirect surveys.
- ATT-2 while the offering already has an un-approved `CALCULATED` run replaces it: the old run becomes `DISCARDED`. There is only ever one preview at a time.
- ATT-2 when a **blocking** readiness check fails → **422 `PRECONDITION_FAILED`** with the failing checks in `fieldErrors`. A locked cycle → **409 `STAGE_LOCKED`**.
- ATT-11 needs status `CALCULATED`. Approving writes the run to the workbook and unlocks the next step (§7.1). Earlier approved runs stay in ATT-4 as history; the workbook shows the latest.
- ATT-9 rejects scores outside 0–3 with **400 `VALIDATION_FAILED`**. Saving surveys updates the workbook's indirect block. It doesn't recalculate; the faculty member runs ATT-2.
- ATT-6 only for the approved final run. It only changes the status; what HOD does next is **PENDING**.
- WB-3 produces the reference workbook (sheets **Main**, **CO1…COn**, **PO & PSO attainment**, **Data**) filled with everything approved so far. Faculty can download it at any point in the semester.
- The frontend never derives `level`, `direct`, `overall`, `attainment` or `product` from other fields. Missing values show as "—" with the `pendingReason`.

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

These are the parameters of the official formula ([§14.1](#141-calculation-spec-backend)). The defaults are the workbook values.

```ts
interface AttainmentTargetConfig {
  configId: ID;
  version: number;
  scope: { academicYearId: ID; departmentId?: ID; programId?: ID };
  ise: PhaseCriteria;                // default weight 0.4, target 60 %, levels 50 / 60 / 70
  ese: {
    theory: PhaseCriteria;           // default weight 0.6, target 50 %, levels 60 / 70 / 80
    practical: PhaseCriteria;        // default weight 0.6, target 50 %, levels 50 / 60 / 70
  };
  directWeight: number;              // default 0.8
  indirectWeight: number;            // default 0.2  (directWeight + indirectWeight = 1)
  updatedBy: string;
  updatedAt: IsoDateTime;
}

/** "Level n = at least levelPct[n] % of students score more than targetMarksPct % of the marks." */
interface PhaseCriteria {
  weight: number;                    // 0..1 — ISE weight + ESE weight = 1
  targetMarksPct: number;            // 0..100
  levelPct: { l1: number; l2: number; l3: number }; // % of students, strictly ascending
}

interface AttainmentTargetUpdate {
  version: number;
  academicYearId: ID;
  ise: PhaseCriteria;
  ese: { theory: PhaseCriteria; practical: PhaseCriteria };
  directWeight: number;
  indirectWeight: number;
}
```

- The server validates the following and returns **400 `VALIDATION_FAILED`** with `fieldErrors` on any breach:
  - `ise.weight + ese.<scheme>.weight = 1`
  - `directWeight + indirectWeight = 1`
  - percentages within 0–100
  - `l1 < l2 < l3`
- The workbook sets L2 and L3 as L1 + 10 and L1 + 20. The UI may offer that as a shortcut, but all three values are stored.
- Saving creates a new version. Earlier versions stay readable (CRD-11) for audit, and attainment runs keep the snapshot they used.
- Faculty only ever read these values (ATT-7); they get no edit control.
- These are the only targets attainment uses. The CAM holds no per-CO targets (O-18, resolved in 2.4).

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
| 409 | `STAGE_LOCKED` | Show the `message` (what unlocks the step) and link to that step |
| 409 | `ALREADY_FINALIZED`, `INVALID_STATE`, `ASSESSMENT_IN_USE`, `DUPLICATE_*`, `PRIMARY_ALREADY_ASSIGNED` | Inline explanation; confirmation dialog where relevant |
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
| **O-1** | **Unit references.** *Unit → CO mapping resolved in 2.3:* it lives in each offering's CAM, suggested by AI and confirmed by the faculty (§9.1), and the finalized one feeds Pipeline 2's `OVERALL_CO` mode. *Still open:* Module 1 stores units with `unitNumber` only (no `unitId`), while Pipeline 2 expects a `unitId`. This contract uses `unitNumber` until decided. | A + M | §9, §11 |
| **O-2** | **Offering model.** Course Offering / Section is still TBD in Module 1. Agree that the backend issues an opaque `offeringId` per (syllabus course, academic year, division)? | A | §7–§14 |
| **O-3** | **Coordinator role.** Is `COORDINATOR` a system role (as proposed)? Is its scope a department or a program? How does it relate to the per-course `COURSE_COORDINATOR`? | A | §4, §15 |
| **O-4** | **Who sets thresholds and targets?** `AGENTS.md` says Coordinator; user story F-028 says Super Admin / authorized HOD. This contract follows `AGENTS.md`. | Team | §15.3 |
| **O-5** | **Allocation vs admin offerings.** Super Admin has a course-offerings screen. Who creates offerings and who allocates faculty to them? Exactly one owner each. | A + Rohan | §15.2, §16 |
| **O-6** | **Routing to FastAPI.** Does the frontend reach AI routes through Spring Boot or a gateway? Paths stay the same either way; CORS and auth setup differ. | A + M | deployment |
| **O-7** | **Material types.** Module 1 `LearningResourceType` (`NOTES`, `PPT`, `PDF`…) describes format; RAG needs purpose (`QUESTION_BANK`, `PREVIOUS_PAPER`…). One enum or two? | A + M | §11.1 |
| ~~O-8~~ | **Resolved in 2.1.** Activities and practicals/tutorials are ICA items counted in the ISE phase; ESE is the theory paper and/or POE/OE (§8, from the workbooks). | — | — |
| ~~O-9~~ | **Resolved in 2.1.** A question maps to one or two COs, or to all COs for ESE theory (§12, from the workbooks). | — | — |
| **O-10** | **Bloom enum.** Contract drops the `L1_` prefix to match Module 1. Mayuri's prompts and outputs must use `REMEMBER…CREATE` too. | M | §10, §11 |
| ~~O-11~~ | **Resolved in 2.1.** The workbook formulas are official (§14.1); every weight and threshold is in the coordinator's config (§15.3). | — | — |
| **O-12** | **Question paper DOCX export.** The workflow diagram mentions Word as well as PDF. Is DOCX needed in v1? | A | QP-5 |
| **O-13** | **Polling vs push.** Polling is the v1 default. Do we want SSE for long AI jobs later? | M | §2.7 |
| **O-14** | **COs in paper validation.** The brief has faculty typing COs for each validation. Contract pre-fills them from the syllabus and lets faculty edit. OK? | Rohan | §10 |
| **O-15** | **Refresh tokens.** Will the backend issue refresh tokens, or is re-login on expiry acceptable for v1? | A | §5 |
| **O-16** | **PO/PSO storage.** Not yet in the October Mongo design. Program-level collection as assumed in ACAD-9 / ADM-11? | A | §6, §9 |
| **O-17** | **How many POs?** The CAM example has PO1–PO12; the attainment workbook has PO1–PO11 (plus PSO1–PSO3). Which list does each program use? The UI renders whatever the CAM inputs hold. | A + Team | §9, §14 |
| ~~O-18~~ | **Resolved in 2.4.** The CAM holds no per-CO expected percentages; attainment uses only the coordinator's targets (§15.3). | — | — |
| **O-19** | **Theory workbook threshold bug.** The theory workbook computes the ESE level with the ISE thresholds (50/60/70) instead of its own ESE thresholds (60/70/80); the practical workbook does it correctly. The contract specifies the ESE thresholds. Confirm, and fix the reference workbook so exports match. | A + Team | §14.1 |
| **O-20** | **Absentees.** The workbook divides by the full class strength, so absent students count as below target. Confirm this is the institution's rule. | Team | §13, §14.1 |
| **O-21** | **CAM scoring rubric.** No college guideline or approved sample CAM exists, so the 3 / 2 / 1 / blank meanings in §9.3 are Mayuri's proposal, marked `PROPOSED`. Does the institution or NBA guidance give official wording? Once confirmed, should the coordinator maintain it (like §15.3), or is it a fixed institutional rule? | Team | §9 |

---

## 20. Changes

### 2.4 → 2.5 (27 Oct 2026)

| Area | Change | Why |
| --- | --- | --- |
| §4 Roles | `LAB_ASSISTANT` removed from `SystemRole`, the portals table, landing priority and the access table | The lab assistant role is removed (confirmed by Rohan) |
| §7 Lifecycle | `marksUpload` + `marksApproval` merge into one `marksEntry` step; `StepKey` `MARKS_UPLOAD` / `MARKS_APPROVAL` → `MARKS_ENTRY`; `nextAction.actor` removed (every step is the faculty's) | The faculty enters and submits their own marks |
| §12 Marksheet | The faculty fills the generated template; MS-4 gains `withMarks` | Same |
| §13 Marks | Rewritten as **Marks entry**: one draft per assessment, filled by importing the template (MK-3) or typing in a grid (MK-2), then submitted (MK-5) or reopened (MK-6). Replaces the lab-assistant upload and faculty approval endpoints | Faculty can upload or type (confirmed by Rohan) |
| §14 Attainment | "Approved marks" → "submitted marks"; `WorkbookBlock.status` `AWAITING_UPLOAD` / `AWAITING_APPROVAL` → `AWAITING_MARKS` | Follows §13 |

### 2.3 → 2.4 (25 Oct 2026)

| Area | Change | Why |
| --- | --- | --- |
| §9 CAM | Inputs are faculty-entered: `Cam.inputs` (`CamInputs`: objectives, COs, units, POs/PSOs, activities, practicals, tutorials), saved through CAM-2; new entries get their IDs from the server; a new CAM is pre-filled from the syllabus and program where they exist | Faculty type or paste the inputs (confirmed by Rohan) |
| §9 CAM | Changing COs or units returns a confirmed mapping to draft; removing one removes its links and cells | The AI's evidence changed |
| §9 CAM | Removed `coExpectations` (Bloom level, expected proficiency %, expected attainment %) and the Learning columns; the CAM has four steps | Bloom levels belong to questions, not COs; expected percentages aren't used (confirmed by Rohan) |
| §3 Types | `CourseOutcome.bloomLevel` removed | Same |
| §14 Attainment | `CoAttainmentResult` no longer echoes expected percentages | Same; resolves O-18 |
| §9.5 | `CamSuggestionContext` carries `inputs` | Inputs now live in the CAM |

### 2.2 → 2.3 (25 Oct 2026)

| Area | Change | Why |
| --- | --- | --- |
| §9 CAM | Two-stage AI suggestions: stage 1 suggests unit → CO links (new CAM-5), the faculty confirms them (new CAM-6), then stage 2 suggests CO → PO/PSO levels (CAM-4, now locked until the mapping is confirmed). `Cam` gains `units`, `unitMapping` and `scoringRubric`; `CamUpdate` gains `unitLinks` | Mayuri's CAM experiment: the AI needs a unit → CO mapping that the syllabus doesn't hold |
| §9 CAM | Suggestions carry `evidence` (units, activities/practicals) and `needsReview` with a `reviewNote`; flagged ones are excluded from "accept all" | Faculty can see why a level was proposed and must decide doubtful cases individually |
| §9 CAM | New `CamScoringRubric`, defaulting to Mayuri's proposed 3 / 2 / 1 / blank criteria, status `PROPOSED`; shown as the legend and sent to the AI | No institutional rubric exists yet **[O-21]** |
| §9 CAM | Activity, practical and tutorial CO links stay faculty-entered; the AI never suggests them | Mayuri's experiment didn't invent them; confirmed by Rohan |
| §9.5 | Internal `CamSuggestionContext` (Spring Boot → FastAPI) written down | Abhijeet and Mayuri build to one shape; faculty never retype syllabus inputs |
| §3 Types | `ProgramOutcome` gains an optional `title` ("Engineering knowledge") | PO descriptions come as title + statement |
| §19 | O-1 partly resolved (unit → CO mapping); O-21 added | — |

### 2.1 → 2.2 (25 Oct 2026)

| Area | Change | Why |
| --- | --- | --- |
| §7 Workspace | New §7.1 lifecycle: Setup → assessment cycles (one after another, in plan order) → Close-out, each step locked until the previous one is done; `OfferingProgress` rebuilt around `StepState`, `AssessmentCycle` and `nextAction`; dashboard gets an `attention` queue; new error `409 STAGE_LOCKED` | Rohan: stages are strictly ordered, one ISE after another |
| §8 Plan | `order` field sets the cycle sequence | Cycles run in plan order |
| §10 / §7 | Paper validation only for ISE and ESE theory papers; activities, practicals, tutorials and POE/OE start at the marksheet | Confirmed by Rohan |
| §12 / §13 | Faculty create the marksheet; **only the lab assistant uploads** marks; faculty review and approve. Approval writes the marks into the workbook | Confirmed by Rohan |
| §14 Attainment | Cumulative runs scoped "up to" an assessment; run states `CALCULATED → APPROVED / DISCARDED`; ATT-11 approve, ATT-12 discard; before ESE, `ese`/`direct`/`overall`/PO values are pending (option a); PO results carry the per-CO `contributions` trace; the readiness check returns the read-only inputs | Rohan's attainment flow: calculate, see every step, approve, then the workbook updates |
| §14.4 Workbook | New live course workbook (WB-1 … WB-3) with the confirmed population logic; faculty view and download only | Replaces manually maintained Excel files; also replaces the separate report-analysis screen |
| §20 | Report analysis is no longer a faculty feature: the workbook covers it | Confirmed by Rohan |

### 2.0 → 2.1 (25 Oct 2026)

| Area | Change | Why |
| --- | --- | --- |
| §14 Attainment | Formulas **confirmed** and written out in §14.1; results are now typed (`ise`, `ese`, `direct`, `indirect`, `overall` per CO; `attainment`, `averageCorrelation`, `courseMapping` per PO) instead of a free-form `breakdown` | The team adopted the institution workbooks as the official spec |
| §14 Attainment | New ATT-8 / ATT-9 (indirect survey scores per CO) and ATT-10 (per-CO student drill-down); readiness checks gain `severity` and `INDIRECT_SURVEYS` | The formula needs survey inputs; the workbook's CO1…CO8 sheets are a per-student view |
| §15.3 Targets | Config now carries ISE / ESE (theory, practical) criteria — weight, target-marks %, three level % — plus direct / indirect weights | Every parameter of the official formula is configurable, with workbook defaults |
| §7 Workspace | `FacultyOffering` gains `assessmentScheme` (THEORY / PRACTICAL), `classStrength`, `courseCoordinator`; progress gains `indirectSurveys` | The workbook's course header and its two variants |
| §8 Plan | Categories become `ISE`, `ACTIVITY`, `PRACTICAL`, `TUTORIAL`, `ESE`, `POE`, `OE`, `OE_POE`, each with a formula phase; activity catalogue added | Resolves O-8 from the workbooks |
| §9 CAM | Adds `courseObjectives` and per-CO `coExpectations` (Bloom level, expected proficiency %, expected attainment %) | The CAM example layout |
| §12 Marksheet | One or two COs per question, or all COs on ESE theory | Resolves O-9 from the workbooks |
| §19 | O-8, O-9, O-11 resolved; O-17 – O-20 added | — |

### v1 → 2.0

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
| `/attainment/config` with weightages and thresholds | Targets in CRD-9…CRD-11, read via ATT-7 | Coordinator owns targets (weights added in 2.1) |
| `AttainmentReport` with formula fields | `AttainmentRun` (typed results since 2.1) | Formula was unspecified in 2.0; confirmed in 2.1 |
| `/dashboard/metrics`, `/dashboard/courses`, `/dashboard/activity` | `GET /me/dashboard` (FAC-3) | One call, based on offerings |
| `POST /analysis/report` (AI report narrative) | Not in v2 | Not in confirmed scope. Will be re-added when EP-004 is scheduled |
| — | New: auth, assessment plan, paper validation, marksheet structure, marks upload, coordination, admin | Confirmed requirements with no contract yet |
