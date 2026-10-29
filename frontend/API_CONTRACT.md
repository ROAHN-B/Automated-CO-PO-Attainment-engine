# API Contract — Automated CO-PO Attainment Engine

**Version 2.8 (draft) · 28 Oct 2026 · Owner: Rohan (frontend)**

> **New in 2.8:** the department **coordinator** prepares each semester: the faculty list (typed or imported from Excel), the **syllabus load distribution** in the college's format with a declaration, the 11 POs and the department's 3 PSOs, and the subject allocation, which emails the faculty; the faculty then **accepts** each subject ([§15](#15-coordination-coordinator-a)). Every subject's assessment plan, lifecycle and workbook columns are generated from its load distribution row ([§8](#8-assessment-plan-a)). Knowledge base and question generation are removed ([§11](#11-removed-knowledge-base--ai-question-generation)).
>
> **New in 2.7:** there is no moderator role. After the AI review the faculty downloads the college's **moderation sheet** (Word or PDF, for the hand-written moderation) and **confirms the paper**, which generates a read-only marksheet; finalizing it writes the assessment's columns into the workbook ([§10](#10-question-paper-validation-a--m), [§12](#12-marksheet-structure-a)).
>
> **New in 2.6:** question paper validation takes a typed paper instead of an uploaded file: the faculty enters each question, its sub-questions, marks, CO (per question or part) and expected Bloom level, and the validated paper pre-fills the marksheet ([§10](#10-question-paper-validation-a--m)). What Spring Boot and FastAPI must build for it is in [§10.7](#107-backend-requirements-a--m).
>
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
| **Abhijeet** | Academic data, auth, RBAC, semester setup, assessments, marks, attainment engine, exports, email | Spring Boot, Spring Data MongoDB | **[A]** |
| **Mayuri** | AI suggestions and analysis: CAM suggestions, question paper validation | Python FastAPI, LLM | **[M]** |

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
11. [Removed: knowledge base & AI question generation](#11-removed-knowledge-base--ai-question-generation)
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

Open questions are tagged like **[O-25]** and listed in [§19](#19-open-questions).

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

Paper analysis, marks validation and attainment runs are asynchronous.

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

/** Bloom's Taxonomy. Used on questions only (§10); COs carry no Bloom level. */
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

**Status: CONFIRMED** (role set; a coordinator manages one department, 28 Oct 2026)

### 4.1 System roles

A user can hold several. The login response lists all of them.

| Role code | Portal after login | Notes |
| --- | --- | --- |
| `SUPER_ADMIN` | `/admin` | Institution and academic setup |
| `HOD` | `/analytics` | Workflow **PENDING** ([§17](#17-hod-pending)) |
| `FACULTY` | `/faculty` | Teaching workflows |
| `COORDINATOR` | `/faculty` (extra "Coordination" section) | Always held together with `FACULTY`. Granted by Super Admin for **one department** (ADM-12); every §15 call is limited to it. No separate portal. |

Landing priority when a user has several roles: `SUPER_ADMIN` → `HOD` → `FACULTY`, unless `primaryRole` says otherwise.

There is **no lab assistant role** (removed in 2.5). Faculty create marksheets and enter marks themselves ([§13](#13-marks-entry-a)).

### 4.2 Course-level responsibilities

Separate from system roles: what a faculty member does **for a specific subject**. Since 2.8 an allocation gives one faculty member the whole subject for one division ([§15.6](#156-subject-allocation)), so `FacultyOffering.myResponsibilities` is `['THEORY_FACULTY']` for theory-scheme offerings and `['PRACTICAL_FACULTY']` for practical ones. The other values are kept for when roles within a subject are specified.

```ts
type CourseAssignmentRole =
  | 'COURSE_COORDINATOR'
  | 'THEORY_FACULTY'
  | 'PRACTICAL_FACULTY'
  | 'LAB_INCHARGE'
  | 'QUESTION_SETTER';
```

There is **no moderator role** (removed in 2.7). Paper moderation is done by hand on the college's moderation sheet, which the faculty downloads from [§10](#10-question-paper-validation-a--m).

### 4.3 Who can call what

| Area | SUPER_ADMIN | HOD | FACULTY | COORDINATOR |
| --- | :-: | :-: | :-: | :-: |
| §6 Academic structure (read) | ✓ | ✓ | ✓ | ✓ |
| §7–§12 Faculty workspace | — | PENDING | ✓ own allocations | ✓ own allocations |
| §13 Marks entry | — | — | ✓ own allocations | ✓ own allocations |
| §14 Attainment | — | PENDING | ✓ own allocations | ✓ |
| §15 Coordination | — | — | — | ✓ own department |
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
| ACAD-9 | GET | `/program-outcomes` | — | `ProgramOutcome[]`: the 11 POs, shared by all departments (§15.5) |
| ACAD-10 | GET | `/departments/{departmentId}/psos` | — | `ProgramOutcome[]`: that department's 3 PSOs (§15.5) |

For semesters III to VIII, the semesters and syllabus courses (ACAD-6 to ACAD-8) are created from the coordinator's declared load distribution ([§15.4](#154-syllabus-load-distribution)): `teachingScheme` is the row's L/T/P and `examinationScheme` its column totals. Each offered elective or MDM option is its own syllabus course.

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
| **A · Setup** (once) | 1. Accept allocation → 2. Assessment plan → 3. CAM | CAM finalized. The course workbook skeleton is generated ([§14.4](#144-live-course-workbook)). |
| **B · Assessment cycles** (one per planned assessment, in plan order) | Exams (ISE I–III, ESE theory): **paper validation → marksheet → marks entry → attainment approval** | That cycle's cumulative attainment run is approved |
| | Activities, practicals, tutorials, POE/OE: **marksheet → marks entry → attainment approval** | |
| **C · Close-out** (once, after every cycle is done) | Indirect surveys → final attainment approval → submit to HOD | Submitted |

Assessment cycles run **one after another**. Cycle *n + 1* (e.g. ISE-2) opens only when cycle *n* (e.g. ISE-1) has its cumulative attainment approved. The order is the assessment plan's `order` field ([§8](#8-assessment-plan-a)).

Only the components a subject has produce cycles. The plan is generated from the coordinator's load distribution ([§15.4](#154-syllabus-load-distribution)), so a subject without ISE has no ISE cycles, and one with only an ESE has a single cycle. The UI builds the stepper from `progress.cycles` and never assumes a component exists.

### 7.2 Endpoints

| # | Method | Path | Query | Response |
| --- | --- | --- | --- | --- |
| FAC-1 | GET | `/me/offerings` | `academicYearId?`, `semesterId?` | `FacultyOffering[]` |
| FAC-2 | GET | `/offerings/{offeringId}` | — | `FacultyOffering` |
| FAC-3 | GET | `/me/dashboard` | `academicYearId?` | `FacultyDashboard` |
| FAC-4 | POST | `/offerings/{offeringId}/accept` | — (no body) | `FacultyOffering` |

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
  /** The coordinator's allocation behind this offering (§15.6). */
  allocation: {
    allocationId: ID;
    status: 'PENDING_ACCEPTANCE' | 'ACCEPTED';
    allocatedBy: string;          // the coordinator's name
    notifiedAt?: IsoDateTime;
    acceptedAt?: IsoDateTime;
  };
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
- An offering appears once the coordinator completes the semester's allocation ([§15.7](#157-completing-the-allocation-and-notifying-the-faculty)), with `allocation.status = 'PENDING_ACCEPTANCE'`.
- **Accept allocation (FAC-4)** is the first setup step. It sets the allocation to `ACCEPTED`, completes the step and unlocks the assessment plan; the coordinator sees the change on the allocation board. Accepting again returns **409 `ALREADY_FINALIZED`**. There is no decline: a faculty member who can't take a subject tells the coordinator, who reassigns it (CRD-7).
- The step key stays `SUBJECT_SELECTION` for compatibility; the UI labels it "Accept allocation".
- `assessmentScheme`, `classStrength` and `courseCoordinator` are the course header shown on every faculty screen. They mirror the Main sheet of the reference workbook.
- Requesting another faculty's `offeringId` returns **403**, not 404.
- Every write endpoint in §8–§14 checks the lock state. Calling a step whose `status` is `LOCKED` returns **409 `STAGE_LOCKED`**, with the `lockedReason` as the `message`.

---

## 8. Assessment plan **[A]**

**Status: CONFIRMED** · generated from the coordinator's load distribution since 2.8

The plan lists every assessment of the subject (ISE-1, ISE-2, activities, practicals, tutorials, ESE, POE…). Since 2.8 **the server generates it** from the subject's row in the coordinator's load distribution ([§15.4](#154-syllabus-load-distribution)): one assessment per item counted there, with its marks. The faculty can't add, remove or re-mark assessments. They set only what the coordinator doesn't: the order, the planned dates and each activity's type. The categories, and the scheme each can appear in:

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
   * COs covered. Read-only since 2.8, filled by the server: activities,
   * practicals and tutorials from their CAM item's CO links (§9), papers and
   * POE/OE from the marksheet (§12). Max 2 COs, or `appliesToAllCos`.
   */
  coIds: ID[];
  appliesToAllCos?: boolean;     // theory POE/OE: marks spread over all ESE COs (§14.1 step 2)
  plannedDate?: IsoDate;
}

interface AssessmentPlanUpdate {
  version: number;
  /** Every generated assessment, once. Only these fields can change. */
  assessments: {
    assessmentId: ID;
    order: number;
    plannedDate?: IsoDate;
    activityType?: ActivityType;   // ACTIVITY rows only
  }[];
}
```

- Several assessments of the same category are allowed (ISE-1, ISE-2, ISE-3).
- `order` sets the sequence of assessment cycles. Once the plan is finalized, the order is fixed, because cycles run one after another (§7.1).
- Adding or removing an assessment, or changing its category, name or marks, returns **400 `VALIDATION_FAILED`** ("Set by the coordinator in the load distribution").
- `examinationScheme` echoes the load distribution row's column totals; `maxMarks` is the item's `maxMarksEach`; names are generated ("ISE-1", "Activity 2", "Practical 7", "Tutorial 3", "ESE", "POE").
- The load distribution can't change once the allocation is completed (§15.4.3), so a plan never changes under the faculty.
- No attainment maths here.

---

## 9. Course Articulation Matrix (CAM) **[A + M]**

**Status: CONFIRMED** · two-stage AI suggestion flow confirmed 25 Oct 2026 · faculty-entered inputs confirmed 25 Oct 2026 · POs/PSOs from the coordinator since 2.8 · scoring rubric is **proposed**, not institutional **[O-21]**

The CAM is the CO → PO/PSO correlation matrix for this offering, plus the course inputs it rests on. Faculty fills it in. AI can **suggest** values, but it never writes into the CAM by itself.

Cells hold 1, 2, 3 or blank. The columns are the coordinator's 11 POs and the department's 3 PSOs ([§15.5](#155-pos-and-psos)); the faculty doesn't enter or edit them.

COs carry **no Bloom level** and the CAM holds no expected percentages. Bloom levels exist only on questions (§10), and attainment uses only the coordinator's targets (§15.8).

### 9.1 Building the CAM

The faculty builds the CAM on one screen, in four steps. AI suggestions come in **two stages**, and stage 2 opens only after the faculty confirms stage 1, so one wrong unit link can't spread across the whole matrix.

| Step | What the faculty does | AI |
| --- | --- | --- |
| 1. Course inputs | Types or pastes the objectives, COs and units; titles each planned activity, practical and tutorial and picks the COs it covers. POs and PSOs are shown read-only | — |
| 2. **Stage 1:** Unit → CO mapping | Starts from AI suggestions (CAM-5), links or unlinks each unit and CO, then **confirms** (CAM-6) | Suggests |
| 3. **Stage 2:** CO → PO/PSO grid | Sets every cell (blank, 1, 2 or 3) with an optional justification, starting from AI suggestions (CAM-4) or by hand | Suggests |
| 4. Finalize | Reviews the checklist and finalizes (CAM-3); the CAM becomes read-only | — |

**Inputs are faculty-entered, except the outcomes.**

- The faculty types the objectives, COs and units, or pastes a list where each line becomes one entry. When the syllabus course (ACAD-8) already holds some, a new CAM starts pre-filled and the faculty can still edit them.
- `programOutcomes` is a read-only copy of the coordinator's POs and PSOs (ACAD-9, ACAD-10). A draft CAM always holds the latest version; finalizing stores the versions used (`outcomeVersions`), so later edits never change a finalized CAM.
- Activities, practicals and tutorials start as one item per planned assessment of that category (§8). The faculty adds each item's title and CO links, but can't add or remove items.
- The CAM's copy is the one the AI, the matrix and the course workbook use.

The unit → CO mapping belongs to the **offering's CAM**, not the syllabus: Module 1 stores no such mapping.

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
  outcomeVersions?: { po: number; pso: number }; // set on finalize: the PO/PSO versions used
  updatedAt: IsoDateTime;
  updatedBy: string;
}

interface CamInputs {
  courseObjectives: string[];           // in order
  courseOutcomes: CamCourseOutcome[];   // in display order; at least one to confirm the mapping
  units: CamUnit[];
  programOutcomes: CamProgramOutcome[]; // read-only: the 11 POs, then the department's 3 PSOs (§15.5)
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

- `programOutcomes` in a CAM-2 body is ignored; the server fills it from §15.5. Adding or removing activity, practical or tutorial items returns **400 `VALIDATION_FAILED`**.
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

**Status: CONFIRMED** · typed paper entry confirmed 28 Oct 2026 (replaces file upload and extraction)

The faculty **types the question paper** into a form: the paper details, the COs it covers, and every question with its sub-questions, marks, CO and expected Bloom level. The AI checks each sub-question against its CO and Bloom level and scores it. The faculty reviews the result, downloads the college's moderation sheet for the hand-written moderation, and **confirms the paper**, which generates the assessment's marksheet (§12). Nothing is uploaded or parsed, and no one else is involved: there is no moderator role.

**Ownership:** Abhijeet owns the paper resource, its checks, the moderation sheet and the marksheet it generates. Mayuri owns the analysis. The frontend sees one resource per assessment.

### 10.1 The paper form

The form follows the institution's paper layout (sample: ISE-III, Network Security, Set A, 30 marks):

| Level | Fields | Example |
| --- | --- | --- |
| Paper | Set, maximum marks, duration, exam date, and the **COs the paper covers**, ticked from the course's finalized CAM | Set A · 30 marks · 60 min · CO3, CO4 |
| Question | Number, heading, optional attempt rule, and the **CO** (when the question has no parts) | Q2 "Answer the following", attempt any 4 of 5, CO3 |
| Part (optional) | Label and the **CO** for all its sub-questions | Q1 (a) → CO3, Q1 (b) → CO4 |
| Sub-question | Label, text, type (descriptive or MCQ), options A–D for an MCQ, marks, **expected Bloom level** (1 Remember … 6 Create) | Q1 (a)(ii) MCQ, 1 mark, 2 Understand |

The CO is chosen per question, or per part when the question has parts; its sub-questions inherit it. The Bloom level is chosen per sub-question.

### 10.2 Lifecycle

```
DRAFT → ANALYZING → ANALYSIS_READY → FINALIZED
  ↑         ↓             │    ↑          │
  │   ANALYSIS_FAILED     │    └──────────┘  QPV-8 reopen (only while the marksheet isn't finalized)
  └───────────────────────┘   editing after analysis returns the paper to DRAFT; QPV-3 retries a failure
```

### 10.3 Endpoints

One paper per assessment, addressed by the assessment.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| QPV-1 | GET | `/assessments/{assessmentId}/question-paper` | — | `QpPaper` (an empty `DRAFT` if none, with `maxMarks` from the assessment plan) |
| QPV-2 | PUT | `/assessments/{assessmentId}/question-paper` | `QpPaperUpdate` | `QpPaper` |
| QPV-3 | POST | `/assessments/{assessmentId}/question-paper/validate` | `{ version }` | `QpPaper` (202, `ANALYZING`) |
| QPV-4 | GET | `/assessments/{assessmentId}/question-paper/result` | — | `QpValidationResult` |
| QPV-5 | POST | `/assessments/{assessmentId}/question-paper/moderation-sheet` | `{ format: 'DOCX' \| 'PDF' }` | `ExportFile` or `AsyncJob` — ISE papers only (§10.7.7) |
| QPV-6 | POST | `/assessments/{assessmentId}/question-paper/finalize` | `{ version }` | `QpPaper` (`FINALIZED`) |
| QPV-7 | GET | `/bloom-keywords/defaults` | — | `BloomKeywordMap` — ASSUMPTION |
| QPV-8 | POST | `/assessments/{assessmentId}/question-paper/reopen` | `{ version }` | `QpPaper` (`ANALYSIS_READY`) |

While the paper is `ANALYZING`, the UI polls QPV-1 (§2.7).

### 10.4 Types

```ts
type ExamCategory = 'ISE' | 'ESE';

type QpPaperStatus = 'DRAFT' | 'ANALYZING' | 'ANALYSIS_FAILED' | 'ANALYSIS_READY' | 'FINALIZED';

interface QpPaper {
  validationId: ID;
  offeringId: ID;
  assessmentId: ID;
  assessmentName: string;                 // "ISE-3"
  examCategory: ExamCategory;
  status: QpPaperStatus;
  version: number;
  header: QpPaperHeader;
  /** Read-only: the COs of the course's finalized CAM, for the picker. */
  courseOutcomes: { coId: ID; code: string; statement: string }[];
  coIds: ID[];                            // the COs this paper covers (a subset of courseOutcomes)
  questions: QpQuestion[];
  /** Backend-computed, attempt rules applied. The UI may preview totals; this value counts. */
  computedTotalMarks: number;
  /** Problems that block validation, e.g. totals not matching. Empty when ready. */
  issues: QpIssue[];
  error?: { errorCode: string; message: string };   // when ANALYSIS_FAILED
  finalizedAt?: IsoDateTime;              // when the faculty confirmed the paper (QPV-6)
  updatedAt: IsoDateTime;
  updatedBy: string;
}

interface QpPaperHeader {
  setLabel?: string;                      // "A"
  maxMarks: number;                       // 30
  durationMinutes?: number;               // 60
  examDate?: IsoDate;
}

interface QpQuestion {
  questionNo: string;                     // "Q1", unique in the paper
  heading?: string;                       // "Choose the correct option"
  attemptRule?: AttemptRule;              // e.g. attempt 4 of the 5 sub-questions (§12)
  coId?: ID;                              // required when the question has no parts
  parts?: QpPart[];                       // either parts …
  subQuestions?: QpSubQuestion[];         // … or sub-questions directly, never both
}

interface QpPart {
  label: string;                          // "a", unique in the question
  coId: ID;                               // applies to every sub-question of the part
  subQuestions: QpSubQuestion[];
}

interface QpSubQuestion {
  label: string;                          // "i", unique in its question or part
  text: string;
  type: 'DESCRIPTIVE' | 'MCQ';
  options?: { key: string; text: string }[];   // MCQ only: 2–6 options, keys "A", "B", …
  marks: number;                          // > 0
  expectedBloomLevel: BloomLevel;
}

interface QpPaperUpdate {
  version: number;
  header: QpPaperHeader;
  coIds: ID[];
  questions: QpQuestion[];
}

interface QpIssue {
  code: 'TOTAL_MISMATCH' | 'NO_QUESTIONS' | 'MISSING_CO' | 'CO_NOT_SELECTED' | 'MISSING_TEXT'
      | 'INVALID_MARKS' | 'MCQ_OPTIONS' | 'DUPLICATE_LABEL' | 'ATTEMPT_RULE';
  message: string;                        // safe to show
  path?: string;                          // e.g. "questions[1].subQuestions[3].marks"
}

/** Faculty-facing guide to the six levels; also sent to the AI. */
type BloomKeywordMap = Record<BloomLevel, string[]>;

interface QpValidationResult extends AiProvenance {
  validationId: ID;
  basedOnVersion: number;                 // the paper version that was analysed
  overallValidationScore: number;         // 0..100, computed by Spring Boot (§10.7.5)
  summary?: string;                       // short AI overview
  subQuestions: ValidatedSubQuestion[];   // in paper order
  /** Backend-computed roll-ups, display only. */
  coCoverage: { coId: ID; code: string; subQuestionCount: number; marks: number }[];
  bloomDistribution: { level: BloomLevel; subQuestionCount: number; marks: number }[];
}

interface ValidatedSubQuestion {
  questionNo: string;                     // "Q1"
  partLabel?: string;                     // "a"
  label: string;                          // "ii"
  coId: ID;                               // as entered (inherited from the question or part)
  coAlignment: 'ALIGNED' | 'PARTIAL' | 'MISALIGNED';
  suggestedCoId?: ID;                     // the AI's better match, when not ALIGNED
  expectedBloomLevel: BloomLevel;
  detectedBloomLevel: BloomLevel;
  bloomAlignment: 'ALIGNED' | 'PARTIAL' | 'MISALIGNED';   // from expected vs detected level (§10.7.5)
  mcqCheck?: { status: 'OK' | 'ISSUE'; note?: string };   // MCQ only, e.g. no single correct option
  aiAnalysis: string;                     // explanation shown in the detail panel
  validationScore: number;                // 0..100, computed by Spring Boot from the AI's judgements (§10.7.5)
  flags?: string[];                       // e.g. "AMBIGUOUS_WORDING"
}
```

### 10.5 Rules

- Paper validation exists only for **ISE and ESE theory papers**. It is the first step of their assessment cycle (§7.1). Activities, practicals, tutorials and POE/OE have no paper and start at the marksheet.
- The COs come from the course's **finalized CAM**; the faculty only ticks which ones the paper covers. `coIds` must be a subset of the CAM's COs, and every question or part CO must be in `coIds`.
- QPV-2 saves a draft even when it has problems; they come back in `issues`. It is allowed in `DRAFT`, `ANALYSIS_FAILED` and `ANALYSIS_READY`; editing an analysed paper returns it to `DRAFT` and discards the old result.
- QPV-3 needs `issues` to be empty, otherwise **422 `PRECONDITION_FAILED`**. The main check is that `computedTotalMarks` equals `header.maxMarks`. With an attempt rule, a question counts the marks of its highest-scoring `attempt` sub-questions (Q2: 4 × 6 = 24).
- The scoring formula belongs to the backend and the AI. The frontend shows `validationScore`, `overallValidationScore`, alignments and detected Bloom levels as given, and never derives them.
- QPV-5, the **moderation sheet**, is the college's ISE moderation form filled from the paper (§10.7.7). It's available once the paper is analysed (`ANALYSIS_READY` or `FINALIZED`). The moderator's part is left blank to fill by hand. ESE papers have no moderation sheet.
- QPV-6 (**Confirm paper**) needs `ANALYSIS_READY`, otherwise **409 `INVALID_STATE`**. Downloading the moderation sheet isn't required first. Confirming:
  - locks the paper (read-only) and sets `finalizedAt`;
  - completes the cycle's `paperValidation` step and unlocks its `marksheet` step;
  - **generates the assessment's marksheet structure** (§12) from the paper. It is read-only: the faculty never types it twice, and paper and marksheet can't drift apart.
- QPV-8 (**Reopen**) is allowed while the paper is `FINALIZED` and the marksheet isn't finalized yet, otherwise **409 `INVALID_STATE`**. It returns the paper to `ANALYSIS_READY` (the review stays), deletes the generated marksheet structure and locks the `marksheet` step again. Editing the paper afterwards returns it to `DRAFT` as usual.
- `header.maxMarks` always comes from the assessment plan; the server overwrites whatever the client sends.
- Every write uses `version`; a stale version returns **409 `VERSION_CONFLICT`**. After confirming, writes return **409 `ALREADY_FINALIZED`** until the paper is reopened.
- The full backend behaviour (storage, checks, the analysis job, scores, confirming, the moderation sheet and the AI endpoint) is in §10.7.

### 10.6 Validation context (Spring Boot → FastAPI, internal)

Spring Boot sends the saved paper to Mayuri's pipeline with everything the AI needs; no file and no extraction step.

```ts
interface QpValidationContext {
  course: CourseRef & { assessmentScheme: 'THEORY' };
  assessment: { assessmentId: ID; name: string; examCategory: ExamCategory };
  header: QpPaperHeader;
  courseOutcomes: { coId: ID; code: string; statement: string }[];   // only the selected COs
  bloomKeywords: BloomKeywordMap;
  subQuestions: {                                                    // flattened, in paper order
    questionNo: string; partLabel?: string; label: string;
    heading?: string; text: string; type: 'DESCRIPTIVE' | 'MCQ';
    options?: { key: string; text: string }[];
    marks: number; coId: ID; expectedBloomLevel: BloomLevel;
  }[];
}
```

### 10.7 Backend requirements **[A + M]**

What Spring Boot and FastAPI must build so the paper screen works against real services. The frontend's mock (`src/app/core/mocks/question-paper.mock.ts`) implements the same checks, states and scores, and its tests (`paper-draft.spec.ts`) show the expected behaviour; it doesn't simulate retries, timeouts or the PDF.

#### 10.7.1 Who builds what

| Piece | Owner | Summary |
| --- | --- | --- |
| `questionPapers` storage, QPV-1, QPV-2 | **A** | Store the typed paper, recompute `issues` and `computedTotalMarks` on every read and save |
| Paper checks (§10.7.4) | **A** | The blocking `issues` list |
| QPV-3 and the analysis job | **A** | State change, async call to FastAPI, check its answer, compute scores, save the result |
| Scores, coverage, Bloom distribution (§10.7.5) | **A** | Deterministic, from the AI's judgements |
| QPV-4 | **A** | Read the result |
| QPV-5 moderation sheet (§10.7.7) | **A** | The college's form as Word and PDF, filled from the paper |
| QPV-6, QPV-8 and their lifecycle effects (§10.7.6) | **A** | Confirm: lock the paper, move the lifecycle, generate the read-only §12 marksheet. Reopen: undo that |
| QPV-7 Bloom keyword defaults | **A** | Seeded configuration, sent to the AI and shown to faculty |
| `POST /question-paper/validate` (internal) | **M** | Judge each sub-question's CO fit, Bloom level and MCQ options (§10.7.8) |

#### 10.7.2 Storage (MongoDB)

**`questionPapers`**: one document per assessment, unique index on `assessmentId`, plus an index on `offeringId`.

```ts
interface QuestionPaperDocument {
  _id: ObjectId;                     // = validationId
  offeringId: ID;
  assessmentId: ID;                  // unique
  status: QpPaperStatus;
  version: number;                   // starts at 1 on the first save
  header: QpPaperHeader;             // maxMarks always copied from the assessment plan
  coIds: ID[];
  questions: QpQuestion[];           // exactly as saved (§10.4)
  currentResultId?: ID;              // the qpValidationResults entry for this version, when analysed
  analysis?: {                       // while ANALYZING and after a failure
    startedAt: IsoDateTime;
    jobId: ID;
    error?: { errorCode: string; message: string };
  };
  finalizedAt?: IsoDateTime;         // set by QPV-6, cleared by QPV-8
  finalizedBy?: ID;
  createdAt: IsoDateTime; createdBy: ID; updatedAt: IsoDateTime; updatedBy: ID;
}
```

- `computedTotalMarks` and `issues` aren't stored. Recompute them on every QPV-1 and QPV-2 response, so a change to the checks applies to existing drafts.
- `courseOutcomes` isn't stored. Read it from the finalized CAM for each response. The CAM can't change once finalized, so the paper's `coId`s stay valid.

**`qpValidationResults`**: one document per analysis, in the `QpValidationResult` shape (§10.4) plus `paperId`, `superseded: boolean` and the raw AI response for audit.

- Saving an edit to an analysed paper sets `superseded: true` on its result and clears `currentResultId`. Results are never deleted.
- QPV-4 returns only the current result.

**Confidentiality.** A paper is confidential until the exam is held.

- Only the faculty allocated to the offering may read it; return 403 for everyone else, HOD included, until the HOD workflow is specified (§17).
- Never write question text, options or AI notes to application logs; log IDs, versions and timings only.
- Mayuri: use an LLM configuration that doesn't retain or train on prompts.

#### 10.7.3 Endpoint behaviour

Every endpoint first runs the same checks, in this order:

1. 401 or 403 under §2.8 and §4.3: the caller must be allocated to the assessment's offering.
2. 404 `NOT_FOUND` when the assessment doesn't exist.
3. 404 `NOT_FOUND` when it isn't an ISE, or an ESE theory paper, of a theory offering ("Only ISE and ESE theory papers have a question paper.").
4. 409 `STAGE_LOCKED` when the cycle's `paperValidation` step is `LOCKED`, with the step's `lockedReason` as the `message` (§7.1). This also covers a CAM that isn't finalized yet.

| # | Allowed when | Behaviour | Errors |
| --- | --- | --- | --- |
| QPV-1 | any status | Returns the stored paper. With none stored, returns an **unsaved** empty draft: `version: 0`, `header.maxMarks` from the plan, no questions. It doesn't insert anything. | — |
| QPV-2 | `DRAFT`, `ANALYSIS_FAILED`, `ANALYSIS_READY` | <ul><li>Replaces `header`, `coIds` and `questions`; `header.maxMarks` is overwritten with the plan's value.</li><li>`version` 0 creates the document.</li><li>From `ANALYSIS_READY` or `ANALYSIS_FAILED`, the status returns to `DRAFT`, the result is superseded and `analysis.error` is cleared.</li><li>The first save moves the lifecycle step from `AVAILABLE` to `IN_PROGRESS`.</li><li>Increments `version`.</li></ul> | <ul><li>400 `VALIDATION_FAILED` for a malformed body only (§10.7.4 limits)</li><li>409 `VERSION_CONFLICT`</li><li>409 `INVALID_STATE` while `ANALYZING`</li><li>409 `ALREADY_FINALIZED` when `FINALIZED`</li></ul> |
| QPV-3 | `DRAFT`, `ANALYSIS_FAILED` | <ul><li>Needs `issues` to be empty.</li><li>Sets `ANALYZING` and `analysis.startedAt`, increments `version`, queues the analysis job (§10.7.5).</li><li>Returns **202** with the paper.</li></ul> | <ul><li>409 `VERSION_CONFLICT`</li><li>409 `INVALID_STATE` when `ANALYZING` or `ANALYSIS_READY`</li><li>409 `ALREADY_FINALIZED` when `FINALIZED`</li><li>422 `PRECONDITION_FAILED` with issues ("Fix the 2 problems in the paper first.")</li></ul> |
| QPV-4 | `ANALYSIS_READY`, `FINALIZED` | Returns the current result. | 404 `NOT_FOUND` when there is no current result |
| QPV-5 | `ANALYSIS_READY`, `FINALIZED`; ISE only | Renders the moderation sheet in the requested format (§10.7.7) and returns an `ExportFile`, or an `AsyncJob` when it's slow (§2.6). | <ul><li>400 `VALIDATION_FAILED` for another `format`</li><li>404 `NOT_FOUND` for an ESE paper ("ESE papers have no moderation sheet.")</li><li>409 `INVALID_STATE` before the paper is analysed</li></ul> |
| QPV-6 | `ANALYSIS_READY` | Confirms the paper: applies §10.7.6 in one transaction. | <ul><li>409 `VERSION_CONFLICT`</li><li>409 `INVALID_STATE` in any other status</li></ul> |
| QPV-7 | always (any signed-in faculty) | Returns the institution's Bloom keyword map. Seed it with defaults; a later admin screen may edit it. | — |
| QPV-8 | `FINALIZED`, marksheet not finalized | Reopens the paper: undoes §10.7.6 in one transaction (below). | <ul><li>409 `VERSION_CONFLICT`</li><li>409 `INVALID_STATE` in any other status, or once the marksheet is finalized ("The marksheet is finalized, so the paper can't be reopened.")</li></ul> |

**Stuck analyses.** A paper still `ANALYZING` 10 minutes after `analysis.startedAt` moves to `ANALYSIS_FAILED` with `UPSTREAM_TIMEOUT`. Do it on read or with a scheduled sweep, so the faculty can retry.

#### 10.7.4 Paper checks

The checks run on every QPV-1 and QPV-2 response. Each failure is one `QpIssue`. `message` is shown as is, and `path` points at the field, using the `QpPaperUpdate` shape: `questions[1].parts[0].subQuestions[2].marks`. A paper can be saved with issues; it can't be validated with them.

| Code | Raised when | Example `message` |
| --- | --- | --- |
| `CO_NOT_SELECTED` | No CO is ticked; a ticked CO isn't in the CAM; or a question or part uses a CO that isn't ticked | "Q1 (b) uses CO1, which isn’t ticked for this paper." |
| `MISSING_CO` | A question without parts, or a part, has no CO | "Choose the CO for Q2." |
| `NO_QUESTIONS` | The paper, a question without parts, or a part has no sub-questions | "Q3 has no sub-questions." |
| `MISSING_TEXT` | Empty question number, part label, sub-question label or text; or a question has both `parts` and `subQuestions` | "Q1 (a) (ii) has no question text." |
| `INVALID_MARKS` | `header.maxMarks` ≤ 0, or a sub-question's marks ≤ 0 | "Q2 (iv) needs marks greater than 0." |
| `MCQ_OPTIONS` | An MCQ has fewer than 2 or more than 6 options, an empty option, or a repeated key | "Q1 (b) (vi) needs 2 to 6 options." |
| `DUPLICATE_LABEL` | A repeated question number in the paper, part label in a question, or sub-question label in a question or part (trimmed, case-insensitive) | "Two questions are numbered Q2." |
| `ATTEMPT_RULE` | `attempt` < 1, `attempt` > `outOf`, or `outOf` ≠ the question's sub-question count (across all its parts) | "Q2: “attempt 4 of 5” must match its 4 sub-questions." |
| `TOTAL_MISMATCH` | `computedTotalMarks` ≠ `header.maxMarks` (only when the paper has questions and `maxMarks` > 0) | "The questions add up to 31 marks, but the paper is out of 30." |

**`computedTotalMarks`** is the sum over questions. Each question counts:
- all its sub-question marks (across its parts); or
- with an attempt rule, only its `attempt` highest marks.

Marks may be halves (0.5 steps).

**Limits** that return **400 `VALIDATION_FAILED`** instead of an issue, since the form can't produce them:
- at most 30 questions, 10 parts per question and 30 sub-questions per question;
- sub-question text at most 4,000 characters, option text 500, headings 300;
- `type` must be `DESCRIPTIVE` or `MCQ`, and `expectedBloomLevel` one of the six values;
- `options` only on MCQs;
- marks must be numbers with at most one decimal place.

#### 10.7.5 Analysis job (Spring Boot)

1. Build `QpValidationContext` (§10.6) from the saved paper:
   - only the ticked COs;
   - sub-questions flattened in paper order, each carrying the CO of its question or part;
   - the QPV-7 keyword map.
2. Call FastAPI `POST /question-paper/validate` (§10.7.8):
   - send the `X-Internal-Token` header;
   - time out after 120 s;
   - retry once on a timeout or 5xx.
3. Check the answer before trusting it. On any failure, set `ANALYSIS_FAILED` with `AI_OUTPUT_INVALID`. The answer must have:
   - exactly one entry per sub-question, matched on `questionNo` + `partLabel` + `label`;
   - valid enum values;
   - each `suggestedCoId` among the ticked COs, never equal to the entered CO, and present only when `coAlignment` isn't `ALIGNED`;
   - `mcqCheck` on MCQs only.
4. Compute, deterministically, and store the result:
   - `bloomAlignment` from the gap between the expected and detected level (positions 1–6): 0 → `ALIGNED`, 1 → `PARTIAL`, 2 or more → `MISALIGNED`;
   - each sub-question's `validationScore`: 100, then subtract:

     | Finding | Deduction |
     | --- | --- |
     | CO alignment `PARTIAL` | 20 |
     | CO alignment `MISALIGNED` | 40 |
     | Bloom alignment `PARTIAL` | 15 |
     | Bloom alignment `MISALIGNED` | 35 |
     | `mcqCheck.status = ISSUE` | 15 |
     | Any `flags` | 10 |

     Floor at 0. **ASSUMPTION**: the weights are a proposal until the team confirms them.
   - `overallValidationScore`: the mean of the sub-question scores weighted by marks, rounded to an integer;
   - `coCoverage`: per ticked CO, in CO order, the number of sub-questions and the sum of their marks (attempt rules not applied: this is what the paper asks, not what a student answers);
   - `bloomDistribution`: all six levels in order, by **expected** level, with count and marks;
   - `summary` from the AI, and `AiProvenance` from its response.
5. Save the result, set `currentResultId` and `ANALYSIS_READY`, and increment `version`.

On failure, store the error with a user-safe message:

| `errorCode` | When |
| --- | --- |
| `AI_SERVICE_UNAVAILABLE` | The AI service is down or returned 5xx after the retry |
| `UPSTREAM_TIMEOUT` | The call timed out, or the analysis was stuck |
| `AI_OUTPUT_INVALID` | The AI's answer failed step 3 |

#### 10.7.6 Confirm paper (QPV-6) and reopen (QPV-8), each in one transaction

**Confirm (QPV-6):**

1. Paper: `status = FINALIZED`, set `finalizedAt` / `finalizedBy`, increment `version`. Every later QPV-2 or QPV-3 returns 409 until it's reopened.
2. Lifecycle (§7.1), for this cycle:
   - `paperValidation = DONE`;
   - `marksheet = AVAILABLE`;
   - `nextAction = { step: 'MARKSHEET', assessmentId, label: 'Check and finalize the ISE-3 marksheet' }`.
3. Create the assessment's §12 `AssessmentStructure` as a `DRAFT` with `source: 'QUESTION_PAPER'`, so it is read-only (MS-2 refuses it). It doesn't exist yet: the marksheet step was locked until now. Map the paper into it like this:

| Paper | Marksheet structure (§12) |
| --- | --- |
| `questions[].questionNo` | `StructureQuestion.questionNo` |
| `questions[].attemptRule` | `StructureQuestion.attemptRule` (unchanged; `outOf` counts sub-questions across parts) |
| Sub-question in a part | `SubQuestion` with `label: "(a)(i)"`, `coIds: [part.coId]` |
| Sub-question without a part | `SubQuestion` with `label: "(i)"`, `coIds: [question.coId]` |
| `marks` | `maxMarks` |
| `expectedBloomLevel` | `bloomLevel` |
| assessment plan max marks | `plannedMaxMarks` |

**Reopen (QPV-8):** paper back to `ANALYSIS_READY` (result kept), `finalizedAt` cleared; delete the generated `AssessmentStructure`; lifecycle `paperValidation = IN_PROGRESS`, `marksheet = LOCKED` ("Confirm the question paper first"), `nextAction = { step: 'PAPER_VALIDATION', assessmentId, label: 'Confirm the ISE-3 question paper' }`. Refused once the marksheet is finalized, because its columns are already in the workbook.

Multi-document transactions need a replica set. Atlas has one; a local single-node MongoDB must be started as a replica set.

#### 10.7.7 Moderation sheet (QPV-5)

The college's "In Semester Examination Test Question Paper Moderation Sheet" (WIT reference: `Gen-AI_ISE_Question_Paper_Moderation_Sheet_06_August_2024.doc`), one A4 page, generated as **DOCX** and **PDF** with the same layout. Moderation is done by hand on the printout, so the backend fills only the paper setter's part.

**Header:** the institution's logo and name ("Walchand Institute of Technology, Solapur"); "{department}, {Odd|Even} Semester, {academic year as 2025-26}"; the title.

**Table 1, Self-Assessment by Paper Setter**: filled.

| # | Field | Value | Sample |
| --- | --- | --- | --- |
| 1 | ISE Test: I / II / III | The assessment's ISE number in Roman numerals | ISE-3 → III |
| 2 | Course | Course name, bold | Network Security |
| 3 | Class and Semester | Year of study + semester in Roman numerals, bold | Final Year - VII |
| 4 | Course Code | Course code | 23ECU7E1T |
| 5 | Marking Scheme | Three rows (Q. No. / CO / Marks), one column per main question, at least 6 columns (blank ones stay empty). CO: the CO numbers used in that question, e.g. "3, 4" when its parts use CO3 and CO4. Marks: the question's marks with its attempt rule applied | Q1: 3, 4 / 6 · Q2: 3 / 24 |
| 6 | Total number of Questions | Number of main questions, two digits | 02 |
| 7 | Date of Submission of Question Paper | `finalizedAt` as "06 Oct 2025"; blank before the paper is confirmed | — |
| 8 | Date of Moderation | Blank | — |

**Table 2, Assessment by Subject Expert/Moderator**: left blank except for the question list.

- Column 1 lists every sub-question in paper order as `Q {n}-{label}`: `Q 1-i` … `Q 1-vi`, `Q 2-i` … `Q 2-v` ({n} is the question number without "Q"). Part letters are left out when the sub-question labels are unique across the question's parts, as on the sample; otherwise the row reads `Q {n}-{part}-{label}`.
- "Is mapping of question appropriate with CO? [Mark Yes / No / Suggestion]", "Corrections, if any", "Suggestions, if any" and "Incorporation of suggestions" are empty boxes. The AI review is **not** printed on the sheet.

**Signatures:** "Name and Signature of Question Paper Setter" carries the faculty's full name; "Name and Signature of Subject Experts/Moderators" is blank.

**Files:** `{courseCode}_{assessmentName}_Set{setLabel}_moderation_sheet.docx` or `.pdf`; download links expire after 10 minutes. Exact fonts and border widths follow the reference `.doc`; the cell-level formatting is the backend's, as for the workbook.

#### 10.7.8 AI service endpoint **[M]** (internal)

`POST /question-paper/validate` on FastAPI, behind the same `X-Internal-Token` check as the CAM routes.

```ts
// Request (Spring Boot → FastAPI)
interface QpValidateRequest {
  validationId: ID;
  basedOnVersion: number;
  context: QpValidationContext;          // §10.6
}

// Response: ApiResponse<QpAiAnalysis>
interface QpAiAnalysis extends AiProvenance {
  basedOnVersion: number;
  summary?: string;                      // 1–2 sentences for the faculty
  subQuestions: {
    questionNo: string; partLabel?: string; label: string;   // echo the keys from the request
    coAlignment: 'ALIGNED' | 'PARTIAL' | 'MISALIGNED';
    suggestedCoId?: ID;                  // only when not ALIGNED, and only a CO from the context
    detectedBloomLevel: BloomLevel;      // the level the wording demands
    mcqCheck?: { status: 'OK' | 'ISSUE'; note?: string };    // MCQs only
    aiAnalysis: string;                  // 1–3 sentences: why, and how to improve it
    flags?: ('AMBIGUOUS_WORDING' | 'OUT_OF_SYLLABUS' | 'MULTIPLE_PARTS_IN_ONE' | 'TOO_LONG_FOR_MARKS')[];
  }[];
}
```

What the pipeline judges:

- **CO fit.** Does the sub-question test the CO statement it's mapped to? Use the question heading as context.
  - `ALIGNED`: it clearly tests that CO;
  - `PARTIAL`: it touches the CO, but another ticked CO fits better;
  - `MISALIGNED`: it tests a different CO.

  Suggest only among the ticked COs.
- **Bloom level.** Classify the cognitive demand of the wording (the task the student must perform, not the topic) using `bloomKeywords` as guidance. Return the level only. Spring Boot compares it with the expected level.
- **MCQ check.** The paper carries no answer key ([O-24]), so check only what the text shows:
  - one option is defensibly correct;
  - no two options mean the same;
  - no "all/none of the above" ambiguity;
  - the stem makes sense alone.
- **Flags** only when the wording itself causes the problem.
- Use `REMEMBER … CREATE` and the other enums exactly as written ([O-10]). Return `aiAnalysis` and `summary` in plain English, without markdown.
- Validate the model's JSON against the schema and retry the LLM once on invalid output. If it's still invalid, return 502 `AI_SERVICE_UNAVAILABLE` with a generic message, as the CAM routes do.

The service doesn't compute scores, coverage or distributions; Spring Boot does (§10.7.5), so the numbers are reproducible.

#### 10.7.9 Tests the backends should have

- **Checks:** each issue code raised for a minimal bad paper and absent for the sample paper; `computedTotalMarks` with and without attempt rules (sample: 6 + 4 × 6 = 30); a half-mark total.
- **States:** every row of §10.7.3, including `VERSION_CONFLICT`, editing an analysed paper (result superseded, back to `DRAFT`), `ALREADY_FINALIZED` after confirming, and reopen refused once the marksheet is finalized.
- **Locks:** a locked cycle returns `STAGE_LOCKED` with its reason; an activity returns 404; an unallocated faculty gets 403.
- **Analysis job:** success; timeout then retry; invalid AI output → `AI_OUTPUT_INVALID`; stuck job → `UPSTREAM_TIMEOUT`; the scores, coverage and distribution for a fixed AI answer.
- **QPV-6 / QPV-8:** the lifecycle moves, the marksheet structure matches the mapping table and is read-only; reopening restores the previous state exactly.
- **QPV-5:** every Table 1 field for the sample paper (Q2 marks 24, CO "3, 4" for Q1), the `Q 1-i` row labels, blank moderator part, DOCX and PDF both open; 404 for ESE.
- **AI service [M]:** the schema is enforced; one entry per sub-question; `suggestedCoId` stays within the context; enums are exact; one live test on the sample paper.

---

## 11. Removed: knowledge base & AI question generation

**Removed from scope in 2.8 (28 Oct 2026).** The knowledge base (reference library), AI question generation, the question bank and question paper export (the KB-, GEN-, QB- and QP- endpoints) are no longer part of the product. The reference library may return in a later version; question generation won't. The section number is kept so that later numbers don't change.

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
  /** QUESTION_PAPER: generated from the confirmed paper (§10), read-only. FACULTY: typed by the faculty. */
  source: 'QUESTION_PAPER' | 'FACULTY';
  version: number;
  questions: StructureQuestion[];
  /** Paper-level rule, e.g. "attempt any 4 of 5 questions". */
  attemptRule?: AttemptRule;
  /** Backend-computed, taking attempt rules into account. Display only. */
  computedMaxMarks?: number;
  issues: { code: string; message: string; path?: string }[];
  /** Read-only: the course's CAM COs, so the screen can show codes for `coIds`. */
  courseOutcomes: { coId: ID; code: string; statement: string }[];
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
- For ISE and ESE theory papers the structure is **generated from the confirmed question paper** (§10.5, mapping in §10.7.6): each sub-question becomes a marksheet item with its marks, Bloom level and the CO of its question or part; parts are flattened into labels such as `(a)(i)`, and attempt rules are kept. It is **read-only** (`source: 'QUESTION_PAPER'`): MS-2 returns **409 `INVALID_STATE`** ("Reopen the question paper to change it."). The faculty checks it and finalizes it. Activities, practicals and tutorials have no paper, so their structure is typed (`source: 'FACULTY'`).
- Finalizing the structure (MS-3) needs no `issues`. It completes the cycle's `marksheet` step, unlocks `marksEntry` (`nextAction` → MARKS_ENTRY) and fills the assessment's column block in the course workbook ([§14.4](#144-live-course-workbook)): its question row, max-marks row and CO rows. The backend owns the cell-level formatting of the downloadable template.

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

This is the official CO/PO attainment method, transcribed from `CO Attainment_60 ESE(TH)V0.2.xlsx` and `CO Attainment_60 ESE(PR)V0.1.xlsx`. Every constant below is a **default**: its live value comes from the coordinator's configuration ([§15.8](#158-threshold-and-target-configuration)), snapshotted into each run.

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
| Coordinator targets (§15.8) | Criteria for course attainment: ISE/ESE weights, target-marks %, level thresholds | Main · criteria |
| Assessment plan finalized (§8) | One column block per planned assessment: ISE I–III, activities / practicals / tutorials, ESE theory, POE/OE | Data |
| CAM finalized (§9) | The CO list | Main |
| CAM finalized (§9) | The CO-PO and CO-PSO correlations, the average and the course mapping | PO & PSO attainment |
| Marksheet finalized (§12) | The block's question numbers, max-marks row and CO rows (1–2 COs or "All") | Data |
| Marks submitted (MK-5) | One row per student with every question's marks; per-CO totals | Data (and CO1…COn) |
| Indirect surveys saved (ATT-9) | Course exit, examiner and additional survey scores per CO | Data · indirect block |
| Attainment run approved (ATT-11) | CO summary (overall attainment per CO) and the PO/PSO attainment row, with "as of …" | Main · summary, PO & PSO attainment |

Cells that aren't filled yet carry a `pendingReason` instead of a value. The UI shows the reason, e.g. "Waiting for ISE-2 marks".

**Only the components the subject has.** The Data sheet gets one column block per planned assessment, and the plan comes from the load distribution (§8, §15.4). A component with 0 marks produces no block and no blank columns. The CO sheets, the Main criteria and the reports follow the same plan.

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

**Status: CONFIRMED** (semester setup, faculty list, syllabus load distribution, POs/PSOs, subject allocation and acceptance: 28 Oct 2026; thresholds and targets: 25 Oct 2026) · open points **[O-25] [O-26] [O-27] [O-28]**

The coordinator prepares each semester of their department before teaching starts, then hands the subjects to the faculty. It's shown inside the Faculty portal under **Coordination** to users with the `COORDINATOR` role (§4.1). Every endpoint is limited to the coordinator's **own department**: another department's data returns **403**.

### 15.1 Semester setup

One **semester setup** per department, academic year and semester. Only semesters III to VIII are in scope; the first year has a different structure **[O-26]**. Each setup is isolated: its syllabus, allocations and declaration never affect another semester.

The coordinator works through the setup in order. The server enforces the order (**409 `STAGE_LOCKED`** with the reason), exactly like the faculty lifecycle; the UI only shows it.

| Step | What the coordinator does | Done when |
| --- | --- | --- |
| 1. Semester | Creates the setup: academic year, semester, divisions | Created |
| 2. Faculty | Adds the department's faculty by hand or from Excel (§15.3). The list belongs to the department and is reused by every semester | The department has at least one active faculty member |
| 3. Syllabus | Fills the **syllabus load distribution** (§15.4) | No blocking issues |
| 4. POs & PSOs | Fills the 11 POs and the department's 3 PSOs (§15.5) | 11 POs and 3 PSOs have statements |
| 5. Declaration | Confirms the syllabus is correct (§15.4.3) | Declared |
| 6. Allocation | Assigns every subject to a faculty member (§15.6) | Every subject and division has a faculty member |
| 7. Complete | Reviews the checks and completes the allocation; the faculty are emailed (§15.7) | Completed |

After step 7 the setup tracks acceptance: each allocation is `PENDING_ACCEPTANCE` until the faculty member accepts it (FAC-4). Faculty can still be added, and a subject reassigned (CRD-7), after completion.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| CRD-12 | GET | `/coordination/overview` | query `academicYearId?` (default current) | `CoordinatorOverview` |
| CRD-13 | POST | `/coordination/semester-setups` | `SemesterSetupCreate` | `SemesterSetup` |
| CRD-14 | GET | `/coordination/semester-setups/{setupId}` | — | `SemesterSetup` |
| CRD-15 | PATCH | `/coordination/semester-setups/{setupId}` | `{ version, divisions }` | `SemesterSetup` |

```ts
interface CoordinatorOverview {
  department: { departmentId: ID; departmentName: string };
  academicYear: { academicYearId: ID; name: string };
  facultyCount: number;                 // active faculty in the department
  outcomesComplete: boolean;            // 11 POs and the department's 3 PSOs filled
  /** Always semesters 3..8, in order; `setup` is absent until created. */
  semesters: {
    semesterNumber: number;
    setup?: SemesterSetupSummary;
  }[];
}

interface SemesterSetupSummary {
  setupId: ID;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  currentStep: SetupStepKey;            // the step to work on next
  subjects: { configured: number; assigned: number; accepted: number };
}

type SetupStepKey = 'FACULTY' | 'SYLLABUS' | 'OUTCOMES' | 'DECLARATION' | 'ALLOCATION' | 'COMPLETE';

interface SemesterSetupCreate {
  academicYearId: ID;
  semesterNumber: number;               // 3..8 → 400 otherwise; 409 SETUP_EXISTS if already created
  divisions?: string[];                 // ["A", "B"]; empty = one class without divisions
}

interface SemesterSetup {
  setupId: ID;
  version: number;
  department: { departmentId: ID; departmentName: string };
  academicYear: { academicYearId: ID; name: string };
  semesterNumber: number;
  divisions: string[];
  status: 'IN_PROGRESS' | 'COMPLETED';
  /** One entry per step, in order. The backend decides every value. */
  steps: { key: SetupStepKey; state: StepState }[];   // StepState as in §7.3
  syllabusVersion: number;              // the load distribution version in force
  createdBy: string;
  createdAt: IsoDateTime;
}
```

- Divisions can change until the allocation is completed (CRD-15); after that **409 `INVALID_STATE`**.
- Creating the setup creates no subjects; they come from the load distribution.

### 15.2 Departments and scope

The coordinator's department is set by Super Admin when granting the role (ADM-12). The departments at launch are Computer Science, Information Technology, Electronics and Computer Engineering, Mechanical and Automation, and Civil Engineering. They are ordinary records (ADM-3): adding one needs no code change.

### 15.3 Faculty list

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| CRD-1 | GET | `/coordination/faculty` | query `status?`, `search?`, `page`, `size` | `Page<FacultyMember>` |
| CRD-2 | POST | `/coordination/faculty` | `FacultyCreate` | `FacultyMember` |
| CRD-3 | PATCH | `/coordination/faculty/{userId}` | `FacultyUpdate` | `FacultyMember` |
| CRD-4 | POST | `/coordination/faculty/{userId}/resend-invite` | — | `FacultyMember` |
| CRD-16 | GET | `/coordination/faculty/import-template` | — | `.xlsx` file (§2.6) |
| CRD-17 | POST | `/coordination/faculty/import` | multipart `file` (`.xlsx`) | `FacultyImportPreview` |
| CRD-18 | POST | `/coordination/faculty/import/{importId}/commit` | — | `FacultyImportResult` |

```ts
interface FacultyMember {
  userId: ID;
  firstName: string;
  lastName: string;
  fullName: string;                     // "Rahul Patil", built by the server
  email: string;                        // college email, unique across the institution
  phone: string;                        // 10 digits, stored without spaces or +91
  departmentId: ID;
  status: 'ACTIVE' | 'INACTIVE';
  /** Credential workflow. The frontend never sees or sets passwords. */
  credentialStatus: 'NOT_INVITED' | 'INVITE_SENT' | 'ACTIVATED' | 'INVITE_EXPIRED';
  allocationCount: number;              // active allocations in the current academic year
  createdAt: IsoDateTime;
}

interface FacultyCreate {
  firstName: string;
  lastName: string;
  email: string;                        // 409 DUPLICATE_EMAIL
  phone: string;
}

type FacultyUpdate = Partial<FacultyCreate> & { status?: 'ACTIVE' | 'INACTIVE' };

interface FacultyImportPreview {
  importId: ID;                         // valid for 30 minutes
  fileName: string;
  /** Problems with the file itself, e.g. a missing column. Nothing can be imported while any exist. */
  fileErrors: string[];
  rows: {
    rowNumber: number;                  // the Excel row, so the coordinator can find it
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: 'VALID' | 'INVALID' | 'DUPLICATE_IN_FILE' | 'ALREADY_EXISTS';
    errors: { field: 'firstName' | 'lastName' | 'email' | 'phone'; message: string }[];
  }[];
  counts: { valid: number; invalid: number; duplicateInFile: number; alreadyExists: number };
}

interface FacultyImportResult {
  created: FacultyMember[];
  skipped: number;                      // every row that wasn't VALID
}
```

- **Checks, the same for the form and the import:**
  - first and last name required, at most 60 characters each;
  - email in a valid format and on one of the institution's email domains (`Institution.emailDomains`, ADM-1);
  - phone: 10 digits starting with 6–9, optionally written with `+91`, spaces or dashes;
  - email unique: **409 `DUPLICATE_EMAIL`** on the form; `DUPLICATE_IN_FILE` or `ALREADY_EXISTS` in an import.
- **The import never writes until the coordinator confirms.** CRD-17 only reads the file and returns the preview. CRD-18 creates the `VALID` rows and skips every other row; existing faculty are never overwritten. An expired or unknown `importId` returns **404**.
- **Template columns**, in this order: `First Name`, `Last Name`, `Email ID`, `Phone Number`. Column names are matched without regard to case or extra spaces. A wrong file type returns **415**, a file over 2 MB **413**, more than 500 rows **422 `PRECONDITION_FAILED`**.
- **Adding a faculty member sends no email.** Their account is created as `NOT_INVITED`; the invitation goes out with their first allocation email (§15.7). CRD-4 resends it.
- Deactivating keeps history; there's no hard delete. An inactive member can't receive new allocations (**422 `PRECONDITION_FAILED`**).

### 15.4 Syllabus load distribution

The semester's syllabus in the college's **load distribution** format: one row per course, in two sections (theory courses, then laboratory courses), with section totals and a grand total.

| Group | Course code | Name of course | L | T | P | Credits | FA: ESE | FA: OE/POE | SA: ISE | SA: ICA | Total |
| --- | --- | --- | -: | -: | -: | -: | -: | -: | -: | -: | -: |
| PCC | 23ECU7CC1T | Internet of Things (IoT) | 2 | – | – | 2 | 60 | – | 40 | – | 100 |
| PEC | 23ECU7EN*3T | Programme Elective Course IV | 3 | – | – | 3 | 60 | – | 40 | – | 100 |
| *Laboratory* | | | | | | | | | | | |
| PCC | 23ECU7CC1L | Internet of Things (IoT) Lab | – | – | 2 | 1 | – | 25 | – | 25 | 50 |

This is the **single source of truth** for every subject's assessment structure. The faculty's assessment plan (§8), lifecycle (§7.1), marksheets (§12), course workbook (§14.4) and reports are all generated from it; none of them hard-codes a component.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| CRD-19 | GET | `/coordination/semester-setups/{setupId}/load-distribution` | — | `LoadDistribution` (empty `DRAFT` if none) |
| CRD-20 | PUT | `/coordination/semester-setups/{setupId}/load-distribution` | `LoadDistributionUpdate` | `LoadDistribution` |
| CRD-21 | POST | `/coordination/semester-setups/{setupId}/load-distribution/declare` | `{ version, confirmed: true }` | `LoadDistribution` |
| CRD-22 | POST | `/coordination/semester-setups/{setupId}/load-distribution/revise` | `{ version, reason }` | `LoadDistribution` |
| CRD-23 | GET | `/coordination/course-groups` | — | `CourseGroup[]` |
| CRD-24 | POST | `/coordination/course-groups` | `{ code, name }` | `CourseGroup` |

#### 15.4.1 Types

```ts
interface LoadDistribution {
  setupId: ID;
  syllabusVersion: number;              // 1, 2… a revision (CRD-22) starts a new one
  version: number;                      // optimistic concurrency, as everywhere
  status: 'DRAFT' | 'DECLARED';
  rows: LoadRow[];                      // in display order within each section
  /** Server-computed sums: the "Total" and "Grand Total" lines of the college table. */
  totals: { theory: LoadTotals; laboratory: LoadTotals; grand: LoadTotals };
  /** Blocking problems; declaring is refused while any exist. */
  issues: { code: LoadIssueCode; message: string; rowId?: ID; field?: string }[];
  declaration?: SyllabusDeclaration;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

interface LoadRow {
  rowId?: ID;                           // absent for rows not yet saved
  section: 'THEORY' | 'LABORATORY';
  groupCode: string;                    // a CourseGroup code: "PCC", "PEC", "MDM"…
  courseCode: string;                   // as printed, placeholders allowed: "23ECU7EN*3T", "23##U7MD6T"
  courseName: string;
  hours: { lecture: number; tutorial: number; practical: number };  // per week, 0 = "--"
  credits: number;
  components: {
    ese: ComponentConfig;               // FA: ESE
    oePoe: ComponentConfig;             // FA: OE/POE
    ise: ComponentConfig;               // SA: ISE
    ica: ComponentConfig;               // SA: ICA
  };
  totalMarks: number;                   // server-computed: the four component totals added up
  /** Server-derived: PRACTICAL when the row has neither ESE nor ISE, otherwise THEORY (§7.3). */
  assessmentScheme: AssessmentScheme;
  /** For a slot such as "Programme Elective Course IV" or "Multidisciplinary Minor V". */
  options?: CourseOption[];
  /** "Research Methodology & IPR / MOOC#": students may earn the course through a MOOC instead. */
  moocAlternative?: { note?: string };
  /** False for rows that get no faculty, e.g. a MOOC-only course. Default true. */
  needsFaculty: boolean;
}

/** One column of the table. totalMarks 0 means "--": the component doesn't exist for this course. */
interface ComponentConfig {
  totalMarks: number;
  /** How the column's marks are earned. Empty when totalMarks is 0. */
  items: ComponentItem[];
}

interface ComponentItem {
  category: AssessmentCategory;         // §8; which categories a column allows is in §15.4.2
  count: number;                        // ≥ 1: "2 ISE tests", "5 activities"
  maxMarksEach: number;                 // > 0; halves allowed (2.5)
}

interface CourseOption {
  optionId?: ID;
  courseCode: string;                   // "23ECU7E23T"
  courseName: string;                   // "Network Security"
  offered: boolean;                     // runs this semester → needs a faculty member
  offeringDepartment?: string;          // MDM options: the department that teaches it [O-25]
}

interface LoadTotals {
  lecture: number; tutorial: number; practical: number; credits: number;
  ese: number; oePoe: number; ise: number; ica: number; total: number;
}

interface SyllabusDeclaration {
  syllabusVersion: number;
  statement: string;                    // the text the coordinator confirmed
  declaredBy: { userId: ID; fullName: string };
  declaredAt: IsoDateTime;
  department: { departmentId: ID; departmentName: string };
  academicYear: { academicYearId: ID; name: string };
  semesterNumber: number;
}

interface CourseGroup {
  code: string;                         // "PCC"
  name: string;                         // "Programme Core Course"
  builtIn: boolean;
}

interface LoadDistributionUpdate {
  version: number;
  rows: LoadRow[];                      // the whole table; server-computed fields are ignored
}

type LoadIssueCode =
  | 'MISSING_FIELD' | 'DUPLICATE_COURSE_CODE' | 'INVALID_HOURS' | 'INVALID_CREDITS'
  | 'NO_ASSESSMENT'                     // all four columns are "--"
  | 'COLUMN_SUM_MISMATCH'               // items don't add up to the column total
  | 'CATEGORY_NOT_ALLOWED'              // e.g. PRACTICAL in the ESE column
  | 'ITEMS_WITHOUT_MARKS'               // items in a column whose total is 0
  | 'SLOT_WITHOUT_OPTIONS' | 'NO_OFFERED_OPTION' | 'DUPLICATE_OPTION_CODE'
  | 'EMPTY_SYLLABUS';
```

Built-in course groups: `PCC` Programme Core Course, `PEC` Programme Elective Course, `MDM` Multidisciplinary Minor, `RM` Research Methodology, `OJT` Internship / OJT, `CAP` Capstone Project. CRD-24 adds others for the department (**409 `DUPLICATE_CODE`**). "Laboratory courses" is a section, not a group.

#### 15.4.2 Rules

- **Every column says how its marks are earned.** For each column with marks, the coordinator lists the items, and `count × maxMarksEach` over all items must equal the column total (`COLUMN_SUM_MISMATCH` otherwise) **[O-27]**. Examples:
  - ISE 40 = 2 ISE tests × 15 + 2 activities × 5;
  - ICA 25 = 5 tutorials × 5;
  - OE/POE 25 = 1 POE × 25;
  - ESE 60 = 1 ESE × 60.
- **Which categories each column allows:**

  | Column | Categories |
  | --- | --- |
  | ESE | `ESE` (count 1) |
  | OE/POE | one of `POE`, `OE`, `OE_POE` (count 1) |
  | ISE | `ISE`, `ACTIVITY` |
  | ICA | `ACTIVITY`, `PRACTICAL`, `TUTORIAL` |

- **A column with 0 marks doesn't exist for the course.** No assessment, lifecycle step, workbook column or report entry is generated for it. ISE 0 means no ISE, never an empty ISE.
- **Slots and options.** A row whose course is chosen from a list (electives, MDM) holds its `options`. Each option inherits the row's hours, credits and components. At least one option must be `offered` (`NO_OFFERED_OPTION`). Each offered option is a separate subject for allocation and a separate offering for the faculty.
- **MOOC alternative.** Marks the row as "/ MOOC#". It changes nothing else: the department-offered course is still allocated unless the coordinator sets `needsFaculty: false`.
- **Totals are the server's.** The frontend shows the server's `totalMarks` and `totals`; after an edit it may show a provisional sum until the save returns, labelled as unsaved.
- **Hours and credits:** L, T and P are whole numbers 0–20 per week; credits 0–20, halves allowed.

#### 15.4.3 Declaration and revisions

- **Declare (CRD-21).** Allowed when there are no issues. Records a `SyllabusDeclaration` with this statement, shown to the coordinator with a checkbox they must tick:

  > I confirm that the syllabus, assessment structure, engagement hours, credits and marks entered in this Syllabus Load Distribution are correct and correspond to the official syllabus for this semester.

  `confirmed` must be `true` (**400** otherwise). The table becomes read-only: CRD-20 returns **409 `SYLLABUS_LOCKED`**.
- **Revise (CRD-22).** Starts `syllabusVersion + 1` as a `DRAFT` copy, with the reason recorded; the previous version and its declaration stay readable for audit. Allowed until the allocation is completed. After that it returns **409 `SYLLABUS_IN_USE`**, because faculty may already be working from it **[O-28]**.
- After a revision the table is a draft again: the coordinator edits it in step 3, and the declaration must be made again. Allocations of subjects that still exist after the revision are kept; those of removed subjects are dropped.

### 15.5 POs and PSOs

The coordinator, not the faculty, owns the official outcomes:

- **11 POs, shared by all departments.** Any coordinator can edit them; a change applies to every department and is kept as a new version.
- **3 PSOs per department.** Each department's coordinator edits only their own; changing one department's PSOs never touches another's.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| CRD-25 | GET | `/coordination/program-outcomes` | — | `OutcomeSet` (`kind: 'PO'`) |
| CRD-26 | PUT | `/coordination/program-outcomes` | `OutcomeSetUpdate` | `OutcomeSet` |
| CRD-27 | GET | `/coordination/psos` | — | `OutcomeSet` (`kind: 'PSO'`, own department) |
| CRD-28 | PUT | `/coordination/psos` | `OutcomeSetUpdate` | `OutcomeSet` |
| CRD-29 | GET | `/coordination/program-outcomes/history` | query `kind` | `OutcomeSet[]` |

```ts
interface OutcomeSet {
  kind: OutcomeKind;
  departmentId?: ID;                    // PSOs only
  version: number;
  items: ProgramOutcome[];              // §3; codes PO1…PO11 or PSO1…PSO3, in order
  updatedBy: string;
  updatedAt: IsoDateTime;
}

interface OutcomeSetUpdate {
  version: number;
  items: { code: string; title?: string; statement: string }[];
}
```

- Exactly 11 POs (`PO1`…`PO11`) and exactly 3 PSOs (`PSO1`…`PSO3`) per department; codes are fixed and can't be added, removed or renamed (**400 `VALIDATION_FAILED`**). Every statement is required, up to 1,000 characters; `title` is optional ("Engineering knowledge").
- Saving creates a new version; earlier ones stay readable (CRD-29).
- **CAMs use them read-only.** A draft CAM always shows the latest version; finalizing a CAM stores the version it used, so later edits never change a finalized CAM (§9).
- Everyone signed in reads them through ACAD-9 and ACAD-10 (§6).

### 15.6 Subject allocation

After the declaration, the coordinator gives every subject a faculty member. A **subject** is a row that needs a faculty member, or one offered option of a slot row. With divisions, each subject needs one faculty member **per division**.

A faculty member can take any number of subjects, in the same semester and in other semesters. Each allocation is its own record for one setup, subject and division, so an allocation in semester III never appears in semester IV.

| # | Method | Path | Body | Response |
| --- | --- | --- | --- | --- |
| CRD-5 | GET | `/coordination/semester-setups/{setupId}/allocation-board` | — | `AllocationBoard` |
| CRD-6 | POST | `/coordination/allocations` | `AllocationCreate` | `SubjectAllocation` |
| CRD-7 | PATCH | `/coordination/allocations/{allocationId}` | `{ facultyUserId }` | `SubjectAllocation` |
| CRD-8 | DELETE | `/coordination/allocations/{allocationId}` | — | `204` |
| CRD-30 | GET | `/coordination/faculty-load` | query `academicYearId?` | `FacultyLoad[]` |
| CRD-31 | POST | `/coordination/semester-setups/{setupId}/allocation/complete` | `{ version }` | `AllocationBoard` |
| CRD-32 | POST | `/coordination/allocations/{allocationId}/remind` | — | `SubjectAllocation` |
| CRD-33 | GET | `/coordination/semester-setups/{setupId}/notifications` | — | `AllocationNotification[]` (newest first) |

```ts
interface AllocationBoard {
  setupId: ID;
  version: number;                      // the setup's version
  status: 'DRAFT' | 'COMPLETED';
  completedAt?: IsoDateTime;
  subjects: AllocatableSubject[];       // in load-distribution order
  summary: {
    subjects: number;                   // subjects × divisions
    assigned: number;
    unassigned: number;
    pendingAcceptance: number;
    accepted: number;
  };
  /** Why "Complete allocation" is refused, if it is. Empty when it can be completed. */
  blockers: { code: 'UNASSIGNED' | 'INACTIVE_FACULTY' | 'SYLLABUS_NOT_DECLARED' | 'OUTCOMES_INCOMPLETE'; message: string; subjectKey?: string }[];
}

interface AllocatableSubject {
  subjectKey: string;                   // rowId, or rowId + ":" + optionId for an option
  course: { courseCode: string; courseName: string };
  slotName?: string;                    // "Programme Elective Course IV", for an option
  section: 'THEORY' | 'LABORATORY';
  groupCode: string;
  assessmentScheme: AssessmentScheme;
  hours: { lecture: number; tutorial: number; practical: number };
  /** One entry per division (one entry with no division when the setup has none). */
  divisions: { division?: string; allocation?: SubjectAllocation }[];
}

interface SubjectAllocation {
  allocationId: ID;
  setupId: ID;
  academicYear: { academicYearId: ID; name: string };
  semesterNumber: number;
  subjectKey: string;
  course: CourseRef;                    // syllabusCourseId is created when the syllabus is declared
  division?: string;
  faculty: { userId: ID; fullName: string; email: string };
  offeringId?: ID;                      // set once the allocation is completed; what FAC-1 returns
  status: 'DRAFT' | 'PENDING_ACCEPTANCE' | 'ACCEPTED';
  notifiedAt?: IsoDateTime;
  acceptedAt?: IsoDateTime;
  createdAt: IsoDateTime;
}

interface AllocationCreate {
  setupId: ID;
  subjectKey: string;
  division?: string;                    // required when the setup has divisions
  facultyUserId: ID;
}

/** The "by faculty" view: everything a faculty member teaches this academic year. */
interface FacultyLoad {
  faculty: { userId: ID; fullName: string; email: string; status: 'ACTIVE' | 'INACTIVE' };
  allocations: {
    allocationId: ID;
    semesterNumber: number;
    courseCode: string;
    courseName: string;
    division?: string;
    hours: { lecture: number; tutorial: number; practical: number };
    status: SubjectAllocation['status'];
  }[];
  weeklyHours: number;                  // server-computed L + T + P over every allocation
}
```

- **One faculty member per subject and division.** Allocating a subject and division that already has one returns **409 `ALREADY_ALLOCATED`**; use CRD-7 to change it.
- Allocating needs a declared syllabus (**409 `STAGE_LOCKED`**) and an active faculty member (**422 `PRECONDITION_FAILED`**).
- Before completion, allocations are `DRAFT` and can be changed or deleted freely; nothing is sent.
- **Reassigning after completion (CRD-7)** moves the offering to the new faculty member, emails them (§15.7) and tells the previous one. If the previous faculty member has already finalized the assessment plan, it returns **409 `OFFERING_IN_USE`**. Deleting after completion returns **409 `INVALID_STATE`**.
- **CRD-30** lists every active faculty member of the department, including those with no allocations, so the coordinator can balance the load across semesters.

### 15.7 Completing the allocation and notifying the faculty

**Complete allocation (CRD-31)** checks the `blockers` and returns **409 `ALLOCATION_INCOMPLETE`** with them in `message` if any exist:

- the syllabus is declared and the POs and PSOs are complete;
- every subject has a faculty member for every division;
- every allocated faculty member is active.

When it succeeds, in one transaction the server:

1. creates the offerings (one per subject and division) and the `syllabusCourseId`s;
2. sets every allocation to `PENDING_ACCEPTANCE`;
3. queues **one email per faculty member** listing all their subjects in this semester;
4. marks the setup `COMPLETED`.

The email (sent by Spring Boot; delivery failures are retried and logged, and never undo the completion):

| Part | Content |
| --- | --- |
| Subject line | "Subject allocation — Semester VII, 2026-27" |
| Greeting | The faculty member's full name |
| Subjects | Each subject's name, course code and division, with the semester, academic year and department |
| Sign-in | If the account isn't activated: a **set-password link**, valid for 72 hours (`credentialStatus` becomes `INVITE_SENT`). If it is: a link to the sign-in page. **Passwords are never sent by email.** |
| Instruction | "Sign in, open Setup, and accept your allocated subjects." |
| From | The coordinator's name, sent from the institution's address |

CRD-32 resends the email for one allocation that's still `PENDING_ACCEPTANCE`.

CRD-33 lists every email sent about the semester's allocations, so the coordinator can check who was told what and whether delivery failed:

```ts
interface AllocationNotification {
  notificationId: ID;
  kind: 'ALLOCATION' | 'REASSIGNED' | 'REMOVED' | 'REMINDER';
  to: { userId: ID; fullName: string; email: string };
  subjectLine: string;
  body: string;                         // the text as sent; links shown as placeholders, never a token
  subjects: { courseCode: string; courseName: string; division?: string }[];
  includesSetPasswordLink: boolean;     // the account wasn't activated yet
  status: 'QUEUED' | 'SENT' | 'FAILED';
  createdAt: IsoDateTime;
}
```

- `ALLOCATION`: one per faculty member when the allocation is completed (CRD-31).
- `REASSIGNED` to the new faculty member and `REMOVED` to the previous one, after CRD-7 on a completed allocation.
- `REMINDER`: CRD-32.

The coordinator tracks acceptance on the allocation board: every row shows its faculty member and `PENDING_ACCEPTANCE` or `ACCEPTED`, with `notifiedAt` and `acceptedAt`.

### 15.8 Threshold and target configuration

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

**Status: CONFIRMED** · narrowed in 2.8

Super Admin provisions the institution and its people. Since 2.8 the program syllabus, courses, elective groups, offerings and POs/PSOs belong to the department coordinator ([§15](#15-coordination-coordinator-a)), and the matching admin screens are removed. Records are deactivated, never hard-deleted.

| # | Collection | Endpoints |
| --- | --- | --- |
| ADM-1 | Institution | `GET /institution` · `PUT /institution` |
| ADM-2 | Academic years | `POST /academic-years` · `PATCH /academic-years/{id}` · `POST /academic-years/{id}/make-current` |
| ADM-3 | Departments | `POST /departments` · `PATCH /departments/{id}` |
| ADM-4 | Programs | `POST /programs` · `PATCH /programs/{id}` |
| ADM-12 | Users & roles | `GET /users` · `POST /users` · `PATCH /users/{id}` · `PUT /users/{id}/roles` `{ roles: SystemRole[], primaryRole, coordinatorDepartmentId? }` |

- `coordinatorDepartmentId` is required when `roles` includes `COORDINATOR` (**400** otherwise), and one department can have several coordinators.
- ADM-5 to ADM-11 are withdrawn. Semesters, syllabus courses, electives and offerings now come from the coordinator's semester setup (§15.1, §15.4, §15.7), and POs/PSOs from §15.5. The first year, outside the coordinator's scope for now, has no screens until it's specified **[O-26]**.

```ts
interface Institution {
  institutionId: ID;
  institutionCode: string;
  institutionName: string;
  emailDomains: string[];        // "wit.edu": faculty emails must use one of these (§15.3)
  status: 'ACTIVE' | 'INACTIVE';
}
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
| 409 | `ALREADY_FINALIZED`, `INVALID_STATE`, `ASSESSMENT_IN_USE`, `DUPLICATE_*`, `ALREADY_ALLOCATED`, `SETUP_EXISTS`, `SYLLABUS_LOCKED`, `SYLLABUS_IN_USE`, `ALLOCATION_INCOMPLETE`, `OFFERING_IN_USE` | Inline explanation; confirmation dialog where relevant |
| 413 | `FILE_TOO_LARGE` | Upload error with the limit in `message` |
| 415 | `UNSUPPORTED_FILE_TYPE` | Upload error |
| 422 | `PRECONDITION_FAILED`, `REGENERATION_FAILED`, `BAD_TEMPLATE` | Inline explanation; keeps the user's work |
| 429 | `RATE_LIMITED` | Retry after `Retry-After` |
| 502/503/504 | `AI_SERVICE_UNAVAILABLE`, `UPSTREAM_TIMEOUT` | "Try again" with retry button |
| — | `AI_OUTPUT_INVALID` | Not an HTTP status: stored in `QpPaper.error` when the AI's answer fails the checks in §10.7.5; the UI offers a retry |
| 500 | `INTERNAL_ERROR` | Generic error + `traceId` for support |

`message` must always be safe to show to a user. Stack traces and internal details go in server logs only.

---

## 19. Open questions

| # | Question | Owner | Blocks |
| --- | --- | --- | --- |
| ~~O-1~~ | **Resolved in 2.8.** Units are referenced by `unitNumber` inside each offering's CAM (§9.1). The only consumer that needed a `unitId`, question generation, is removed (§11). | — | — |
| **O-2** | **Offering model.** Course Offering / Section is still TBD in Module 1. Agree that the backend issues an opaque `offeringId` per (syllabus course, academic year, division)? | A | §7–§14 |
| ~~O-3~~ | **Resolved in 2.8.** `COORDINATOR` is a system role held with `FACULTY`, scoped to one department and granted by Super Admin (§4.1, §15). The per-course `COURSE_COORDINATOR` isn't used for now (§4.2). | — | — |
| **O-4** | **Who sets thresholds and targets?** `AGENTS.md` says Coordinator; user story F-028 says Super Admin / authorized HOD. This contract follows `AGENTS.md`. | Team | §15.8 |
| ~~O-5~~ | **Resolved in 2.8.** The coordinator owns both: completing the allocation creates the offerings (§15.7). The admin offerings screen is removed (§16). | — | — |
| **O-6** | **Routing to FastAPI.** Does the frontend reach AI routes through Spring Boot or a gateway? Paths stay the same either way; CORS and auth setup differ. | A + M | deployment |
| ~~O-7~~ | **Withdrawn in 2.8.** The knowledge base is removed (§11). | — | — |
| ~~O-8~~ | **Resolved in 2.1.** Activities and practicals/tutorials are ICA items counted in the ISE phase; ESE is the theory paper and/or POE/OE (§8, from the workbooks). | — | — |
| ~~O-9~~ | **Resolved in 2.1.** A question maps to one or two COs, or to all COs for ESE theory (§12, from the workbooks). | — | — |
| **O-10** | **Bloom enum.** Contract drops the `L1_` prefix to match Module 1. Mayuri's prompts and outputs must use `REMEMBER…CREATE` too. | M | §10 |
| ~~O-11~~ | **Resolved in 2.1.** The workbook formulas are official (§14.1); every weight and threshold is in the coordinator's config (§15.8). | — | — |
| ~~O-12~~ | **Withdrawn in 2.8.** Question paper export is removed with §11. (The moderation sheet has its own Word and PDF formats, §10.7.7.) | — | — |
| **O-13** | **Polling vs push.** Polling is the v1 default. Do we want SSE for long AI jobs later? | M | §2.7 |
| ~~O-14~~ | **Resolved in 2.6.** The faculty ticks the paper's COs from the course's finalized CAM and sets the CO per question or part (§10). | — | — |
| **O-15** | **Refresh tokens.** Will the backend issue refresh tokens, or is re-login on expiry acceptable for v1? | A | §5 |
| ~~O-16~~ | **Resolved in 2.8.** One shared set of 11 POs and 3 PSOs per department, owned by the coordinator and versioned (§15.5). | — | — |
| ~~O-17~~ | **Resolved in 2.8.** 11 POs (PO1–PO11) and 3 PSOs per department (§15.5). | — | — |
| ~~O-18~~ | **Resolved in 2.4.** The CAM holds no per-CO expected percentages; attainment uses only the coordinator's targets (§15.8). | — | — |
| **O-19** | **Theory workbook threshold bug.** The theory workbook computes the ESE level with the ISE thresholds (50/60/70) instead of its own ESE thresholds (60/70/80); the practical workbook does it correctly. The contract specifies the ESE thresholds. Confirm, and fix the reference workbook so exports match. | A + Team | §14.1 |
| **O-20** | **Absentees.** The workbook divides by the full class strength, so absent students count as below target. Confirm this is the institution's rule. | Team | §13, §14.1 |
| **O-21** | **CAM scoring rubric.** No college guideline or approved sample CAM exists, so the 3 / 2 / 1 / blank meanings in §9.3 are Mayuri's proposal, marked `PROPOSED`. Does the institution or NBA guidance give official wording? Once confirmed, should the coordinator maintain it (like §15.8), or is it a fixed institutional rule? | Team | §9 |
| **O-22** | **Several sets per assessment.** The sample paper is "Set A". Does an ISE or ESE need more than one set (A, B…) validated separately, and do they share one marksheet? The contract allows one paper per assessment until decided. | Team | §10, §12 |
| ~~O-23~~ | **Resolved in 2.7.** There is no moderator role. The faculty downloads the college's moderation sheet for the hand-written moderation and confirms the paper themselves (§10). | — | — |
| **O-24** | **MCQ answer key.** The typed paper has no correct-option field, so the AI can't confirm the intended answer, only that one option is defensible. Add an optional `correctOptionKey` per MCQ? | Team + M | §10 |
| **O-25** | **MDM teaching across departments.** Multidisciplinary minor courses are taught by the offering department (e.g. IT teaches Cyber Security to ECE students). For now the student department's coordinator allocates any of their own faculty. Should the offering department's coordinator allocate MDM subjects instead? | Team | §15.6 |
| **O-26** | **First year.** Semesters I and II have a different structure and aren't in the coordinator's scope. Who sets them up, and how? | Team | §15.1, §16 |
| **O-27** | **Scaled marks.** The items in a column must add up exactly to its total (ISE 40 = 2 tests × 15 + 2 activities × 5). Are ISE tests ever scaled instead, e.g. 3 tests of 30 marks scaled to 40? If so, items need a "scaled to" value. | Team | §15.4, §14.1 |
| **O-28** | **Mid-semester corrections.** Once the allocation is completed, the load distribution can't change. How is a mistake found mid-semester (e.g. a wrong ICA total) corrected? | Team | §15.4.3 |

---

## 20. Changes

### 2.7 → 2.8 (28 Oct 2026)

| Area | Change | Why |
| --- | --- | --- |
| §15 Coordination | Rewritten as the coordinator's **semester setup**: semester (CRD-12…15), faculty list with Excel import (CRD-1…4, 16…18), syllabus load distribution with declaration and revisions (CRD-19…24), POs/PSOs (CRD-25…29), allocation (CRD-5…8, 30) and completion with the faculty email (CRD-31 to 33). Thresholds move to §15.8 (CRD-9…11 unchanged) | Coordinator lifecycle confirmed by Rohan |
| §15.3 Faculty | `FacultyMember` has first name, last name, email and phone; `facultyCode` dropped; adding a member sends no email (the invitation goes with the allocation email) | Fields the coordinator collects |
| §15.6 Allocation | One faculty member per subject and division; `assignmentRole`, `isPrimary`, `batch` and the end action removed; `PRIMARY_ALREADY_ASSIGNED` replaced by `ALREADY_ALLOCATED` | Simpler model; a faculty member can still take any number of subjects across semesters |
| §4 Roles | `COORDINATOR` scoped to one department, granted via ADM-12 `coordinatorDepartmentId` | O-3 resolved |
| §6 Academic structure | ACAD-9 is the shared 11 POs, new ACAD-10 the department's 3 PSOs; semesters III–VIII and their courses come from the declared load distribution | POs/PSOs belong to the coordinator |
| §7 Workspace | Step 1 is **Accept allocation** (FAC-4, key still `SUBJECT_SELECTION`); `FacultyOffering.allocation`; cycles only for components the subject has | Faculty accept their allocation |
| §8 Assessment plan | Generated by the server from the load distribution row; the faculty sets only order, dates and activity types; `coIds` read-only | One source of truth for the assessment structure |
| §9 CAM | POs/PSOs read-only from the coordinator, `outcomeVersions` on finalize; activity, practical and tutorial items generated from the plan | Faculty don't define official outcomes |
| §11 | Knowledge base, question generation, question bank and paper export removed | Removed from scope by Rohan |
| §14.4 Workbook | No blocks or blank columns for components a subject doesn't have | Dynamic workbook |
| §16 Super Admin | ADM-5…11 withdrawn; `Institution.emailDomains`; ADM-12 `coordinatorDepartmentId` | Syllabus and outcomes moved to the coordinator |
| §18 | `ALREADY_ALLOCATED`, `SETUP_EXISTS`, `SYLLABUS_LOCKED`, `SYLLABUS_IN_USE`, `ALLOCATION_INCOMPLETE`, `OFFERING_IN_USE` | New coordinator states |
| §19 | O-1, O-3, O-5, O-16, O-17 resolved; O-7, O-12 withdrawn; O-25…O-28 added | — |

### 2.6 → 2.7 (28 Oct 2026)

| Area | Change | Why |
| --- | --- | --- |
| §4.2 Roles | `MODERATOR` removed from `CourseAssignmentRole` | No moderator role (confirmed by Rohan) |
| §10 Paper validation | "Send to moderator" replaced by **Confirm paper** (QPV-6 `…/finalize`, status `FINALIZED`) and **Reopen** (QPV-8) while the marksheet isn't finalized; `ModeratorSubmission` and the `moderation` field removed; `finalizedAt` added | The faculty confirms their own paper |
| §10 Paper validation | QPV-5 is now the college's **moderation sheet** (DOCX or PDF, ISE only), replacing the AI review PDF; spec in §10.7.7 | The college moderates by hand on its own form |
| §12 Marksheet | Generated from the confirmed paper and read-only (`source: 'QUESTION_PAPER'`); MS-3 completes the step, unlocks marks entry and fills the workbook block | Paper, marksheet and workbook stay consistent |
| §10.7 | Numbering: moderation sheet 10.7.7, AI endpoint 10.7.8, tests 10.7.9 | — |
| §19 | O-23 resolved | — |

### 2.5 → 2.6 (28 Oct 2026)

| Area | Change | Why |
| --- | --- | --- |
| §10 Paper validation | Rewritten around a **typed paper**: `QpPaper` with header, selected CAM COs, questions → optional parts → sub-questions (text, MCQ options, marks, expected Bloom level). CO per question or part. Endpoints keyed by assessment (QPV-1 … QPV-7). File upload, extraction, `EXTRACTING`/`AWAITING_CONFIGURATION` states and `QpValidationConfiguration` removed | Faculty type the questions, so no parsing step (confirmed by Rohan) |
| §10 Paper validation | Backend `issues` block validation until they're fixed; the total (attempt rules applied) must equal the maximum marks | Catch paper mistakes before the AI runs |
| §10 Paper validation | Results per sub-question, with `mcqCheck` for MCQs, plus CO coverage and Bloom distribution | Matches the typed structure |
| §10.6 | Internal `QpValidationContext` for Mayuri's pipeline | Structured input instead of a document |
| §12 Marksheet | Pre-filled from the validated paper when it's sent to the moderator | The faculty types the paper once |
| §10.7 | New **backend requirements**: `questionPapers` and `qpValidationResults` storage, endpoint behaviour per status, the paper checks with their limits, the analysis job, deterministic scores (weights an ASSUMPTION), the QPV-6 transaction and marksheet mapping, the internal FastAPI endpoint `POST /question-paper/validate` with `QpAiAnalysis`, and the tests to write | Abhijeet and Mayuri can build the feature from the contract |
| §10.5, §18 | `maxMarks` always from the plan; `ALREADY_FINALIZED` after sending; `AI_OUTPUT_INVALID` stored on failed analyses | Matches §10.7 |
| §19 | O-14 resolved; O-22 (several sets per assessment), O-23 (moderator workflow) and O-24 (MCQ answer key) added | — |

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
