/**
 * Presentation helpers for the syllabus load distribution (API_CONTRACT §15.4).
 * Labels and formatting only: totals, schemes and issues come from the backend.
 */
import { ComponentConfig, ComponentKey, LoadRow } from '../../../core/models/coordination.model';
import { AssessmentCategory } from '../../../core/models/faculty-workspace.model';

export const COLUMN_LABELS: Record<ComponentKey, string> = { ese: 'ESE', oePoe: 'OE/POE', ise: 'ISE', ica: 'ICA' };

/** What each column means, for the row editor. */
export const COLUMN_HELP: Record<ComponentKey, string> = {
  ese: 'End-semester theory exam (FA).',
  oePoe: 'Oral or practical-oral exam (FA).',
  ise: 'In-semester tests and activities (SA).',
  ica: 'Internal continuous assessment: activities, practicals, tutorials (SA).',
};

const CATEGORY_NAMES: Record<AssessmentCategory, [string, string]> = {
  ISE: ['ISE test', 'ISE tests'],
  ACTIVITY: ['activity', 'activities'],
  PRACTICAL: ['practical', 'practicals'],
  TUTORIAL: ['tutorial', 'tutorials'],
  ESE: ['ESE paper', 'ESE papers'],
  POE: ['POE', 'POEs'],
  OE: ['OE', 'OEs'],
  OE_POE: ['OE/POE', 'OE/POEs'],
};

export function categoryName(category: AssessmentCategory, count = 1): string {
  return CATEGORY_NAMES[category][count === 1 ? 0 : 1];
}

/** For a select: "ISE tests", "Activities"… */
export function categoryOption(category: AssessmentCategory): string {
  const plural = CATEGORY_NAMES[category][1];
  return plural.charAt(0).toUpperCase() + plural.slice(1);
}

/** "2 ISE tests × 15 + 2 activities × 5" */
export function itemsSummary(col: ComponentConfig): string {
  return col.items.map(i => `${i.count} ${categoryName(i.category, i.count)} × ${i.maxMarksEach}`).join(' + ');
}

/** The college prints "--" for zero. */
export const dash = (n: number): string => (n ? String(n) : '--');

export function blankRow(section: LoadRow['section']): LoadRow {
  const none = { totalMarks: 0, items: [] };
  return {
    section, groupCode: 'PCC', courseCode: '', courseName: '',
    hours: { lecture: 0, tutorial: 0, practical: section === 'LABORATORY' ? 2 : 0 }, credits: 0,
    components: { ese: { ...none }, oePoe: { ...none }, ise: { ...none }, ica: { ...none } },
    totalMarks: 0, assessmentScheme: section === 'LABORATORY' ? 'PRACTICAL' : 'THEORY', needsFaculty: true,
  };
}
