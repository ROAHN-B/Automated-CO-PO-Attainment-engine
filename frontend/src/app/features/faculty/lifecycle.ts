/**
 * Presentation helpers for the faculty course lifecycle (API_CONTRACT §7.1).
 * Pure reshaping of what the backend sends — no lock or status is decided here.
 */
import { AssessmentCycle, FacultyOffering, OfferingProgress, StepKey, StepState } from '../../core/models/faculty-workspace.model';

export interface LifecycleStep {
  key: StepKey;
  label: string;
  state: StepState;
  assessmentId?: string;
  /** Router commands relative to the course workspace, plus query params. */
  link: { path: string[]; query?: Record<string, string> };
}

export interface LifecycleGroup {
  id: string;
  title: string;
  /** For assessment cycles: the cycle's position, e.g. 1 for ISE-1. */
  order?: number;
  subtitle?: string;
  steps: LifecycleStep[];
}

export const STEP_LABELS: Record<StepKey, string> = {
  SUBJECT_SELECTION: 'Subject selection',
  ASSESSMENT_PLAN: 'Assessment plan',
  CAM: 'Course articulation matrix',
  PAPER_VALIDATION: 'Question paper validation',
  MARKSHEET: 'Marksheet',
  MARKS_UPLOAD: 'Marks upload (lab assistant)',
  MARKS_APPROVAL: 'Marks approval',
  ATTAINMENT_APPROVAL: 'CO-PO attainment',
  INDIRECT_SURVEYS: 'Indirect surveys',
  FINAL_ATTAINMENT: 'Final attainment',
  SUBMISSION: 'Submit to HOD',
};

/** What each step is for — shown on step screens and in the overview. */
export const STEP_PURPOSE: Record<StepKey, string> = {
  SUBJECT_SELECTION: 'Confirm the allocated subject, semester and class for this course.',
  ASSESSMENT_PLAN: 'List every ISE, activity or practical and the end-semester exam, with marks and COs.',
  CAM: 'Set Bloom level and expected percentages per CO, then map each CO to POs and PSOs.',
  PAPER_VALIDATION: 'Upload the question paper and review the AI check of CO and Bloom alignment.',
  MARKSHEET: 'Define questions, marks and COs, then download the template for the lab assistant.',
  MARKS_UPLOAD: 'The lab assistant fills the marksheet and uploads it to you for review.',
  MARKS_APPROVAL: 'Check the uploaded marks and approve them into the workbook.',
  ATTAINMENT_APPROVAL: 'Calculate cumulative CO-PO attainment, review every step and approve it.',
  INDIRECT_SURVEYS: 'Enter course exit, examiner and additional survey scores for each CO.',
  FINAL_ATTAINMENT: 'Calculate the final attainment with every assessment and the surveys, then approve it.',
  SUBMISSION: 'Submit the approved final attainment to your head of department.',
};

function stepLink(key: StepKey, assessmentId?: string): LifecycleStep['link'] {
  if (key === 'ATTAINMENT_APPROVAL' && assessmentId) return { path: ['attainment'], query: { upTo: assessmentId } };
  if (key === 'FINAL_ATTAINMENT') return { path: ['attainment'], query: { final: '1' } };
  return { path: ['step', key.toLowerCase()], query: assessmentId ? { assessment: assessmentId } : undefined };
}

function step(key: StepKey, state: StepState, assessmentId?: string): LifecycleStep {
  return { key, label: STEP_LABELS[key], state, assessmentId, link: stepLink(key, assessmentId) };
}

export function cycleSteps(c: AssessmentCycle): LifecycleStep[] {
  const s = c.steps;
  return [
    ...(s.paperValidation ? [step('PAPER_VALIDATION', s.paperValidation, c.assessmentId)] : []),
    step('MARKSHEET', s.marksheet, c.assessmentId),
    step('MARKS_UPLOAD', s.marksUpload, c.assessmentId),
    step('MARKS_APPROVAL', s.marksApproval, c.assessmentId),
    step('ATTAINMENT_APPROVAL', s.attainmentApproval, c.assessmentId),
  ];
}

export function lifecycleGroups(p: OfferingProgress): LifecycleGroup[] {
  return [
    {
      id: 'setup', title: 'Setup',
      steps: [
        step('SUBJECT_SELECTION', p.setup.subjectSelection),
        step('ASSESSMENT_PLAN', p.setup.assessmentPlan),
        step('CAM', p.setup.cam),
      ],
    },
    ...p.cycles.map(c => ({
      id: c.assessmentId, title: c.name, order: c.order,
      subtitle: c.requiresPaperValidation ? 'Exam' : categoryLabel(c.category),
      steps: cycleSteps(c),
    })),
    {
      id: 'close-out', title: 'Close-out',
      steps: [
        step('INDIRECT_SURVEYS', p.closeOut.indirectSurveys),
        step('FINAL_ATTAINMENT', p.closeOut.finalAttainment),
        step('SUBMISSION', p.closeOut.submission),
      ],
    },
  ];
}

export function groupStatus(g: LifecycleGroup): 'DONE' | 'ACTIVE' | 'LOCKED' {
  if (g.steps.every(s => s.state.status === 'DONE')) return 'DONE';
  if (g.steps.some(s => s.state.status === 'AVAILABLE' || s.state.status === 'IN_PROGRESS')) return 'ACTIVE';
  return 'LOCKED';
}

/** Counts for the dashboard's progress strip. */
export function stepCounts(p: OfferingProgress): { done: number; total: number } {
  const all = lifecycleGroups(p).flatMap(g => g.steps);
  return { done: all.filter(s => s.state.status === 'DONE').length, total: all.length };
}

export function nextActionLink(o: FacultyOffering): LifecycleStep['link'] | null {
  const a = o.progress.nextAction;
  return a ? stepLink(a.step, a.assessmentId) : null;
}

export function phaseLabel(phase: OfferingProgress['phase']): string {
  return { SETUP: 'Setup', ASSESSMENTS: 'Assessment cycles', CLOSE_OUT: 'Close-out', SUBMITTED: 'Submitted' }[phase];
}

export function categoryLabel(cat: string): string {
  return ({
    ISE: 'In-semester exam', ESE: 'End-semester exam', ACTIVITY: 'Activity', PRACTICAL: 'Practical',
    TUTORIAL: 'Tutorial', POE: 'Practical-oral exam', OE: 'Oral exam', OE_POE: 'Oral / practical-oral exam',
  } as Record<string, string>)[cat] ?? cat;
}

export function stepKeyFromParam(param: string | null): StepKey | null {
  const k = (param ?? '').toUpperCase() as StepKey;
  return k in STEP_LABELS ? k : null;
}
