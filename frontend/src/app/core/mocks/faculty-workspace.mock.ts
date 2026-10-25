/**
 * In-memory stand-in for the faculty-workspace backend (API_CONTRACT v2.4 §7, §9, §14).
 *
 * Lifecycle states are hand-authored; every attainment number comes from the
 * generated fixtures. The store only moves records between states (preview →
 * approved, next cycle unlocked) — it never calculates attainment.
 */
import { Page } from '../models/common.model';
import {
  AssessmentCycle, AttainmentReadiness, AttainmentRun, CourseWorkbook, FacultyDashboard,
  FacultyOffering, StepState, StudentCoScore, WorkbookBlock, WorkbookStudentRow,
} from '../models/faculty-workspace.model';
import { Cam } from '../models/cam.model';
import { CamMockStore, DEFAULT_RUBRIC, networkSecurityCam } from './cam.mock';
import { WORKSPACE_FIXTURES } from './faculty-workspace.fixtures';
import { MockError } from './mock-error';

export { MockError } from './mock-error';

const F = WORKSPACE_FIXTURES as any;

const done = (updatedAt = '2026-09-01T10:00:00Z'): StepState => ({ status: 'DONE', updatedAt });
const available = (): StepState => ({ status: 'AVAILABLE' });
const locked = (lockedReason: string): StepState => ({ status: 'LOCKED', lockedReason });

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Sample units for the already-finalized demo courses: [title, hours, topics, CO codes taught]. */
const DEMO_UNITS: Record<string, [string, number, string, string[]][]> = {
  'off-cs301': [
    ['Introduction to operating systems', 6, 'OS structure and services; system calls; kernel types; booting.', ['CO1']],
    ['Processes and threads', 7, 'Process states and PCB; context switching; threads and multithreading models.', ['CO1', 'CO2']],
    ['CPU scheduling and synchronization', 8, 'FCFS, SJF, priority and round-robin scheduling; critical sections; semaphores; monitors.', ['CO2']],
    ['Memory management', 7, 'Contiguous allocation; fragmentation; paging; segmentation.', ['CO3']],
    ['Virtual memory', 6, 'Demand paging; page faults; page replacement; page buffering; thrashing.', ['CO4']],
    ['File systems and storage', 6, 'File concepts and access methods; directory structure; allocation methods; disk scheduling.', ['CO5']],
  ],
  'off-cs304': [
    ['Network architecture', 6, 'OSI and TCP/IP models; protocol stacks; network topologies.', ['CO1']],
    ['Data link layer', 7, 'Framing; error detection and correction; flow control; HDLC and PPP.', ['CO2']],
    ['Medium access control', 6, 'ALOHA; CSMA/CD; CSMA/CA; Ethernet; wireless LANs.', ['CO2']],
    ['Network layer', 8, 'IPv4 and IPv6 addressing; subnetting; routing algorithms; OSPF and BGP.', ['CO3']],
    ['Transport layer', 7, 'UDP; TCP connection management, flow and congestion control.', ['CO4']],
    ['Application layer', 6, 'DNS; HTTP; SMTP; FTP; network management basics.', ['CO4']],
  ],
  'off-cs302': [
    ['Data models', 6, 'Entity-relationship model; relational model; keys and constraints.', ['CO1']],
    ['Relational algebra and SQL', 8, 'Relational algebra; DDL and DML; joins; nested queries; views.', ['CO2']],
    ['Advanced SQL', 6, 'Aggregates; triggers; stored procedures; embedded SQL.', ['CO2']],
    ['Normalization', 7, 'Functional dependencies; 1NF to BCNF; decomposition.', ['CO3']],
    ['Transactions', 7, 'ACID properties; schedules; serializability; locking and timestamp protocols.', ['CO4']],
    ['Recovery', 5, 'Log-based recovery; checkpoints; shadow paging.', ['CO4']],
  ],
};

/** A finalized CAM rebuilt from a fixture course's matrix, with sample units. */
function finalizedCam(offeringId: string): Cam {
  const c = F.courses[offeringId];
  const outcomeId = (code: string) => `out-${code.toLowerCase()}`;
  const coId = (code: string) => c.cos.find((co: any) => co.code === code).coId;
  const units = DEMO_UNITS[offeringId];
  return {
    camId: `cam-${offeringId}`, offeringId, status: 'FINALIZED', version: 7,
    inputs: {
      courseObjectives: [],
      courseOutcomes: c.cos.map((co: any) => ({ coId: co.coId, code: co.code, statement: co.statement })),
      units: units.map(([title, hours, content], i) => ({ unitNumber: i + 1, title, hours, content })),
      programOutcomes: F.outcomes.map((o: any) => ({ outcomeId: outcomeId(o.code), kind: o.kind, code: o.code, title: o.shortName, statement: o.shortName })),
      activities: [], practicals: [], tutorials: [],
    },
    unitMapping: {
      status: 'CONFIRMED', confirmedAt: '2026-08-20T09:00:00Z', confirmedBy: 'Rohan Belsare',
      links: units.flatMap(([, , , codes], i) => codes.map(code => ({ unitNumber: i + 1, coId: coId(code), source: 'FACULTY' as const }))),
    },
    cells: c.cos.flatMap((co: any) => Object.entries(c.cam[co.code] ?? {}).map(([code, level]) =>
      ({ coId: co.coId, outcomeId: outcomeId(code), level, source: 'FACULTY' }))),
    scoringRubric: clone(DEFAULT_RUBRIC),
    updatedAt: '2026-08-22T11:30:00Z', updatedBy: 'Rohan Belsare',
  };
}

/** Build one assessment cycle from a fixture block. */
function cycle(block: any, order: number, state: 'DONE' | 'CALCULATE' | 'LAB' | 'LOCKED', lockReason = ''): AssessmentCycle {
  const paper = block.category === 'ISE' || block.category === 'ESE';
  const lockAll = (s: StepState) => (state === 'LOCKED' ? locked(lockReason) : s);
  const steps: AssessmentCycle['steps'] = {
    marksheet: lockAll(done()),
    marksUpload: state === 'LAB' ? available() : lockAll(done()),
    marksApproval: state === 'LAB' ? locked('Waiting for the lab assistant to upload marks') : lockAll(done()),
    attainmentApproval: state === 'DONE' ? done() : state === 'CALCULATE' ? available() :
      state === 'LAB' ? locked('Approve the marks first') : locked(lockReason),
  };
  if (paper) steps.paperValidation = lockAll(done());
  return { assessmentId: block.assessmentId, name: block.name, category: block.category, order, requiresPaperValidation: paper, steps };
}

export class FacultyWorkspaceMockStore {
  private offerings: FacultyOffering[] = this.seedOfferings();
  /** offeringId → runId of the latest approved run shown in the workbook. */
  private latestApproved: Record<string, string> = { 'off-cs301': 'run-os-1', 'off-cs304': 'run-cn-5' };
  private runs: Record<string, AttainmentRun> = clone(F.runs);
  /** offeringId → runId of the current un-approved preview, if any. */
  private previews: Record<string, string> = {};
  /** §9 CAM endpoints; finalizing moves the offering out of setup. */
  readonly cams = new CamMockStore(
    [networkSecurityCam('off-ec306'), ...['off-cs301', 'off-cs304', 'off-cs302'].map(finalizedCam)],
    id => this.completeCam(id),
  );

  constructor() {
    // Previews only exist once the faculty clicks "Calculate"; start without them.
    this.runs['run-os-2'].status = 'DISCARDED';
    this.runs['run-cn-6'].status = 'DISCARDED';
  }

  /* ------------------------------- reads -------------------------------- */

  dashboard(): FacultyDashboard {
    const attention = this.offerings
      .filter(o => o.progress.nextAction?.actor === 'FACULTY')
      .map(o => ({
        offeringId: o.offeringId, courseCode: o.course.courseCode, step: o.progress.nextAction!.step,
        assessmentId: o.progress.nextAction!.assessmentId, label: o.progress.nextAction!.label,
        since: '2026-10-24T08:15:00Z',
      }));
    return { offeringsCount: this.offerings.length, attention, offerings: clone(this.offerings) };
  }

  offering(id: string): FacultyOffering {
    const o = this.offerings.find(x => x.offeringId === id);
    if (!o) throw new MockError(404, 'NOT_FOUND', 'Course not found.');
    return clone(o);
  }

  workbook(id: string): CourseWorkbook {
    const o = this.offering(id);
    const c = F.courses[id];
    if (o.progress.setup.cam.status !== 'DONE') {
      throw new MockError(404, 'NOT_FOUND', 'The workbook is generated when the CAM is finalized.');
    }
    if (!c) throw new MockError(404, 'NOT_FOUND', 'This demo has no workbook data for this course yet.');
    const run = this.latestApproved[id] ? this.runs[this.latestApproved[id]] : null;
    const coOverall = (code: string) => run?.coResults.find(r => r.code === code) ?? null;
    const pendingText = (reason?: string) =>
      reason === 'AWAITING_ESE' ? 'Pending ESE' : reason === 'AWAITING_INDIRECT' ? 'Pending surveys' : 'Not calculated yet';

    const blocks: WorkbookBlock[] = c.blocks.map((b: any) => {
      const cyc = o.progress.cycles.find(x => x.assessmentId === b.assessmentId)!;
      const s = cyc.steps;
      const status: WorkbookBlock['status'] =
        s.marksApproval.status === 'DONE' ? 'FILLED' :
        s.marksUpload.status === 'AVAILABLE' ? 'AWAITING_UPLOAD' :
        s.marksheet.status === 'AVAILABLE' ? 'AWAITING_MARKSHEET' : 'LOCKED';
      const approvedRun = Object.values(this.runs).find(r =>
        r.offeringId === id && r.status === 'APPROVED' && r.scope.upToAssessmentId === b.assessmentId && !r.scope.isFinal);
      return {
        assessmentId: b.assessmentId, name: b.name, category: b.category, phase: b.phase, status,
        questions: b.questions,
        canCalculate: s.marksApproval.status === 'DONE' && s.attainmentApproval.status !== 'DONE',
        attainmentApprovedRunId: approvedRun?.runId,
      };
    });

    return {
      offeringId: id,
      template: o.assessmentScheme,
      asOf: run?.scope.label,
      main: {
        header: [
          { label: 'Class', value: o.className ?? null },
          { label: 'Course', value: `${o.course.courseCode}: ${o.course.courseName}` },
          { label: 'Course coordinator', value: o.courseCoordinator?.fullName ?? null, pendingReason: 'Not assigned' },
          { label: 'Year', value: o.academicYear.name },
          { label: 'Semester', value: String(o.semester.semesterNumber) },
          { label: 'Class strength', value: String(o.classStrength) },
        ],
        criteria: clone(F.targets),
        coSummary: c.cos.map((co: any) => {
          const r = coOverall(co.code);
          return {
            coCode: co.code, statement: co.statement, overall: r?.overall ?? null,
            pendingReason: r?.overall == null ? pendingText(r?.pendingReason) : undefined,
          };
        }),
      },
      poPso: {
        outcomes: clone(F.outcomes),
        matrix: c.cos.map((co: any) => ({
          coCode: co.code,
          coOverall: coOverall(co.code)?.overall ?? null,
          correlations: Object.fromEntries(F.outcomes.map((p: any) => [p.code, c.cam[co.code]?.[p.code] ?? null])),
        })),
        average: c.camSummary.average,
        courseMapping: c.camSummary.courseMapping,
        attainment: Object.fromEntries(F.outcomes.map((p: any) => [
          p.code, run?.outcomeResults.find(x => x.code === p.code)?.attainment ?? null,
        ])),
      },
      data: { blocks, studentCount: c.students.length },
    };
  }

  workbookStudents(id: string, page: number, size: number, search = ''): Page<WorkbookStudentRow> {
    this.workbook(id); // same 404 rules
    const term = search.trim().toLowerCase();
    const all: WorkbookStudentRow[] = F.courses[id].students.filter((s: any) =>
      !term || s.rollNumber.toLowerCase().includes(term) || s.studentName.toLowerCase().includes(term));
    return {
      content: clone(all.slice(page * size, page * size + size)),
      page, size, totalElements: all.length, totalPages: Math.max(1, Math.ceil(all.length / size)),
    };
  }

  readiness(id: string, upTo?: string): AttainmentReadiness {
    const o = this.offering(id);
    const key = this.previewKey(o, upTo);
    if (!key) throw new MockError(409, 'STAGE_LOCKED', 'There is nothing to calculate for this course yet.');
    const template = this.runs[key.runId];
    return {
      ready: true,
      scope: clone(template.scope),
      inputs: { classStrength: o.classStrength, targets: clone(F.targets), coMaxMarks: clone(F.coMax[key.coMaxKey]) },
      checks: [
        { code: 'ASSESSMENT_PLAN_FINALIZED', satisfied: true, severity: 'BLOCKING' },
        { code: 'CAM_FINALIZED', satisfied: true, severity: 'BLOCKING' },
        { code: 'VALIDATED_MARKS', satisfied: true, severity: 'BLOCKING', detail: `${template.scope.includedAssessments.length} assessments with approved marks` },
        { code: 'TARGETS_CONFIGURED', satisfied: true, severity: 'BLOCKING' },
        template.scope.isFinal
          ? { code: 'INDIRECT_SURVEYS', satisfied: true, severity: 'WARNING' }
          : { code: 'INDIRECT_SURVEYS', satisfied: false, severity: 'WARNING', detail: 'Entered at close-out; overall attainment stays pending until then.' },
      ],
    };
  }

  run(runId: string): AttainmentRun {
    const r = this.runs[runId];
    if (!r) throw new MockError(404, 'NOT_FOUND', 'Run not found.');
    return clone(r);
  }

  runStudents(runId: string, coId: string): StudentCoScore[] {
    return clone(F.runStudents[runId]?.[coId] ?? []);
  }

  /** The current un-approved preview for a course, if the faculty already calculated. */
  preview(id: string): AttainmentRun | null {
    const runId = this.previews[id];
    return runId ? this.run(runId) : null;
  }

  /* ------------------------------- writes ------------------------------- */

  calculate(id: string, upTo?: string): AttainmentRun {
    const o = this.offering(id);
    const key = this.previewKey(o, upTo);
    if (!key) throw new MockError(422, 'PRECONDITION_FAILED', 'Approve the marks before calculating attainment.');
    const r = this.runs[key.runId];
    r.status = 'CALCULATED';
    r.generatedAt = new Date().toISOString();
    this.previews[id] = r.runId;
    return clone(r);
  }

  approve(runId: string): AttainmentRun {
    const r = this.runs[runId];
    if (!r || r.status !== 'CALCULATED') throw new MockError(409, 'INVALID_STATE', 'Only a calculated run can be approved.');
    r.status = 'APPROVED';
    r.approvedAt = new Date().toISOString();
    r.approvedBy = 'Rohan';
    delete this.previews[r.offeringId];
    this.latestApproved[r.offeringId] = r.runId;
    this.advanceAfterApproval(r);
    return clone(r);
  }

  discard(runId: string): AttainmentRun {
    const r = this.runs[runId];
    if (!r || r.status !== 'CALCULATED') throw new MockError(409, 'INVALID_STATE', 'Only a calculated run can be discarded.');
    r.status = 'DISCARDED';
    delete this.previews[r.offeringId];
    return clone(r);
  }

  /* ------------------------------ internals ----------------------------- */

  /** After CAM-3: setup is done and the first assessment cycle opens. */
  private completeCam(offeringId: string): void {
    const p = this.offerings.find(x => x.offeringId === offeringId)!.progress;
    p.setup.cam = done(new Date().toISOString());
    p.phase = 'ASSESSMENTS';
    const [first, ...rest] = p.cycles;
    if (first.steps.paperValidation) {
      first.steps.paperValidation = available();
      first.steps.marksheet = locked('Send the question paper to the moderator first');
    } else {
      first.steps.marksheet = available();
    }
    first.steps.marksUpload = locked('Waiting for the previous step');
    first.steps.marksApproval = locked('Waiting for the previous step');
    first.steps.attainmentApproval = locked('Waiting for the previous step');
    for (const later of rest) {
      for (const k of Object.keys(later.steps) as (keyof AssessmentCycle['steps'])[]) {
        later.steps[k] = locked(`Waiting for ${first.name} attainment approval`);
      }
    }
    p.nextAction = {
      step: first.steps.paperValidation ? 'PAPER_VALIDATION' : 'MARKSHEET',
      assessmentId: first.assessmentId,
      label: first.steps.paperValidation ? `Validate the ${first.name} question paper` : `Create the ${first.name} marksheet`,
      actor: 'FACULTY',
    };
  }

  /** Which pre-generated run a "Calculate" on this course produces. */
  private previewKey(o: FacultyOffering, upTo?: string): { runId: string; coMaxKey: string } | null {
    if (o.offeringId === 'off-cs301' && (!upTo || upTo === 'as-os-ise2')
      && o.progress.cycles[1].steps.attainmentApproval.status !== 'DONE') {
      return { runId: 'run-os-2', coMaxKey: 'off-cs301|as-os-ise2' };
    }
    if (o.offeringId === 'off-cs304' && o.progress.closeOut.finalAttainment.status !== 'DONE') {
      return { runId: 'run-cn-6', coMaxKey: 'off-cs304|final' };
    }
    return null;
  }

  private advanceAfterApproval(r: AttainmentRun): void {
    const o = this.offerings.find(x => x.offeringId === r.offeringId)!;
    const p = o.progress;
    if (r.scope.isFinal) {
      p.closeOut.finalAttainment = done(r.approvedAt);
      p.closeOut.submission = available();
      p.nextAction = { step: 'SUBMISSION', label: 'Submit the final attainment to the HOD', actor: 'FACULTY' };
      return;
    }
    const idx = p.cycles.findIndex(c => c.assessmentId === r.scope.upToAssessmentId);
    p.cycles[idx].steps.attainmentApproval = done(r.approvedAt);
    const next = p.cycles[idx + 1];
    if (next) {
      const reason = 'Waiting for the previous step';
      if (next.steps.paperValidation) {
        next.steps.paperValidation = available();
        next.steps.marksheet = locked('Send the question paper to the moderator first');
      } else {
        next.steps.marksheet = available();
      }
      next.steps.marksUpload = locked(reason);
      next.steps.marksApproval = locked(reason);
      next.steps.attainmentApproval = locked(reason);
      for (const later of p.cycles.slice(idx + 2)) {
        for (const k of Object.keys(later.steps) as (keyof AssessmentCycle['steps'])[]) {
          later.steps[k] = locked(`Waiting for ${next.name} attainment approval`);
        }
      }
      p.nextAction = {
        step: next.steps.paperValidation ? 'PAPER_VALIDATION' : 'MARKSHEET',
        assessmentId: next.assessmentId,
        label: next.steps.paperValidation ? `Validate the ${next.name} question paper` : `Create the ${next.name} marksheet`,
        actor: 'FACULTY',
      };
    }
  }

  private seedOfferings(): FacultyOffering[] {
    const base = (id: string, semester: number, extra: Partial<FacultyOffering>): FacultyOffering => {
      const c = F.courses[id];
      return {
        offeringId: id,
        course: c?.course ?? extra.course,
        academicYear: { academicYearId: 'ay-2026', name: '2026-27' },
        semester: { semesterId: `sem-${semester}`, semesterNumber: semester },
        programName: 'B.Tech Electronics & Computer Engineering',
        className: 'TY B.Tech ECM',
        division: 'A',
        assessmentScheme: c?.scheme ?? 'PRACTICAL',
        classStrength: c?.classStrength ?? 30,
        courseCoordinator: { userId: 'u-rohan', fullName: 'Rohan Belsare' },
        readOnly: false,
        ...extra,
      } as FacultyOffering;
    };
    const setupDone = { subjectSelection: done(), assessmentPlan: done(), cam: done() };
    const closeLocked = (why: string) => ({ indirectSurveys: locked(why), finalAttainment: locked(why), submission: locked(why) });

    const os = F.courses['off-cs301'].blocks;
    const cn = F.courses['off-cs304'].blocks;
    const db = F.courses['off-cs302'].blocks;

    return [
      base('off-cs301', 5, {
        progress: {
          phase: 'ASSESSMENTS',
          setup: setupDone,
          cycles: [
            cycle(os[0], 1, 'DONE'),
            cycle(os[1], 2, 'CALCULATE'),
            ...os.slice(2).map((b: any, i: number) => cycle(b, i + 3, 'LOCKED', 'Waiting for ISE-2 attainment approval')),
          ],
          closeOut: closeLocked('Finish every assessment cycle first'),
          nextAction: { step: 'ATTAINMENT_APPROVAL', assessmentId: os[1].assessmentId, label: 'ISE-2 marks approved — calculate and approve attainment', actor: 'FACULTY' },
        },
      }),
      base('off-cs304', 5, {
        progress: {
          phase: 'CLOSE_OUT',
          setup: setupDone,
          cycles: cn.map((b: any, i: number) => cycle(b, i + 1, 'DONE')),
          closeOut: { indirectSurveys: done('2026-10-22T12:00:00Z'), finalAttainment: available(), submission: locked('Approve the final attainment first') },
          nextAction: { step: 'FINAL_ATTAINMENT', label: 'Calculate and approve the final attainment', actor: 'FACULTY' },
        },
      }),
      base('off-cs302', 5, {
        progress: {
          phase: 'ASSESSMENTS',
          setup: setupDone,
          cycles: [
            cycle(db[0], 1, 'LAB'),
            ...db.slice(1).map((b: any, i: number) => cycle(b, i + 2, 'LOCKED', 'Waiting for ISE-1 attainment approval')),
          ],
          closeOut: closeLocked('Finish every assessment cycle first'),
          nextAction: { step: 'MARKS_UPLOAD', assessmentId: db[0].assessmentId, label: 'Waiting for the lab assistant to upload ISE-1 marks', actor: 'LAB_ASSISTANT' },
        },
      }),
      base('off-ec306', 5, {
        course: { syllabusCourseId: 'sc-ec306', courseCode: 'EC306', courseName: 'Network Security' },
        assessmentScheme: 'THEORY',
        classStrength: 30,
        division: undefined,
        progress: {
          phase: 'SETUP',
          setup: { subjectSelection: done(), assessmentPlan: done(), cam: { status: 'IN_PROGRESS', updatedAt: '2026-10-23T16:40:00Z' } },
          cycles: [
            { name: 'ISE-1', category: 'ISE', order: 1 }, { name: 'Activity 1', category: 'ACTIVITY', order: 2 },
            { name: 'ISE-2', category: 'ISE', order: 3 }, { name: 'Activity 2', category: 'ACTIVITY', order: 4 },
            { name: 'ISE-3', category: 'ISE', order: 5 }, { name: 'ESE', category: 'ESE', order: 6 },
          ].map(x => cycle({ assessmentId: `as-ns-${x.order}`, ...x }, x.order, 'LOCKED', 'Finalize the CAM first')),
          closeOut: closeLocked('Finish every assessment cycle first'),
          nextAction: { step: 'CAM', label: 'Finish and finalize the course articulation matrix', actor: 'FACULTY' },
        },
      }),
    ];
  }
}
