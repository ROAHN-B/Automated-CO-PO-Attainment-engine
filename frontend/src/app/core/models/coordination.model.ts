/**
 * ============================================================================
 *  coordination.model.ts  —  API_CONTRACT.md v2.8 §15 (coordinator)  [A]
 * ============================================================================
 *  The department coordinator's semester setup: faculty list, syllabus load
 *  distribution and its declaration, POs/PSOs, subject allocation and the
 *  faculty's acceptance. Every derived value (step states, totals, issues,
 *  counts) comes from the backend; screens only display it.
 * ============================================================================
 */
import { ID, IsoDateTime } from './common.model';
import { AssessmentCategory, AssessmentScheme, CourseRef, OutcomeKind, StepState } from './faculty-workspace.model';

/* ------------------------------ §15.1 Semester setup ------------------------------ */

/** The steps after creation, in order. The UI shows "Semester" (creation) before them. */
export type SetupStepKey = 'FACULTY' | 'SYLLABUS' | 'OUTCOMES' | 'DECLARATION' | 'ALLOCATION' | 'COMPLETE';

export interface SemesterSetupSummary {
  setupId: ID;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  /** The step to work on next. */
  currentStep: SetupStepKey;
  subjects: { configured: number; assigned: number; accepted: number };
}

export interface CoordinatorOverview {
  department: { departmentId: ID; departmentName: string };
  academicYear: { academicYearId: ID; name: string };
  /** Active faculty in the department. */
  facultyCount: number;
  /** 11 POs and the department's 3 PSOs filled. */
  outcomesComplete: boolean;
  /** Always semesters 3..8, in order; `setup` is absent until created. */
  semesters: { semesterNumber: number; setup?: SemesterSetupSummary }[];
}

export interface SemesterSetupCreate {
  academicYearId: ID;
  /** 3..8 */
  semesterNumber: number;
  /** ["A", "B"]; empty = one class without divisions. */
  divisions?: string[];
}

export interface SemesterSetup {
  setupId: ID;
  version: number;
  department: { departmentId: ID; departmentName: string };
  academicYear: { academicYearId: ID; name: string };
  semesterNumber: number;
  divisions: string[];
  status: 'IN_PROGRESS' | 'COMPLETED';
  /** One entry per step, in order. The backend decides every value. */
  steps: { key: SetupStepKey; state: StepState }[];
  /** The load distribution version in force. */
  syllabusVersion: number;
  createdBy: string;
  createdAt: IsoDateTime;
}

export interface SemesterSetupUpdate {
  version: number;
  divisions: string[];
}

/** Academic years the coordinator can pick from (ACAD-1). */
export interface AcademicYearOption {
  academicYearId: ID;
  name: string;
  isCurrent: boolean;
}

/* ------------------------------ §15.3 Faculty list ------------------------------ */

export type CredentialStatus = 'NOT_INVITED' | 'INVITE_SENT' | 'ACTIVATED' | 'INVITE_EXPIRED';

export interface FacultyMember {
  userId: ID;
  firstName: string;
  lastName: string;
  fullName: string;
  /** College email, unique across the institution. */
  email: string;
  /** 10 digits, stored without spaces or +91. */
  phone: string;
  departmentId: ID;
  status: 'ACTIVE' | 'INACTIVE';
  credentialStatus: CredentialStatus;
  /** Active allocations in the current academic year. */
  allocationCount: number;
  createdAt: IsoDateTime;
}

export interface FacultyCreate {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export type FacultyUpdate = Partial<FacultyCreate> & { status?: 'ACTIVE' | 'INACTIVE' };

export type FacultyField = 'firstName' | 'lastName' | 'email' | 'phone';

/** The import template's columns, in order (CRD-16). Matched without regard to case or extra spaces. */
export const FACULTY_IMPORT_COLUMNS = ['First Name', 'Last Name', 'Email ID', 'Phone Number'] as const;

export interface FacultyImportRow {
  /** The Excel row, so the coordinator can find it. */
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'VALID' | 'INVALID' | 'DUPLICATE_IN_FILE' | 'ALREADY_EXISTS';
  errors: { field: FacultyField; message: string }[];
}

export interface FacultyImportPreview {
  /** Valid for 30 minutes. */
  importId: ID;
  fileName: string;
  /** Problems with the file itself, e.g. a missing column. Nothing can be imported while any exist. */
  fileErrors: string[];
  rows: FacultyImportRow[];
  counts: { valid: number; invalid: number; duplicateInFile: number; alreadyExists: number };
}

export interface FacultyImportResult {
  created: FacultyMember[];
  /** Every row that wasn't VALID. */
  skipped: number;
}

/* -------------------------- §15.4 Syllabus load distribution -------------------------- */

/** The four mark columns of the college table, in its order: FA (ESE, OE/POE) then SA (ISE, ICA). */
export type ComponentKey = 'ese' | 'oePoe' | 'ise' | 'ica';
export const COMPONENT_KEYS: ComponentKey[] = ['ese', 'oePoe', 'ise', 'ica'];

/** Which categories each column allows (§15.4.2). ESE and OE/POE hold a single item with count 1. */
export const COMPONENT_CATEGORIES: Record<ComponentKey, AssessmentCategory[]> = {
  ese: ['ESE'],
  oePoe: ['POE', 'OE', 'OE_POE'],
  ise: ['ISE', 'ACTIVITY'],
  ica: ['ACTIVITY', 'PRACTICAL', 'TUTORIAL'],
};

/** The statement the coordinator confirms (§15.4.3). */
export const DECLARATION_STATEMENT =
  'I confirm that the syllabus, assessment structure, engagement hours, credits and marks entered in this Syllabus '
  + 'Load Distribution are correct and correspond to the official syllabus for this semester.';

/** One column of the college table. totalMarks 0 means "--": the component doesn't exist. */
export interface ComponentConfig {
  totalMarks: number;
  /** How the column's marks are earned. Empty when totalMarks is 0. */
  items: ComponentItem[];
}

export interface ComponentItem {
  category: AssessmentCategory;
  /** ≥ 1: "2 ISE tests", "5 activities". */
  count: number;
  /** > 0; halves allowed. */
  maxMarksEach: number;
}

export interface CourseOption {
  optionId?: ID;
  courseCode: string;
  courseName: string;
  /** Runs this semester → needs a faculty member. */
  offered: boolean;
  /** MDM options: the department that teaches it [O-25]. */
  offeringDepartment?: string;
}

export interface LoadRow {
  rowId?: ID;
  section: 'THEORY' | 'LABORATORY';
  /** A CourseGroup code: "PCC", "PEC", "MDM"… */
  groupCode: string;
  /** As printed; placeholders allowed: "23ECU7EN*3T", "23##U7MD6T". */
  courseCode: string;
  courseName: string;
  /** Per week; 0 = "--". */
  hours: { lecture: number; tutorial: number; practical: number };
  credits: number;
  components: {
    ese: ComponentConfig;
    oePoe: ComponentConfig;
    ise: ComponentConfig;
    ica: ComponentConfig;
  };
  /** Server-computed. */
  totalMarks: number;
  /** Server-derived: PRACTICAL when the row has neither ESE nor ISE. */
  assessmentScheme: AssessmentScheme;
  /** Electives and MDM slots. */
  options?: CourseOption[];
  /** "/ MOOC#". */
  moocAlternative?: { note?: string };
  needsFaculty: boolean;
}

export interface LoadTotals {
  lecture: number; tutorial: number; practical: number; credits: number;
  ese: number; oePoe: number; ise: number; ica: number; total: number;
}

export type LoadIssueCode =
  | 'MISSING_FIELD' | 'DUPLICATE_COURSE_CODE' | 'INVALID_HOURS' | 'INVALID_CREDITS'
  | 'NO_ASSESSMENT' | 'COLUMN_SUM_MISMATCH' | 'CATEGORY_NOT_ALLOWED' | 'ITEMS_WITHOUT_MARKS'
  | 'SLOT_WITHOUT_OPTIONS' | 'NO_OFFERED_OPTION' | 'DUPLICATE_OPTION_CODE'
  | 'EMPTY_SYLLABUS';

export interface LoadIssue {
  code: LoadIssueCode;
  message: string;
  rowId?: ID;
  field?: string;
}

export interface SyllabusDeclaration {
  syllabusVersion: number;
  statement: string;
  declaredBy: { userId: ID; fullName: string };
  declaredAt: IsoDateTime;
  department: { departmentId: ID; departmentName: string };
  academicYear: { academicYearId: ID; name: string };
  semesterNumber: number;
}

export interface LoadDistribution {
  setupId: ID;
  syllabusVersion: number;
  version: number;
  status: 'DRAFT' | 'DECLARED';
  rows: LoadRow[];
  totals: { theory: LoadTotals; laboratory: LoadTotals; grand: LoadTotals };
  issues: LoadIssue[];
  declaration?: SyllabusDeclaration;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

export interface LoadDistributionUpdate {
  version: number;
  rows: LoadRow[];
}

export interface CourseGroup {
  code: string;
  name: string;
  builtIn: boolean;
}

/* ------------------------------ §15.5 POs and PSOs ------------------------------ */

export interface OutcomeItem {
  outcomeId: ID;
  kind: OutcomeKind;
  code: string;
  title?: string;
  statement: string;
}

export interface OutcomeSet {
  kind: OutcomeKind;
  /** PSOs only. */
  departmentId?: ID;
  version: number;
  items: OutcomeItem[];
  updatedBy: string;
  updatedAt: IsoDateTime;
}

export interface OutcomeSetUpdate {
  version: number;
  items: { code: string; title?: string; statement: string }[];
}

/* ------------------------------ §15.6 Subject allocation ------------------------------ */

export type AllocationStatus = 'DRAFT' | 'PENDING_ACCEPTANCE' | 'ACCEPTED';

export interface SubjectAllocation {
  allocationId: ID;
  setupId: ID;
  academicYear: { academicYearId: ID; name: string };
  semesterNumber: number;
  subjectKey: string;
  course: CourseRef;
  division?: string;
  faculty: { userId: ID; fullName: string; email: string };
  /** Set once the allocation is completed. */
  offeringId?: ID;
  status: AllocationStatus;
  notifiedAt?: IsoDateTime;
  acceptedAt?: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface AllocatableSubject {
  /** rowId, or rowId + ":" + optionId for an option. */
  subjectKey: string;
  course: { courseCode: string; courseName: string };
  slotName?: string;
  section: 'THEORY' | 'LABORATORY';
  groupCode: string;
  assessmentScheme: AssessmentScheme;
  hours: { lecture: number; tutorial: number; practical: number };
  /** One entry per division (one entry with no division when the setup has none). */
  divisions: { division?: string; allocation?: SubjectAllocation }[];
}

export type AllocationBlockerCode = 'UNASSIGNED' | 'INACTIVE_FACULTY' | 'SYLLABUS_NOT_DECLARED' | 'OUTCOMES_INCOMPLETE';

export interface AllocationBoard {
  setupId: ID;
  version: number;
  status: 'DRAFT' | 'COMPLETED';
  completedAt?: IsoDateTime;
  subjects: AllocatableSubject[];
  summary: { subjects: number; assigned: number; unassigned: number; pendingAcceptance: number; accepted: number };
  blockers: { code: AllocationBlockerCode; message: string; subjectKey?: string }[];
}

export interface AllocationCreate {
  setupId: ID;
  subjectKey: string;
  division?: string;
  facultyUserId: ID;
}

/** The "by faculty" view: everything a faculty member teaches this academic year. */
export interface FacultyLoad {
  faculty: { userId: ID; fullName: string; email: string; status: 'ACTIVE' | 'INACTIVE' };
  allocations: {
    allocationId: ID;
    semesterNumber: number;
    courseCode: string;
    courseName: string;
    division?: string;
    hours: { lecture: number; tutorial: number; practical: number };
    status: AllocationStatus;
  }[];
  /** Server-computed L + T + P over every allocation. */
  weeklyHours: number;
}

/* ------------------------------ §15.7 Notifications ------------------------------ */

/** One email the server sent (or is sending) about allocations, as the coordinator can review it (CRD-33). */
export interface AllocationNotification {
  notificationId: ID;
  kind: 'ALLOCATION' | 'REASSIGNED' | 'REMOVED' | 'REMINDER';
  to: { userId: ID; fullName: string; email: string };
  subjectLine: string;
  /** The text as sent. Links appear as placeholders; the server never shows a token. */
  body: string;
  subjects: { courseCode: string; courseName: string; division?: string }[];
  /** True when it carried a set-password link (account not activated yet). */
  includesSetPasswordLink: boolean;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  createdAt: IsoDateTime;
}
