/**
 * The college's ISE "Question Paper Moderation Sheet" (API_CONTRACT v2.7 §10.7.7),
 * as the mock's stand-in for QPV-5. The backend renders the real .docx and .pdf;
 * the demo returns the same layout as HTML that Word opens (DOCX) or that the
 * browser prints (PDF). Only the paper setter's part is filled: moderation is
 * done by hand on the printout.
 */
import { QpPaper, qpQuestionMarks, qpSubQuestionsOf } from '../models/question-paper.model';

/** Course, class and faculty details printed on the sheet. */
export interface ModerationSheetContext {
  institution: string;          // "Walchand Institute of Technology, Solapur"
  department: string;           // "Electronics and Computer Engineering"
  semesterNumber: number;       // 7 → "Odd Semester", "VII"
  academicYear: string;         // "2026-27"
  yearOfStudy: string;          // "Final Year"
  courseCode: string;
  courseName: string;
  setterName: string;
  /** When the faculty confirmed the paper; blank on the sheet before that. */
  submittedOn?: string;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const roman = (n: number) => ROMAN[n] ?? String(n);
const qNumber = (questionNo: string) => questionNo.replace(/^q\s*/i, '');
const coNumber = (code: string) => code.replace(/^co\s*/i, '');

/** "06 Oct 2025" */
export function sheetDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Item 5: one column per main question, with its COs and its marks (attempt rule applied). */
export function markingScheme(paper: QpPaper): { q: string; co: string; marks: number }[] {
  const code = (id?: string) => paper.courseOutcomes.find(c => c.coId === id)?.code ?? '';
  return paper.questions.map(q => {
    const cos = [...new Set(qpSubQuestionsOf(q).map(x => code(x.part?.coId ?? q.coId)).filter(Boolean))];
    return { q: qNumber(q.questionNo), co: cos.map(coNumber).join(', '), marks: qpQuestionMarks(q) };
  });
}

/** Table 2 rows: "Q 1-i"; the part letter only when sub-question labels repeat across parts. */
export function moderationRowLabels(paper: QpPaper): string[] {
  return paper.questions.flatMap(q => {
    const subs = qpSubQuestionsOf(q);
    const labels = subs.map(x => x.sub.label.trim().toLowerCase());
    const unique = new Set(labels).size === labels.length;
    return subs.map(({ part, sub }) =>
      `Q ${qNumber(q.questionNo)}-${part && !unique ? `${part.label}-` : ''}${sub.label}`);
  });
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function moderationSheetHtml(ctx: ModerationSheetContext, paper: QpPaper, printable: boolean): string {
  const iseNo = roman(Number(/(\d+)/.exec(paper.assessmentName)?.[1] ?? 0));
  const scheme = markingScheme(paper);
  const columns = Math.max(6, scheme.length);
  const cells = (pick: (s: { q: string; co: string; marks: number }) => string | number) =>
    Array.from({ length: columns }, (_, i) => `<td class="c">${scheme[i] ? esc(String(pick(scheme[i]))) : ''}</td>`).join('');
  const rows = moderationRowLabels(paper);
  const parity = ctx.semesterNumber % 2 === 1 ? 'Odd' : 'Even';
  const ay = ctx.academicYear.replace(/^(\d{4})-(\d{2})(\d{2})$/, '$1-$3');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(ctx.courseCode)} ${esc(paper.assessmentName)} moderation sheet</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #000; margin: 0; }
  h1 { font-size: 14pt; text-align: center; margin: 0; line-height: 1.25; }
  table { width: 100%; border-collapse: collapse; margin-top: 10pt; }
  td, th { border: 1px solid #000; padding: 3pt 5pt; vertical-align: top; }
  .n { width: 22pt; text-align: center; }
  .c { text-align: center; min-width: 26pt; }
  .head { text-align: center; font-weight: bold; }
  .inner { margin: 4pt 0 0; }
  .inner td { padding: 2pt 4pt; }
  .inner td:first-child { white-space: nowrap; }
  .q { width: 70pt; text-align: center; height: 20pt; }
  .map { width: 120pt; }
  .sign { border: 0; width: 50%; padding-top: 34pt; }
</style></head>
<body>
<h1>${esc(ctx.institution)}<br>${esc(ctx.department)}, ${parity} Semester, ${esc(ay)}<br>In Semester Examination Test Question Paper Moderation Sheet</h1>

<table>
  <tr><td colspan="4" class="head">Self-Assessment by Paper Setter</td></tr>
  <tr><td class="n">1</td><td>ISE Test: I / II / III : <b>${iseNo}</b></td><td class="n">2</td><td>Course: <b>${esc(ctx.courseName)}</b></td></tr>
  <tr><td class="n">3</td><td>Class and Semester: <b>${esc(ctx.yearOfStudy)} - ${roman(ctx.semesterNumber)}</b></td><td class="n">4</td><td>Course Code: ${esc(ctx.courseCode)}</td></tr>
  <tr>
    <td class="n">5</td>
    <td>Marking Scheme:
      <table class="inner">
        <tr><td>Q. No.</td>${cells(s => s.q)}</tr>
        <tr><td>CO</td>${cells(s => s.co)}</tr>
        <tr><td>Marks</td>${cells(s => s.marks)}</tr>
      </table>
    </td>
    <td colspan="2" style="padding:0">
      <table style="margin:0;border:0">
        <tr><td class="n" style="border-top:0;border-left:0">6</td><td style="border-top:0;border-right:0">Total number of Questions: ${String(scheme.length).padStart(2, '0')}</td></tr>
        <tr><td class="n" style="border-left:0">7</td><td style="border-right:0">Date of Submission of Question Paper: ${sheetDate(ctx.submittedOn)}</td></tr>
        <tr><td class="n" style="border-left:0;border-bottom:0">8</td><td style="border-right:0;border-bottom:0">Date of Moderation:</td></tr>
      </table>
    </td>
  </tr>
</table>

<table>
  <tr><td colspan="5" class="head">Assessment by Subject Expert/Moderator</td></tr>
  <tr>
    <td class="n" rowspan="${rows.length + 1}">1</td>
    <td class="q">Question No.</td>
    <td class="map">IS mapping of question is appropriate with CO? [Mark Yes /No / Suggestion ]</td>
    <td class="n" rowspan="${rows.length + 1}">2</td>
    <td rowspan="${rows.length + 1}">Corrections, if any:<br><br><br><br><br><br>Suggestions, if any:<br><br><br><br><br><br>Incorporation of suggestions:</td>
  </tr>
  ${rows.map(r => `<tr><td class="q">${esc(r)}</td><td class="map"></td></tr>`).join('\n  ')}
</table>

<table>
  <tr>
    <td class="sign"><i>${esc(ctx.setterName)}</i><br>Name and Signature of<br>Question Paper Setter</td>
    <td class="sign"><br>Name and Signature of<br>Subject Experts/Moderators</td>
  </tr>
</table>
${printable ? '<script>window.addEventListener("load", () => window.print());</script>' : ''}
</body></html>`;
}
