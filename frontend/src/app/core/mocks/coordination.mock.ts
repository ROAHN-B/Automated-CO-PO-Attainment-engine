/**
 * In-memory stand-in for the coordinator endpoints (API_CONTRACT v2.8 §15).
 * It applies the same rules the backend must: the setup steps unlock in order,
 * one setup per department + academic year + semester (III–VIII), divisions are
 * validated, and every count and step state is derived here, never in a screen.
 */
import { ExportFile, Page } from '../models/common.model';
import {
  AcademicYearOption, AllocatableSubject, AllocationBoard, AllocationCreate, AllocationNotification, CoordinatorOverview,
  CourseGroup, FacultyLoad, DECLARATION_STATEMENT, FACULTY_IMPORT_COLUMNS as IMPORT_COLUMNS,
  FacultyCreate, FacultyField, FacultyImportPreview, FacultyImportResult, FacultyImportRow, FacultyMember, FacultyUpdate,
  LoadDistribution, LoadDistributionUpdate, LoadRow, OutcomeSet, OutcomeSetUpdate, SemesterSetup,
  SemesterSetupCreate, SemesterSetupSummary, SemesterSetupUpdate, SetupStepKey, SubjectAllocation, SyllabusDeclaration,
} from '../models/coordination.model';
import { OutcomeKind, StepState } from '../models/faculty-workspace.model';
import { ECE_PSOS, semesterFiveRows, semesterSevenRows } from './coordination.seed';
import { BUILT_IN_GROUPS, deriveRow, loadIssues, loadTotals } from './load-distribution.rules';
import { MockError } from './mock-error';
import { writeXlsx } from './xlsx-lite';

export const SETUP_SEMESTERS = [3, 4, 5, 6, 7, 8];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const roman = (n: number) => ROMAN[n] ?? String(n);

/** The signed-in coordinator (mock session). */
export const MOCK_COORDINATOR = { userId: 'user-crd-001', fullName: 'Sneha Kulkarni' };

const DEPARTMENT = { departmentId: 'dep-ece', departmentName: 'Electronics and Computer Engineering' };

const YEARS: AcademicYearOption[] = [
  { academicYearId: 'ay-2025-26', name: '2025-26', isCurrent: false },
  { academicYearId: 'ay-2026-27', name: '2026-27', isCurrent: true },
];

/** Internal record: what the backend stores for one setup. */
interface SetupRecord {
  setupId: string;
  version: number;
  academicYearId: string;
  semesterNumber: number;
  divisions: string[];
  createdBy: string;
  createdAt: string;
  load: LoadDistribution;
  /** Earlier syllabus versions and why they were revised (audit; §15.4.3). */
  history: { syllabusVersion: number; declaration?: SyllabusDeclaration; revisedBecause: string }[];
  allocations: SubjectAllocation[];
  /** Emails sent about this semester's allocations (CRD-33). */
  notifications: AllocationNotification[];
  completedAt?: string;
}

/** A subject that needs a faculty member, as the server derives it from the load distribution. */
interface SubjectInfo {
  subjectKey: string;
  syllabusCourseId: string;
  course: { courseCode: string; courseName: string };
  slotName?: string;
  section: LoadRow['section'];
  groupCode: string;
  assessmentScheme: LoadRow['assessmentScheme'];
  hours: LoadRow['hours'];
}

const now = () => new Date().toISOString();

const BUILT_IN_CODES = BUILT_IN_GROUPS.map(g => g.code);

function emptyLoad(setupId: string): LoadDistribution {
  return {
    setupId, syllabusVersion: 1, version: 1, status: 'DRAFT', rows: [],
    totals: loadTotals([]), issues: loadIssues([], BUILT_IN_CODES), updatedAt: now(), updatedBy: MOCK_COORDINATOR.fullName,
  };
}

/** Subjects that need a faculty member: rows that need one, or each offered option of a slot. */
export function subjectCount(rows: LoadRow[]): number {
  return rows
    .filter(r => r.needsFaculty)
    .reduce((n, r) => n + (r.options?.length ? r.options.filter(o => o.offered).length : 1), 0);
}

/** "A, b ,C" → ["A", "B", "C"]; throws 400 on anything the contract rejects. */
export function normaliseDivisions(divisions: string[] | undefined): string[] {
  const list = (divisions ?? []).map(d => d.trim().toUpperCase()).filter(Boolean);
  if (list.some(d => !/^[A-Z0-9]{1,3}$/.test(d))) {
    throw new MockError(400, 'VALIDATION_FAILED', 'A division is 1 to 3 letters or digits, e.g. A or B2.');
  }
  if (new Set(list).size !== list.length) throw new MockError(400, 'VALIDATION_FAILED', 'Each division can appear only once.');
  if (list.length > 8) throw new MockError(400, 'VALIDATION_FAILED', 'A semester can have at most 8 divisions.');
  return list;
}

/* -------------------------------- faculty rules (§15.3) -------------------------------- */

/** `Institution.emailDomains` (ADM-1). */
export const EMAIL_DOMAINS = ['wit.edu'];
const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** "+91 98765-43210" → "9876543210"; null if it isn't a 10-digit Indian mobile number. */
export function normalisePhone(raw: string): string | null {
  let d = (raw ?? '').replace(/[\s\-().]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** The same checks for the form and for every imported row. */
export function facultyErrors(f: FacultyCreate): { field: FacultyField; message: string }[] {
  const errors: { field: FacultyField; message: string }[] = [];
  for (const [field, label] of [['firstName', 'First name'], ['lastName', 'Last name']] as const) {
    const v = (f[field] ?? '').trim();
    if (!v) errors.push({ field, message: `${label} is required.` });
    else if (v.length > 60) errors.push({ field, message: `${label} can be at most 60 characters.` });
  }
  const email = (f.email ?? '').trim().toLowerCase();
  if (!email) errors.push({ field: 'email', message: 'Email is required.' });
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push({ field: 'email', message: 'This isn\'t a valid email address.' });
  else if (!EMAIL_DOMAINS.includes(email.split('@')[1])) {
    errors.push({ field: 'email', message: `Use a college email ending in ${EMAIL_DOMAINS.map(d => '@' + d).join(' or ')}.` });
  }
  if (!(f.phone ?? '').trim()) errors.push({ field: 'phone', message: 'Phone number is required.' });
  else if (!normalisePhone(f.phone)) errors.push({ field: 'phone', message: 'Enter a 10-digit mobile number, e.g. 98765 43210.' });
  return errors;
}

const normaliseHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');

function seedFaculty(): FacultyMember[] {
  const people: [string, string, string, FacultyMember['credentialStatus']][] = [
    ['Sneha', 'Kulkarni', 'coordinator@wit.edu', 'ACTIVATED'],
    ['Rohan', 'Belsare', 'faculty@wit.edu', 'ACTIVATED'],
    ['Amit', 'Patil', 'amit.patil@wit.edu', 'ACTIVATED'],
    ['Priya', 'Deshpande', 'priya.deshpande@wit.edu', 'ACTIVATED'],
    ['Rahul', 'Joshi', 'rahul.joshi@wit.edu', 'NOT_INVITED'],
    ['Kavita', 'Shinde', 'kavita.shinde@wit.edu', 'NOT_INVITED'],
    ['Suresh', 'Jadhav', 'suresh.jadhav@wit.edu', 'NOT_INVITED'],
    ['Vikram', 'Pawar', 'vikram.pawar@wit.edu', 'NOT_INVITED'],
    ['Neha', 'Bhosale', 'neha.bhosale@wit.edu', 'NOT_INVITED'],
    ['Anand', 'Kale', 'anand.kale@wit.edu', 'NOT_INVITED'],
  ];
  return people.map(([firstName, lastName, email, credentialStatus], i) => ({
    userId: `fac-${String(i + 1).padStart(3, '0')}`,
    firstName, lastName, fullName: `${firstName} ${lastName}`, email,
    phone: `90000000${String(i + 1).padStart(2, '0')}`,
    departmentId: DEPARTMENT.departmentId, status: 'ACTIVE', credentialStatus,
    allocationCount: 0, createdAt: '2026-06-15T09:00:00Z',
  }));
}

const PO_SEED: [string, string, string][] = [
  ['PO1', 'Engineering knowledge', 'Apply knowledge of mathematics, natural science, computing, engineering fundamentals and an engineering specialization to develop solutions to complex engineering problems.'],
  ['PO2', 'Problem analysis', 'Identify, formulate, review research literature and analyse complex engineering problems, reaching substantiated conclusions.'],
  ['PO3', 'Design/development of solutions', 'Design creative solutions for complex engineering problems and design or develop systems, components or processes to meet identified needs.'],
  ['PO4', 'Conduct investigations of complex problems', 'Conduct investigations of complex engineering problems using research-based knowledge and methods, including design of experiments and analysis of data.'],
  ['PO5', 'Engineering tool usage', 'Create, select and apply appropriate techniques, resources and modern engineering and IT tools, recognising their limitations.'],
  ['PO6', 'The engineer and the world', 'Analyse and evaluate societal and environmental aspects while solving complex engineering problems, including their impact on sustainability.'],
  ['PO7', 'Ethics', 'Apply ethical principles and commit to professional ethics, human values, diversity and inclusion, and the norms of engineering practice.'],
  ['PO8', 'Individual and collaborative team work', 'Function effectively as an individual, and as a member or leader in diverse and multidisciplinary teams.'],
  ['PO9', 'Communication', 'Communicate effectively and inclusively within the engineering community and with society at large.'],
  ['PO10', 'Project management and finance', 'Apply knowledge and understanding of engineering management principles and economic decision-making to one\'s own work, as a member or leader in a team.'],
  ['PO11', 'Life-long learning', 'Recognise the need for, and have the preparation and ability for, independent and life-long learning in the broadest context of technological change.'],
];

export class CoordinationMockStore {
  private readonly faculty = seedFaculty();
  private readonly setups: SetupRecord[] = [];
  private pos: OutcomeSet = {
    kind: 'PO', version: 1, updatedBy: 'Sneha Kulkarni', updatedAt: '2026-06-15T09:00:00Z',
    items: PO_SEED.map(([code, title, statement]) => ({ outcomeId: `po-${code}`, kind: 'PO', code, title, statement })),
  };
  /** The department's PSOs: not filled yet in the demo. */
  private psos: OutcomeSet = {
    kind: 'PSO', departmentId: DEPARTMENT.departmentId, version: 1, updatedBy: 'Sneha Kulkarni', updatedAt: '2026-06-15T09:00:00Z',
    items: [1, 2, 3].map(n => ({ outcomeId: `pso-ece-${n}`, kind: 'PSO', code: `PSO${n}`, statement: '' })),
  };
  /** Earlier versions of the POs and of the PSOs (CRD-29). */
  private readonly outcomeHistory: OutcomeSet[] = [];
  /** Groups the department added (CRD-24). */
  private readonly customGroups: CourseGroup[] = [];
  private seq = 0;
  private readonly imports = new Map<string, { preview: FacultyImportPreview; expiresAt: number }>();

  /**
   * `demoHistory` adds what the department did before the demo starts: its PSOs and
   * a completed Semester V (two of Rohan Belsare's subjects await his acceptance).
   * Tests that need a blank department pass `false`.
   */
  constructor(opts: { demoHistory?: boolean } = {}) {
    if (opts.demoHistory ?? true) this.seedHistory();
    // The odd term of 2026-27 is under way: Semester VII was created in June and its
    // load distribution is typed in (a draft, not yet declared).
    const sem7 = this.newRecord('ay-2026-27', 7, [], '2026-06-16T10:30:00Z');
    this.applyRows(sem7, semesterSevenRows().map(r => ({ ...r, needsFaculty: r.needsFaculty ?? true }) as LoadRow));
    sem7.load.updatedAt = '2026-06-18T12:00:00Z';
    this.setups.push(sem7);
  }

  /** Runs the real rules, so the seeded history is exactly what the screens would have produced. */
  private seedHistory(): void {
    this.saveOutcomes('PSO', { version: this.psos.version, items: ECE_PSOS.map(([title, statement], i) => ({ code: `PSO${i + 1}`, title, statement })) });
    const sem5 = this.newRecord('ay-2026-27', 5, [], '2026-06-10T09:00:00Z');
    this.setups.push(sem5);
    this.applyRows(sem5, semesterFiveRows().map(r => ({ ...r, needsFaculty: true }) as LoadRow));
    this.declare(sem5.setupId, { version: sem5.load.version, confirmed: true });
    const [dsp, micro, dspLab, microLab] = this.subjectsOf(sem5);
    const give = (s: SubjectInfo, userId: string) => this.createAllocation({ setupId: sem5.setupId, subjectKey: s.subjectKey, facultyUserId: userId });
    give(dsp, 'fac-002');        // Rohan Belsare
    give(dspLab, 'fac-002');
    const a = give(micro, 'fac-004');    // Priya Deshpande
    const b = give(microLab, 'fac-003'); // Amit Patil
    this.completeAllocation(sem5.setupId, { version: sem5.version });
    this.acceptAllocation(a.allocationId);
    this.acceptAllocation(b.allocationId);
  }

  /* ---------------------------------- reads ---------------------------------- */

  /** ACAD-1 (the years the coordinator can pick from). */
  academicYears(): AcademicYearOption[] {
    return YEARS.map(y => ({ ...y }));
  }

  /** CRD-12 */
  overview(academicYearId?: string): CoordinatorOverview {
    const year = this.year(academicYearId ?? YEARS.find(y => y.isCurrent)!.academicYearId);
    return {
      department: { ...DEPARTMENT },
      academicYear: { academicYearId: year.academicYearId, name: year.name },
      facultyCount: this.activeFaculty(),
      outcomesComplete: this.outcomesComplete(),
      semesters: SETUP_SEMESTERS.map(semesterNumber => {
        const rec = this.setups.find(s => s.academicYearId === year.academicYearId && s.semesterNumber === semesterNumber);
        return rec ? { semesterNumber, setup: this.summary(rec) } : { semesterNumber };
      }),
    };
  }

  /** CRD-14 */
  setup(setupId: string): SemesterSetup {
    return this.view(this.record(setupId));
  }

  /* ---------------------------------- writes ---------------------------------- */

  /** CRD-13 */
  createSetup(body: SemesterSetupCreate): SemesterSetup {
    const year = this.year(body.academicYearId);
    if (!Number.isInteger(body.semesterNumber) || !SETUP_SEMESTERS.includes(body.semesterNumber)) {
      throw new MockError(400, 'VALIDATION_FAILED', 'Choose a semester from III to VIII. The first year is set up separately.');
    }
    if (this.setups.some(s => s.academicYearId === year.academicYearId && s.semesterNumber === body.semesterNumber)) {
      throw new MockError(409, 'SETUP_EXISTS', `Semester ${roman(body.semesterNumber)} of ${year.name} is already set up.`);
    }
    const rec = this.newRecord(year.academicYearId, body.semesterNumber, normaliseDivisions(body.divisions), now());
    this.setups.push(rec);
    return this.view(rec);
  }

  /** CRD-15 */
  updateSetup(setupId: string, body: SemesterSetupUpdate): SemesterSetup {
    const rec = this.record(setupId);
    if (body.version !== rec.version) {
      throw new MockError(409, 'VERSION_CONFLICT', 'Someone else changed this semester. Reload to see their changes.');
    }
    if (rec.completedAt) {
      throw new MockError(409, 'INVALID_STATE', 'Divisions can\'t change after the allocation is completed.');
    }
    const divisions = normaliseDivisions(body.divisions);
    // Draft allocations of a division that no longer exists are dropped.
    rec.allocations = rec.allocations.filter(a => divisions.length ? divisions.includes(a.division ?? '') : !a.division);
    rec.divisions = divisions;
    rec.version++;
    return this.view(rec);
  }

  /* ---------------------------------- faculty (§15.3) ---------------------------------- */

  /** CRD-1 */
  facultyList(q: { status?: 'ACTIVE' | 'INACTIVE'; search?: string; page?: number; size?: number } = {}): Page<FacultyMember> {
    const term = (q.search ?? '').trim().toLowerCase();
    const all = this.faculty
      .filter(f => !q.status || f.status === q.status)
      .filter(f => !term || f.fullName.toLowerCase().includes(term) || f.email.includes(term))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
      .map(f => this.member(f));
    const size = Math.max(1, q.size ?? 20);
    const page = Math.max(0, q.page ?? 0);
    return {
      content: all.slice(page * size, page * size + size),
      page, size, totalElements: all.length, totalPages: Math.max(1, Math.ceil(all.length / size)),
    };
  }

  /** CRD-2 */
  createFaculty(body: FacultyCreate): FacultyMember {
    this.assertValid(body);
    const f: FacultyMember = {
      userId: `fac-${String(this.faculty.length + 1).padStart(3, '0')}-${++this.seq}`,
      firstName: body.firstName.trim(), lastName: body.lastName.trim(),
      fullName: `${body.firstName.trim()} ${body.lastName.trim()}`,
      email: body.email.trim().toLowerCase(), phone: normalisePhone(body.phone)!,
      departmentId: DEPARTMENT.departmentId, status: 'ACTIVE', credentialStatus: 'NOT_INVITED',
      allocationCount: 0, createdAt: now(),
    };
    this.faculty.push(f);
    return this.member(f);
  }

  /** CRD-3 */
  updateFaculty(userId: string, body: FacultyUpdate): FacultyMember {
    const f = this.facultyRecord(userId);
    const next: FacultyCreate = {
      firstName: body.firstName ?? f.firstName, lastName: body.lastName ?? f.lastName,
      email: body.email ?? f.email, phone: body.phone ?? f.phone,
    };
    this.assertValid(next, userId);
    Object.assign(f, {
      firstName: next.firstName.trim(), lastName: next.lastName.trim(),
      fullName: `${next.firstName.trim()} ${next.lastName.trim()}`,
      email: next.email.trim().toLowerCase(), phone: normalisePhone(next.phone)!,
    });
    if (body.status) f.status = body.status;
    return this.member(f);
  }

  /** CRD-4 */
  resendInvite(userId: string): FacultyMember {
    const f = this.facultyRecord(userId);
    if (f.credentialStatus === 'ACTIVATED') {
      throw new MockError(409, 'INVALID_STATE', `${f.fullName} has already set a password.`);
    }
    if (f.credentialStatus === 'NOT_INVITED') {
      throw new MockError(409, 'INVALID_STATE', `${f.fullName} gets an invitation with their first allocation email.`);
    }
    f.credentialStatus = 'INVITE_SENT';
    return this.member(f);
  }

  /** CRD-16 */
  facultyTemplate(): ExportFile {
    const blob = writeXlsx('Faculty', [[...IMPORT_COLUMNS]], [18, 18, 32, 18]);
    return {
      fileId: 'file-faculty-template', fileName: 'Faculty_import_template.xlsx', mimeType: blob.type,
      sizeBytes: blob.size, downloadUrl: URL.createObjectURL(blob), expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
  }

  /** CRD-17, before reading: the checks the server makes on the upload itself. */
  checkUpload(fileName: string, sizeBytes: number): void {
    if (!/\.xlsx$/i.test(fileName)) {
      throw new MockError(415, 'UNSUPPORTED_FILE_TYPE', 'Upload an Excel workbook (.xlsx). Download the template if you need one.');
    }
    if (sizeBytes > MAX_IMPORT_BYTES) throw new MockError(413, 'FILE_TOO_LARGE', 'The file is larger than 2 MB.');
  }

  /** CRD-17: reads the sheet and returns a preview; nothing is written yet. */
  importPreview(fileName: string, sheet: string[][]): FacultyImportPreview {
    const firstRow = sheet.findIndex(r => r.some(c => c.trim()));
    const header = firstRow >= 0 ? sheet[firstRow].map(normaliseHeader) : [];
    const colOf = IMPORT_COLUMNS.map(c => header.indexOf(normaliseHeader(c)));
    const fileErrors = IMPORT_COLUMNS.filter((_, i) => colOf[i] < 0).map(c => `The column "${c}" is missing.`);
    if (firstRow < 0) fileErrors.splice(0, fileErrors.length, 'The sheet is empty.');

    const body = firstRow < 0 || fileErrors.length ? [] : sheet
      .map((cells, i) => ({ cells, rowNumber: i + 1 }))
      .slice(firstRow + 1)
      .filter(({ cells }) => cells.some(c => c.trim()));
    if (body.length > MAX_IMPORT_ROWS) {
      throw new MockError(422, 'PRECONDITION_FAILED', `A file can hold at most ${MAX_IMPORT_ROWS} faculty; this one has ${body.length}.`);
    }
    if (!fileErrors.length && !body.length) fileErrors.push('The sheet has a header row but no faculty.');

    const existing = new Set(this.faculty.map(f => f.email));
    const seen = new Set<string>();
    const rows: FacultyImportRow[] = body.map(({ cells, rowNumber }) => {
      const [firstName, lastName, email, phone] = colOf.map(c => (cells[c] ?? '').trim());
      const errors = facultyErrors({ firstName, lastName, email, phone });
      const key = email.toLowerCase();
      let status: FacultyImportRow['status'] = 'VALID';
      if (errors.length) status = 'INVALID';
      else if (existing.has(key)) status = 'ALREADY_EXISTS';
      else if (seen.has(key)) status = 'DUPLICATE_IN_FILE';
      // Only a row that would be imported makes later rows with its email duplicates.
      if (status === 'VALID') seen.add(key);
      return { rowNumber, firstName, lastName, email, phone, status, errors };
    });

    const preview: FacultyImportPreview = {
      importId: `imp-${++this.seq}`, fileName, fileErrors, rows,
      counts: {
        valid: rows.filter(r => r.status === 'VALID').length,
        invalid: rows.filter(r => r.status === 'INVALID').length,
        duplicateInFile: rows.filter(r => r.status === 'DUPLICATE_IN_FILE').length,
        alreadyExists: rows.filter(r => r.status === 'ALREADY_EXISTS').length,
      },
    };
    this.imports.set(preview.importId, { preview, expiresAt: Date.now() + 30 * 60_000 });
    return preview;
  }

  /** CRD-18: creates the VALID rows only; existing faculty are never overwritten. */
  commitImport(importId: string): FacultyImportResult {
    const held = this.imports.get(importId);
    if (!held || held.expiresAt < Date.now()) {
      throw new MockError(404, 'NOT_FOUND', 'This preview has expired. Upload the file again.');
    }
    if (held.preview.fileErrors.length) {
      throw new MockError(422, 'PRECONDITION_FAILED', 'Fix the file and upload it again.');
    }
    this.imports.delete(importId);
    const created: FacultyMember[] = [];
    for (const r of held.preview.rows.filter(x => x.status === 'VALID')) {
      // A member added since the preview is skipped rather than duplicated.
      if (this.faculty.some(f => f.email === r.email.toLowerCase())) continue;
      created.push(this.createFaculty({ firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone }));
    }
    return { created, skipped: held.preview.rows.length - created.length };
  }

  private assertValid(body: FacultyCreate, ownUserId?: string): void {
    const errors = facultyErrors(body);
    if (errors.length) {
      throw new MockError(400, 'VALIDATION_FAILED', 'Check the highlighted fields.',
        Object.fromEntries(errors.map(e => [e.field, e.message])));
    }
    const email = body.email.trim().toLowerCase();
    const clash = this.faculty.find(f => f.email === email && f.userId !== ownUserId);
    if (clash) {
      throw new MockError(409, 'DUPLICATE_EMAIL', `${clash.fullName} already uses ${email}.`, { email: `${clash.fullName} already uses this email.` });
    }
  }

  /** The record with its server-computed allocation count for the current year. */
  private member(f: FacultyMember): FacultyMember {
    const current = YEARS.find(y => y.isCurrent)!.academicYearId;
    const allocationCount = this.setups
      .filter(s => s.academicYearId === current)
      .reduce((n, s) => n + s.allocations.filter(a => a.faculty.userId === f.userId).length, 0);
    return { ...f, allocationCount };
  }

  private facultyRecord(userId: string): FacultyMember {
    const f = this.faculty.find(x => x.userId === userId);
    if (!f) throw new MockError(404, 'NOT_FOUND', 'This faculty member doesn\'t exist.');
    return f;
  }

  /* --------------------------- load distribution (§15.4) --------------------------- */

  /** CRD-19 */
  loadDistribution(setupId: string): LoadDistribution {
    return structuredClone(this.record(setupId).load);
  }

  /** CRD-20: replaces the whole table; server-computed fields are recomputed. */
  saveLoadDistribution(setupId: string, body: LoadDistributionUpdate): LoadDistribution {
    const rec = this.record(setupId);
    if (rec.load.status === 'DECLARED') {
      throw new MockError(409, 'SYLLABUS_LOCKED', 'The syllabus is declared. Revise it from the Declaration step to change it.');
    }
    if (body.version !== rec.load.version) {
      throw new MockError(409, 'VERSION_CONFLICT', 'Someone else saved this load distribution. Reload to see their changes.');
    }
    const state = this.stepState(rec, 'SYLLABUS');
    if (state.status === 'LOCKED') throw new MockError(409, 'STAGE_LOCKED', state.lockedReason ?? 'This step is locked.');
    this.applyRows(rec, body.rows);
    rec.load.version++;
    return this.loadDistribution(setupId);
  }

  /** CRD-21 */
  declare(setupId: string, body: { version: number; confirmed: boolean }): LoadDistribution {
    const rec = this.record(setupId);
    if (rec.load.status === 'DECLARED') throw new MockError(409, 'INVALID_STATE', 'This syllabus version is already declared.');
    if (body.version !== rec.load.version) {
      throw new MockError(409, 'VERSION_CONFLICT', 'The load distribution changed since you opened it. Reload and check it again.');
    }
    const state = this.stepState(rec, 'DECLARATION');
    if (state.status === 'LOCKED') throw new MockError(409, 'STAGE_LOCKED', state.lockedReason ?? 'This step is locked.');
    if (body.confirmed !== true) {
      throw new MockError(400, 'VALIDATION_FAILED', 'Tick the confirmation to declare the syllabus.', { confirmed: 'Tick to confirm.' });
    }
    const year = this.year(rec.academicYearId);
    rec.load.status = 'DECLARED';
    rec.load.declaration = {
      syllabusVersion: rec.load.syllabusVersion, statement: DECLARATION_STATEMENT,
      declaredBy: { ...MOCK_COORDINATOR }, declaredAt: now(), department: { ...DEPARTMENT },
      academicYear: { academicYearId: year.academicYearId, name: year.name }, semesterNumber: rec.semesterNumber,
    };
    rec.load.version++;
    rec.version++;
    return this.loadDistribution(setupId);
  }

  /** CRD-22: a new draft version, copied from the declared one. */
  revise(setupId: string, body: { version: number; reason: string }): LoadDistribution {
    const rec = this.record(setupId);
    if (rec.completedAt) {
      throw new MockError(409, 'SYLLABUS_IN_USE', 'The allocation is completed and faculty may already be working from this syllabus, so it can’t be revised.');
    }
    if (rec.load.status !== 'DECLARED') throw new MockError(409, 'INVALID_STATE', 'This version isn’t declared yet; edit it directly.');
    if (body.version !== rec.load.version) {
      throw new MockError(409, 'VERSION_CONFLICT', 'The load distribution changed since you opened it. Reload and try again.');
    }
    const reason = (body.reason ?? '').trim();
    if (!reason) throw new MockError(400, 'VALIDATION_FAILED', 'Say why the syllabus is being revised.', { reason: 'Give a reason.' });
    rec.history.push({ syllabusVersion: rec.load.syllabusVersion, declaration: rec.load.declaration, revisedBecause: reason });
    rec.load = {
      ...structuredClone(rec.load), syllabusVersion: rec.load.syllabusVersion + 1, status: 'DRAFT',
      declaration: undefined, version: rec.load.version + 1, updatedAt: now(), updatedBy: MOCK_COORDINATOR.fullName,
    };
    rec.version++;
    return this.loadDistribution(setupId);
  }

  /** CRD-23 */
  courseGroups(): CourseGroup[] {
    return [...BUILT_IN_GROUPS, ...this.customGroups].map(g => ({ ...g }));
  }

  /** CRD-24 */
  addCourseGroup(body: { code: string; name: string }): CourseGroup {
    const code = (body.code ?? '').trim().toUpperCase();
    const name = (body.name ?? '').trim();
    const fieldErrors: Record<string, string> = {};
    if (!/^[A-Z][A-Z0-9-]{1,9}$/.test(code)) fieldErrors['code'] = 'Use 2 to 10 capital letters or digits, starting with a letter.';
    if (!name) fieldErrors['name'] = 'The group needs a name.';
    if (Object.keys(fieldErrors).length) throw new MockError(400, 'VALIDATION_FAILED', 'Check the group’s code and name.', fieldErrors);
    if (this.courseGroups().some(g => g.code === code)) {
      throw new MockError(409, 'DUPLICATE_CODE', `The group ${code} already exists.`, { code: 'This code is taken.' });
    }
    const g: CourseGroup = { code, name, builtIn: false };
    this.customGroups.push(g);
    return { ...g };
  }

  /* ------------------------------- POs and PSOs (§15.5) ------------------------------- */

  /** CRD-25 / CRD-27 */
  outcomes(kind: OutcomeKind): OutcomeSet {
    return structuredClone(kind === 'PO' ? this.pos : this.psos);
  }

  /** CRD-26 / CRD-28: exactly 11 POs or 3 PSOs with fixed codes; saving makes a new version. */
  saveOutcomes(kind: OutcomeKind, body: OutcomeSetUpdate): OutcomeSet {
    const current = kind === 'PO' ? this.pos : this.psos;
    if (body.version !== current.version) {
      throw new MockError(409, 'VERSION_CONFLICT', `Someone else changed the ${kind}s. Reload to see their changes.`);
    }
    const codes = current.items.map(i => i.code);
    if (body.items.length !== codes.length || body.items.some((it, i) => it.code !== codes[i])) {
      throw new MockError(400, 'VALIDATION_FAILED', `There are exactly ${codes.length} ${kind}s, ${codes[0]} to ${codes[codes.length - 1]}, in order.`);
    }
    const fieldErrors: Record<string, string> = {};
    body.items.forEach((it, i) => {
      const s = (it.statement ?? '').trim();
      if (!s) fieldErrors[`items[${i}].statement`] = `${it.code} needs a statement.`;
      else if (s.length > 1000) fieldErrors[`items[${i}].statement`] = 'At most 1,000 characters.';
      if ((it.title ?? '').length > 120) fieldErrors[`items[${i}].title`] = 'At most 120 characters.';
    });
    if (Object.keys(fieldErrors).length) throw new MockError(400, 'VALIDATION_FAILED', 'Check the highlighted outcomes.', fieldErrors);

    this.outcomeHistory.push(structuredClone(current));
    const next: OutcomeSet = {
      ...current, version: current.version + 1, updatedBy: MOCK_COORDINATOR.fullName, updatedAt: now(),
      items: current.items.map((o, i) => ({ ...o, title: body.items[i].title?.trim() || undefined, statement: body.items[i].statement.trim() })),
    };
    if (kind === 'PO') this.pos = next; else this.psos = next;
    return structuredClone(next);
  }

  /** CRD-29 */
  outcomeVersions(kind: OutcomeKind): OutcomeSet[] {
    return this.outcomeHistory.filter(o => o.kind === kind).map(o => structuredClone(o));
  }

  /* ------------------------------- allocation (§15.6, §15.7) ------------------------------- */

  /** CRD-5 */
  allocationBoard(setupId: string): AllocationBoard {
    const rec = this.record(setupId);
    const divisions: (string | undefined)[] = rec.divisions.length ? rec.divisions : [undefined];
    const subjects: AllocatableSubject[] = this.subjectsOf(rec).map(s => ({
      subjectKey: s.subjectKey, course: { ...s.course }, slotName: s.slotName, section: s.section, groupCode: s.groupCode,
      assessmentScheme: s.assessmentScheme, hours: { ...s.hours },
      divisions: divisions.map(division => {
        const a = rec.allocations.find(x => x.subjectKey === s.subjectKey && x.division === division);
        return { ...(division ? { division } : {}), ...(a ? { allocation: structuredClone(a) } : {}) };
      }),
    }));
    const slots = subjects.flatMap(s => s.divisions);
    const blockers: AllocationBoard['blockers'] = [];
    if (!rec.completedAt) {
      if (rec.load.status !== 'DECLARED') blockers.push({ code: 'SYLLABUS_NOT_DECLARED', message: 'The syllabus isn’t declared yet.' });
      if (!this.outcomesComplete()) blockers.push({ code: 'OUTCOMES_INCOMPLETE', message: 'The 11 POs and the department’s 3 PSOs aren’t all filled.' });
      for (const s of subjects) {
        for (const d of s.divisions.filter(x => !x.allocation)) {
          blockers.push({
            code: 'UNASSIGNED', subjectKey: s.subjectKey,
            message: `${s.course.courseName}${d.division ? `, division ${d.division},` : ''} has no faculty member.`,
          });
        }
      }
      for (const a of rec.allocations) {
        if (this.facultyRecord(a.faculty.userId).status !== 'ACTIVE') {
          blockers.push({ code: 'INACTIVE_FACULTY', subjectKey: a.subjectKey, message: `${a.faculty.fullName} is inactive; give ${a.course.courseName} to someone else.` });
        }
      }
    }
    return {
      setupId: rec.setupId, version: rec.version, status: rec.completedAt ? 'COMPLETED' : 'DRAFT', completedAt: rec.completedAt,
      subjects,
      summary: {
        subjects: slots.length,
        assigned: slots.filter(x => x.allocation).length,
        unassigned: slots.filter(x => !x.allocation).length,
        pendingAcceptance: rec.allocations.filter(a => a.status === 'PENDING_ACCEPTANCE').length,
        accepted: rec.allocations.filter(a => a.status === 'ACCEPTED').length,
      },
      blockers,
    };
  }

  /** CRD-6 */
  createAllocation(body: AllocationCreate): SubjectAllocation {
    const rec = this.record(body.setupId);
    if (rec.completedAt) {
      throw new MockError(409, 'INVALID_STATE', 'The allocation is completed. Change a subject’s faculty member instead.');
    }
    const state = this.stepState(rec, 'ALLOCATION');
    if (state.status === 'LOCKED') throw new MockError(409, 'STAGE_LOCKED', state.lockedReason ?? 'This step is locked.');
    const subject = this.subjectsOf(rec).find(s => s.subjectKey === body.subjectKey);
    if (!subject) throw new MockError(404, 'NOT_FOUND', 'That subject isn’t in this semester’s syllabus.');
    const division = this.checkDivision(rec, body.division);
    if (rec.allocations.some(a => a.subjectKey === body.subjectKey && a.division === division)) {
      throw new MockError(409, 'ALREADY_ALLOCATED', `${subject.course.courseName}${division ? `, division ${division},` : ''} already has a faculty member.`);
    }
    const f = this.activeFacultyMember(body.facultyUserId);
    const year = this.year(rec.academicYearId);
    const a: SubjectAllocation = {
      allocationId: `alloc-${++this.seq}`, setupId: rec.setupId,
      academicYear: { academicYearId: year.academicYearId, name: year.name }, semesterNumber: rec.semesterNumber,
      subjectKey: subject.subjectKey,
      course: { syllabusCourseId: subject.syllabusCourseId, courseCode: subject.course.courseCode, courseName: subject.course.courseName },
      ...(division ? { division } : {}),
      faculty: { userId: f.userId, fullName: f.fullName, email: f.email },
      status: 'DRAFT', createdAt: now(),
    };
    rec.allocations.push(a);
    return structuredClone(a);
  }

  /** CRD-7: changes the faculty member; after completion this reassigns and emails both people. */
  updateAllocation(allocationId: string, body: { facultyUserId: string }): SubjectAllocation {
    const { rec, a } = this.allocation(allocationId);
    if (a.faculty.userId === body.facultyUserId) return structuredClone(a);
    const f = this.activeFacultyMember(body.facultyUserId);
    const previous = { ...a.faculty };
    a.faculty = { userId: f.userId, fullName: f.fullName, email: f.email };
    if (rec.completedAt) {
      // The real backend refuses with OFFERING_IN_USE once the previous faculty member finalized the assessment plan.
      a.status = 'PENDING_ACCEPTANCE';
      a.acceptedAt = undefined;
      a.notifiedAt = now();
      const subject = [{ courseCode: a.course.courseCode, courseName: a.course.courseName, division: a.division }];
      this.notify(rec, 'REASSIGNED', this.facultyRecord(f.userId), subject);
      this.notify(rec, 'REMOVED', this.facultyRecord(previous.userId), subject);
    }
    return structuredClone(a);
  }

  /** CRD-8: only before completion. */
  deleteAllocation(allocationId: string): void {
    const { rec, a } = this.allocation(allocationId);
    if (rec.completedAt) {
      throw new MockError(409, 'INVALID_STATE', 'The allocation is completed. Give the subject to someone else instead of removing it.');
    }
    rec.allocations = rec.allocations.filter(x => x !== a);
  }

  /** CRD-30: everything each faculty member teaches in the academic year, across semesters. */
  facultyLoad(academicYearId?: string): FacultyLoad[] {
    const year = this.year(academicYearId ?? YEARS.find(y => y.isCurrent)!.academicYearId);
    const setups = this.setups.filter(s => s.academicYearId === year.academicYearId);
    return this.faculty
      .map(f => {
        const allocations = setups.flatMap(s => s.allocations.filter(a => a.faculty.userId === f.userId).map(a => {
          const hours = this.subjectsOf(s).find(x => x.subjectKey === a.subjectKey)?.hours ?? { lecture: 0, tutorial: 0, practical: 0 };
          return {
            allocationId: a.allocationId, semesterNumber: s.semesterNumber, courseCode: a.course.courseCode,
            courseName: a.course.courseName, ...(a.division ? { division: a.division } : {}), hours: { ...hours }, status: a.status,
          };
        })).sort((x, y) => x.semesterNumber - y.semesterNumber || x.courseCode.localeCompare(y.courseCode));
        return {
          faculty: { userId: f.userId, fullName: f.fullName, email: f.email, status: f.status },
          allocations,
          weeklyHours: allocations.reduce((n, x) => n + x.hours.lecture + x.hours.tutorial + x.hours.practical, 0),
        };
      })
      .filter(l => l.faculty.status === 'ACTIVE' || l.allocations.length)
      .sort((x, y) => x.faculty.fullName.localeCompare(y.faculty.fullName));
  }

  /** CRD-31: creates the offerings, sets every allocation pending and emails each faculty member once. */
  completeAllocation(setupId: string, body: { version: number }): AllocationBoard {
    const rec = this.record(setupId);
    if (rec.completedAt) throw new MockError(409, 'INVALID_STATE', 'The allocation is already completed.');
    if (body.version !== rec.version) {
      throw new MockError(409, 'VERSION_CONFLICT', 'This semester changed since you opened it. Reload and check again.');
    }
    const blockers = this.allocationBoard(setupId).blockers;
    if (blockers.length) {
      const more = blockers.length > 3 ? ` …and ${blockers.length - 3} more.` : '';
      throw new MockError(409, 'ALLOCATION_INCOMPLETE', `The allocation can’t be completed yet: ${blockers.slice(0, 3).map(b => b.message).join(' ')}${more}`);
    }
    const at = now();
    rec.completedAt = at;
    for (const a of rec.allocations) {
      a.status = 'PENDING_ACCEPTANCE';
      a.notifiedAt = at;
      a.offeringId = `off-${a.allocationId}`;
    }
    const byFaculty = new Map<string, SubjectAllocation[]>();
    for (const a of rec.allocations) byFaculty.set(a.faculty.userId, [...(byFaculty.get(a.faculty.userId) ?? []), a]);
    for (const [userId, list] of byFaculty) {
      this.notify(rec, 'ALLOCATION', this.facultyRecord(userId),
        list.map(a => ({ courseCode: a.course.courseCode, courseName: a.course.courseName, division: a.division })));
    }
    rec.version++;
    return this.allocationBoard(setupId);
  }

  /** CRD-32 */
  remind(allocationId: string): SubjectAllocation {
    const { rec, a } = this.allocation(allocationId);
    if (a.status !== 'PENDING_ACCEPTANCE') {
      throw new MockError(409, 'INVALID_STATE', a.status === 'ACCEPTED' ? `${a.faculty.fullName} has already accepted.` : 'Complete the allocation first.');
    }
    a.notifiedAt = now();
    this.notify(rec, 'REMINDER', this.facultyRecord(a.faculty.userId),
      [{ courseCode: a.course.courseCode, courseName: a.course.courseName, division: a.division }]);
    return structuredClone(a);
  }

  /** CRD-33: the emails sent for this semester, newest first. */
  notifications(setupId: string): AllocationNotification[] {
    return structuredClone([...this.record(setupId).notifications].reverse());
  }

  /**
   * The completed allocations of one faculty member, with the load distribution
   * row behind each (for the faculty side: FAC-1 offerings and the generated plan).
   */
  offeringsFor(email: string): { allocation: SubjectAllocation; row: LoadRow; divisions: string[]; coordinator: string }[] {
    const f = this.faculty.find(x => x.email === email.trim().toLowerCase());
    if (!f) return [];
    return this.setups.filter(s => s.completedAt).flatMap(s => s.allocations
      .filter(a => a.faculty.userId === f.userId && a.offeringId)
      .map(a => {
        const [rowId, optionId] = a.subjectKey.split(':');
        const row = structuredClone(s.load.rows.find(r => r.rowId === rowId)!);
        const option = optionId ? row.options?.find(o => o.optionId === optionId) : undefined;
        if (option) { row.courseCode = option.courseCode; row.courseName = option.courseName; }
        return { allocation: structuredClone(a), row, divisions: [...s.divisions], coordinator: MOCK_COORDINATOR.fullName };
      }));
  }

  /** FAC-4 by offering, as the faculty workspace calls it. */
  acceptOffering(offeringId: string): SubjectAllocation {
    const a = this.setups.flatMap(s => s.allocations).find(x => x.offeringId === offeringId);
    if (!a) throw new MockError(404, 'NOT_FOUND', 'Course not found.');
    return this.acceptAllocation(a.allocationId);
  }

  /** FAC-4 as the faculty side will call it (§7.2); used by the demo and the tests. */
  acceptAllocation(allocationId: string): SubjectAllocation {
    const { a } = this.allocation(allocationId);
    if (a.status === 'ACCEPTED') throw new MockError(409, 'ALREADY_FINALIZED', 'This subject is already accepted.');
    if (a.status !== 'PENDING_ACCEPTANCE') throw new MockError(409, 'INVALID_STATE', 'The allocation isn’t completed yet.');
    a.status = 'ACCEPTED';
    a.acceptedAt = now();
    return structuredClone(a);
  }

  /** Subjects needing a faculty member: rows that need one, or each offered option of a slot. */
  private subjectsOf(rec: SetupRecord): SubjectInfo[] {
    return rec.load.rows.filter(r => r.needsFaculty).flatMap((r): SubjectInfo[] => {
      const base = {
        section: r.section, groupCode: r.groupCode, assessmentScheme: r.assessmentScheme, hours: { ...r.hours },
      };
      return r.options?.length
        ? r.options.filter(o => o.offered).map(o => ({
            ...base, subjectKey: `${r.rowId}:${o.optionId}`, syllabusCourseId: `sc-${o.optionId}`,
            course: { courseCode: o.courseCode, courseName: o.courseName }, slotName: r.courseName,
          }))
        : [{ ...base, subjectKey: r.rowId!, syllabusCourseId: `sc-${r.rowId}`, course: { courseCode: r.courseCode, courseName: r.courseName }, slotName: undefined }];
    });
  }

  private checkDivision(rec: SetupRecord, division?: string): string | undefined {
    const d = division?.trim().toUpperCase() || undefined;
    if (rec.divisions.length && (!d || !rec.divisions.includes(d))) {
      throw new MockError(400, 'VALIDATION_FAILED', `Choose a division: ${rec.divisions.join(', ')}.`, { division: 'Choose a division.' });
    }
    if (!rec.divisions.length && d) throw new MockError(400, 'VALIDATION_FAILED', 'This semester has no divisions.', { division: 'No divisions.' });
    return d;
  }

  private activeFacultyMember(userId: string): FacultyMember {
    const f = this.facultyRecord(userId);
    if (f.status !== 'ACTIVE') throw new MockError(422, 'PRECONDITION_FAILED', `${f.fullName} is inactive and can’t be given subjects.`);
    return f;
  }

  private allocation(allocationId: string): { rec: SetupRecord; a: SubjectAllocation } {
    for (const rec of this.setups) {
      const a = rec.allocations.find(x => x.allocationId === allocationId);
      if (a) return { rec, a };
    }
    throw new MockError(404, 'NOT_FOUND', 'This allocation doesn’t exist.');
  }

  /** Queues one email, as Spring Boot does (§15.7). Invites go out with the first allocation email. */
  private notify(rec: SetupRecord, kind: AllocationNotification['kind'], f: FacultyMember,
                 subjects: { courseCode: string; courseName: string; division?: string }[]): void {
    const year = this.year(rec.academicYearId);
    const sem = `Semester ${roman(rec.semesterNumber)}, ${year.name}`;
    const invite = f.credentialStatus !== 'ACTIVATED' && kind !== 'REMOVED';
    if (invite) f.credentialStatus = 'INVITE_SENT';
    const list = subjects.map((s, i) => `${i + 1}. ${s.courseName} (${s.courseCode})${s.division ? `, division ${s.division}` : ''}`).join('\n');
    const subjectLine = {
      ALLOCATION: `Subject allocation — ${sem}`,
      REASSIGNED: `New subject allocated — ${sem}`,
      REMOVED: `Subject reassigned — ${sem}`,
      REMINDER: `Reminder: accept your subjects — ${sem}`,
    }[kind];
    const intro = {
      ALLOCATION: `You have been allocated the following ${subjects.length === 1 ? 'subject' : 'subjects'} for ${sem}, ${DEPARTMENT.departmentName}:`,
      REASSIGNED: `You have been allocated the following subject for ${sem}, ${DEPARTMENT.departmentName}:`,
      REMOVED: `The following subject for ${sem} has been given to another faculty member. You no longer need to accept it:`,
      REMINDER: `Please accept the following subject for ${sem}, ${DEPARTMENT.departmentName}:`,
    }[kind];
    const signIn = kind === 'REMOVED' ? '' : invite
      ? '\n\nSet your password here (the link is valid for 72 hours): [set-password link]\nThen open Setup and accept your allocated subjects.'
      : '\n\nSign in here: [sign-in link]\nThen open Setup and accept your allocated subjects.';
    rec.notifications.push({
      notificationId: `mail-${++this.seq}`, kind, to: { userId: f.userId, fullName: f.fullName, email: f.email },
      subjectLine,
      body: `Dear ${f.fullName},\n\n${intro}\n\n${list}${signIn}\n\nRegards,\n${MOCK_COORDINATOR.fullName}\nCoordinator, ${DEPARTMENT.departmentName}`,
      subjects: structuredClone(subjects), includesSetPasswordLink: invite, status: 'SENT', createdAt: now(),
    });
  }

  /* --------------------------------- derivation --------------------------------- */

  /** Stores the rows with IDs and derived fields, recomputes totals and issues, and drops orphaned allocations. */
  private applyRows(rec: SetupRecord, rows: LoadRow[]): void {
    const stored = rows.map(r => deriveRow({
      ...structuredClone(r),
      rowId: r.rowId ?? `row-${++this.seq}`,
      options: r.options?.map(o => ({ ...o, optionId: o.optionId ?? `opt-${++this.seq}` })),
    }));
    rec.load.rows = stored;
    rec.load.totals = loadTotals(stored);
    rec.load.issues = loadIssues(stored, this.courseGroups().map(g => g.code));
    rec.load.updatedAt = now();
    rec.load.updatedBy = MOCK_COORDINATOR.fullName;
    const keys = new Set(stored.filter(r => r.needsFaculty).flatMap(r =>
      r.options?.length ? r.options.filter(o => o.offered).map(o => `${r.rowId}:${o.optionId}`) : [r.rowId!]));
    rec.allocations = rec.allocations.filter(a => keys.has(a.subjectKey));
  }

  private stepState(rec: SetupRecord, key: SetupStepKey): StepState {
    return this.steps(rec).find(s => s.key === key)!.state;
  }

  private newRecord(academicYearId: string, semesterNumber: number, divisions: string[], createdAt: string): SetupRecord {
    const setupId = `setup-${academicYearId.slice(3)}-s${semesterNumber}-${++this.seq}`;
    return {
      setupId, version: 1, academicYearId, semesterNumber, divisions,
      createdBy: MOCK_COORDINATOR.fullName, createdAt, load: emptyLoad(setupId), history: [], allocations: [], notifications: [],
    };
  }

  private view(rec: SetupRecord): SemesterSetup {
    const year = this.year(rec.academicYearId);
    return {
      setupId: rec.setupId,
      version: rec.version,
      department: { ...DEPARTMENT },
      academicYear: { academicYearId: year.academicYearId, name: year.name },
      semesterNumber: rec.semesterNumber,
      divisions: [...rec.divisions],
      status: rec.completedAt ? 'COMPLETED' : 'IN_PROGRESS',
      steps: this.steps(rec),
      syllabusVersion: rec.load.syllabusVersion,
      createdBy: rec.createdBy,
      createdAt: rec.createdAt,
    };
  }

  private summary(rec: SetupRecord): SemesterSetupSummary {
    const steps = this.steps(rec);
    return {
      setupId: rec.setupId,
      status: rec.completedAt ? 'COMPLETED' : 'IN_PROGRESS',
      currentStep: steps.find(s => s.state.status !== 'DONE')?.key ?? 'COMPLETE',
      subjects: {
        configured: this.subjectSlots(rec),
        assigned: rec.allocations.length,
        accepted: rec.allocations.filter(a => a.status === 'ACCEPTED').length,
      },
    };
  }

  /** The server-side step order of §15.1. */
  private steps(rec: SetupRecord): { key: SetupStepKey; state: StepState }[] {
    const facultyDone = this.activeFaculty() > 0;
    const declared = rec.load.status === 'DECLARED';
    const syllabusDone = declared || (rec.load.rows.length > 0 && rec.load.issues.length === 0);
    const outcomesDone = this.outcomesComplete();
    const slots = this.subjectSlots(rec);
    const allocationDone = !!rec.completedAt || (slots > 0 && rec.allocations.length === slots);

    const done: StepState = { status: 'DONE' };
    const locked = (lockedReason: string): StepState => ({ status: 'LOCKED', lockedReason });
    const open = (started: boolean): StepState => ({ status: started ? 'IN_PROGRESS' : 'AVAILABLE' });
    const anyOutcome = [...this.pos.items, ...this.psos.items].some(o => o.statement.trim());

    return [
      { key: 'FACULTY', state: facultyDone ? done : open(false) },
      {
        key: 'SYLLABUS',
        state: syllabusDone ? done : !facultyDone ? locked('Add the department\'s faculty first.') : open(rec.load.rows.length > 0),
      },
      {
        key: 'OUTCOMES',
        state: outcomesDone ? done : !syllabusDone ? locked('Finish the syllabus load distribution first.') : open(anyOutcome),
      },
      {
        key: 'DECLARATION',
        state: declared ? done
          : !syllabusDone ? locked('Finish the syllabus load distribution first.')
          : !outcomesDone ? locked('Fill the 11 POs and the department\'s 3 PSOs first.')
          : open(false),
      },
      {
        key: 'ALLOCATION',
        state: allocationDone ? done : !declared ? locked('Declare the syllabus first.') : open(rec.allocations.length > 0),
      },
      {
        key: 'COMPLETE',
        state: rec.completedAt ? done : !allocationDone ? locked('Assign every subject first.') : open(false),
      },
    ];
  }

  /** Subjects × divisions. */
  private subjectSlots(rec: SetupRecord): number {
    return subjectCount(rec.load.rows) * Math.max(1, rec.divisions.length);
  }

  private activeFaculty(): number {
    return this.faculty.filter(f => f.status === 'ACTIVE').length;
  }

  private outcomesComplete(): boolean {
    return this.pos.items.length === 11 && this.psos.items.length === 3
      && [...this.pos.items, ...this.psos.items].every(o => o.statement.trim().length > 0);
  }

  private record(setupId: string): SetupRecord {
    const rec = this.setups.find(s => s.setupId === setupId);
    if (!rec) throw new MockError(404, 'NOT_FOUND', 'This semester setup doesn\'t exist.');
    return rec;
  }

  private year(academicYearId: string): AcademicYearOption {
    const y = YEARS.find(x => x.academicYearId === academicYearId);
    if (!y) throw new MockError(404, 'NOT_FOUND', 'That academic year doesn\'t exist.');
    return y;
  }
}
