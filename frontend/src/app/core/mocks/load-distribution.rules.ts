/**
 * The backend's rules for a syllabus load distribution (API_CONTRACT v2.8 §15.4),
 * as the mock applies them: derived row fields, the section and grand totals, and
 * every blocking issue. Spring Boot implements the same rules.
 */
import {
  COMPONENT_CATEGORIES, COMPONENT_KEYS, ComponentKey, CourseGroup, LoadIssue, LoadRow, LoadTotals,
} from '../models/coordination.model';

export const BUILT_IN_GROUPS: CourseGroup[] = [
  { code: 'PCC', name: 'Programme Core Course', builtIn: true },
  { code: 'PEC', name: 'Programme Elective Course', builtIn: true },
  { code: 'MDM', name: 'Multidisciplinary Minor', builtIn: true },
  { code: 'RM', name: 'Research Methodology', builtIn: true },
  { code: 'OJT', name: 'Internship / OJT', builtIn: true },
  { code: 'CAP', name: 'Capstone Project', builtIn: true },
];

const COLUMN_LABEL: Record<ComponentKey, string> = { ese: 'ESE', oePoe: 'OE/POE', ise: 'ISE', ica: 'ICA' };
const isHalf = (n: number) => Number.isFinite(n) && Math.round(n * 2) === n * 2;
const sumItems = (items: { count: number; maxMarksEach: number }[]) => items.reduce((s, i) => s + i.count * i.maxMarksEach, 0);

/** Server-derived fields: the row total and its scheme (PRACTICAL when it has neither ESE nor ISE). */
export function deriveRow(row: LoadRow): LoadRow {
  const c = row.components;
  return {
    ...row,
    totalMarks: COMPONENT_KEYS.reduce((s, k) => s + (c[k]?.totalMarks || 0), 0),
    assessmentScheme: c.ese.totalMarks > 0 || c.ise.totalMarks > 0 ? 'THEORY' : 'PRACTICAL',
  };
}

export function loadTotals(rows: LoadRow[]): { theory: LoadTotals; laboratory: LoadTotals; grand: LoadTotals } {
  const sum = (rs: LoadRow[]): LoadTotals => ({
    lecture: rs.reduce((s, r) => s + r.hours.lecture, 0),
    tutorial: rs.reduce((s, r) => s + r.hours.tutorial, 0),
    practical: rs.reduce((s, r) => s + r.hours.practical, 0),
    credits: rs.reduce((s, r) => s + r.credits, 0),
    ese: rs.reduce((s, r) => s + r.components.ese.totalMarks, 0),
    oePoe: rs.reduce((s, r) => s + r.components.oePoe.totalMarks, 0),
    ise: rs.reduce((s, r) => s + r.components.ise.totalMarks, 0),
    ica: rs.reduce((s, r) => s + r.components.ica.totalMarks, 0),
    total: rs.reduce((s, r) => s + r.totalMarks, 0),
  });
  return {
    theory: sum(rows.filter(r => r.section === 'THEORY')),
    laboratory: sum(rows.filter(r => r.section === 'LABORATORY')),
    grand: sum(rows),
  };
}

/** Every blocking issue (§15.4.2). Rows must already carry their rowId. */
export function loadIssues(rows: LoadRow[], groupCodes: string[]): LoadIssue[] {
  if (!rows.length) return [{ code: 'EMPTY_SYLLABUS', message: 'Add the semester\'s courses.' }];
  const issues: LoadIssue[] = [];
  const codeCount = new Map<string, number>();
  for (const r of rows) {
    for (const code of [r.courseCode, ...(r.options ?? []).map(o => o.courseCode)]) {
      const k = code.trim().toUpperCase();
      if (k) codeCount.set(k, (codeCount.get(k) ?? 0) + 1);
    }
  }

  rows.forEach((r, i) => {
    const at = (field: string) => `rows[${i}].${field}`;
    const name = r.courseCode.trim() || r.courseName.trim() || `Course ${i + 1}`;
    const add = (code: LoadIssue['code'], message: string, field?: string) =>
      issues.push({ code, message: `${name}: ${message}`, rowId: r.rowId, field: field ? at(field) : undefined });

    if (!r.groupCode.trim() || !groupCodes.includes(r.groupCode)) add('MISSING_FIELD', 'pick a group.', 'groupCode');
    if (!r.courseCode.trim()) add('MISSING_FIELD', 'the course code is required.', 'courseCode');
    if (!r.courseName.trim()) add('MISSING_FIELD', 'the course name is required.', 'courseName');
    if (r.courseCode.trim() && (codeCount.get(r.courseCode.trim().toUpperCase()) ?? 0) > 1) {
      add('DUPLICATE_COURSE_CODE', `the code ${r.courseCode.trim()} is used more than once.`, 'courseCode');
    }

    const h = r.hours;
    if ([h.lecture, h.tutorial, h.practical].some(n => !Number.isInteger(n) || n < 0 || n > 20)) {
      add('INVALID_HOURS', 'L, T and P are whole numbers from 0 to 20.', 'hours');
    }
    if (!isHalf(r.credits) || r.credits < 0 || r.credits > 20) add('INVALID_CREDITS', 'credits go from 0 to 20, in halves.', 'credits');

    if (COMPONENT_KEYS.every(k => !r.components[k].totalMarks)) {
      add('NO_ASSESSMENT', 'every mark column is "--"; a course needs at least one.');
    }
    for (const k of COMPONENT_KEYS) {
      const col = r.components[k];
      const label = COLUMN_LABEL[k];
      const field = `components.${k}`;
      if (!isHalf(col.totalMarks) || col.totalMarks < 0) {
        add('COLUMN_SUM_MISMATCH', `the ${label} total must be 0 or more, in halves.`, field);
        continue;
      }
      if (!col.totalMarks) {
        if (col.items.length) add('ITEMS_WITHOUT_MARKS', `${label} is "--" but lists how its marks are earned.`, field);
        continue;
      }
      if (!col.items.length) { add('COLUMN_SUM_MISMATCH', `say how the ${label} marks are earned.`, field); continue; }
      if (col.items.some(it => !Number.isInteger(it.count) || it.count < 1 || !isHalf(it.maxMarksEach) || it.maxMarksEach <= 0)) {
        add('MISSING_FIELD', `each ${label} item needs a count of at least 1 and marks above 0.`, field);
        continue;
      }
      const bad = col.items.find(it => !COMPONENT_CATEGORIES[k].includes(it.category));
      if (bad) { add('CATEGORY_NOT_ALLOWED', `${bad.category.replace('_', '/')} can't be part of ${label}.`, field); continue; }
      if ((k === 'ese' || k === 'oePoe') && (col.items.length !== 1 || col.items[0].count !== 1)) {
        add('CATEGORY_NOT_ALLOWED', `${label} is a single exam.`, field);
        continue;
      }
      const sum = sumItems(col.items);
      if (sum !== col.totalMarks) add('COLUMN_SUM_MISMATCH', `the ${label} items add up to ${sum}, not ${col.totalMarks}.`, field);
    }

    if (r.options) {
      if (!r.options.length) add('SLOT_WITHOUT_OPTIONS', 'list the courses students can choose from.', 'options');
      else if (!r.options.some(o => o.offered)) add('NO_OFFERED_OPTION', 'tick at least one option that runs this semester.', 'options');
      r.options.forEach((o, j) => {
        if (!o.courseCode.trim() || !o.courseName.trim()) add('MISSING_FIELD', `option ${j + 1} needs a code and a name.`, `options[${j}]`);
        else if ((codeCount.get(o.courseCode.trim().toUpperCase()) ?? 0) > 1) {
          add('DUPLICATE_OPTION_CODE', `the option code ${o.courseCode.trim()} is used more than once.`, `options[${j}]`);
        }
      });
    }
  });
  return issues;
}
