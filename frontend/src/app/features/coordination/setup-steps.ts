/**
 * Presentation helpers for the coordinator's semester setup (API_CONTRACT §15.1).
 * They label and order what the backend returns; they never decide a step's state.
 */
import { SemesterSetup, SetupStepKey } from '../../core/models/coordination.model';
import { StepState } from '../../core/models/faculty-workspace.model';

/** "Semester" is the creation step the UI shows before the backend's steps. */
export type SetupStepId = 'SEMESTER' | SetupStepKey;

export const SETUP_STEP_ORDER: SetupStepId[] = ['SEMESTER', 'FACULTY', 'SYLLABUS', 'OUTCOMES', 'DECLARATION', 'ALLOCATION', 'COMPLETE'];

export const SETUP_STEP_LABELS: Record<SetupStepId, string> = {
  SEMESTER: 'Semester',
  FACULTY: 'Faculty',
  SYLLABUS: 'Syllabus load distribution',
  OUTCOMES: 'POs and PSOs',
  DECLARATION: 'Declaration',
  ALLOCATION: 'Subject allocation',
  COMPLETE: 'Complete and notify',
};

export const SETUP_STEP_PURPOSE: Record<SetupStepId, string> = {
  SEMESTER: 'The academic year, semester and divisions this setup covers.',
  FACULTY: 'The department\'s faculty, typed in or imported from Excel. The list is shared by every semester.',
  SYLLABUS: 'Every course of the semester in the college\'s load distribution format: hours, credits and how each mark column is earned.',
  OUTCOMES: 'The 11 POs shared by all departments and this department\'s 3 PSOs.',
  DECLARATION: 'Confirm the load distribution matches the official syllabus. It locks once declared.',
  ALLOCATION: 'Give every subject, and every division, a faculty member.',
  COMPLETE: 'Check everything is assigned, then email each faculty member their subjects.',
};

export interface SetupStepView {
  id: SetupStepId;
  number: number;
  label: string;
  state: StepState;
  /** The step to work on next. */
  current: boolean;
  /** URL segment under …/semesters/:setupId/step/ */
  param: string;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const roman = (n: number): string => ROMAN[n] ?? String(n);

export function yearOfStudy(semesterNumber: number): string {
  return semesterNumber <= 2 ? 'First year' : semesterNumber <= 4 ? 'Second year' : semesterNumber <= 6 ? 'Third year' : 'Final year';
}

export function termOf(semesterNumber: number): string {
  return semesterNumber % 2 === 1 ? 'Odd term' : 'Even term';
}

export const stepParam = (id: SetupStepId): string => id.toLowerCase();

export function stepFromParam(param: string | null): SetupStepId | null {
  const id = (param ?? '').toUpperCase() as SetupStepId;
  return SETUP_STEP_ORDER.includes(id) ? id : null;
}

/** The backend's steps with the creation step in front; the first unfinished one is current. */
export function setupSteps(setup: SemesterSetup): SetupStepView[] {
  const states: { id: SetupStepId; state: StepState }[] = [
    { id: 'SEMESTER', state: { status: 'DONE' } },
    ...setup.steps.map(s => ({ id: s.key as SetupStepId, state: s.state })),
  ];
  const currentIndex = states.findIndex(s => s.state.status !== 'DONE');
  return states.map((s, i) => ({
    id: s.id,
    number: i + 1,
    label: SETUP_STEP_LABELS[s.id],
    state: s.state,
    current: i === currentIndex,
    param: stepParam(s.id),
  }));
}

/** 1-based position of a step in the seven shown to the coordinator. */
export const stepNumber = (id: SetupStepId): number => SETUP_STEP_ORDER.indexOf(id) + 1;
