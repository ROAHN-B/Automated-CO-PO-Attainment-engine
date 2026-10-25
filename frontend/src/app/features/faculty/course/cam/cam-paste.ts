import { CamCourseOutcome, CamItem, CamProgramOutcome, CamUnit } from '../../../../core/models/cam.model';
import { OutcomeKind } from '../../../../core/models/faculty-workspace.model';

/**
 * Turns text pasted from a syllabus into list entries, one per line. Leading
 * bullets and numbering are dropped; a recognisable code ("CO2", "Unit IV",
 * "PSO1") is kept, otherwise the next one in sequence is used.
 */

const SEP = /\s*(?::|\s[-–—]\s)\s*/;
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

/** Non-empty lines without bullets; numbering ("1.", "a)") is dropped too unless `keepNumbers`. */
export function pastedLines(text: string, keepNumbers = false): string[] {
  const prefix = keepNumbers ? /^\s*[-•*·]\s+/ : /^\s*(?:[-•*·]|\(?[0-9]{1,2}[.)]|\(?[a-z][.)])\s+/i;
  return text
    .split(/\r?\n/)
    .map(l => l.replace(prefix, '').trim())
    .filter(Boolean);
}

/** Splits "Title: rest" or "Title — rest" at the first separator. */
function splitTitle(line: string): [string, string] {
  const m = SEP.exec(line);
  return m ? [line.slice(0, m.index).trim(), line.slice(m.index + m[0].length).trim()] : [line.trim(), ''];
}

export function parseObjectives(text: string): string[] {
  return pastedLines(text);
}

/** One past the highest number among codes like "CO3" or "PSO2" with this prefix. */
export function nextCodeNumber(codes: string[], prefix: string): number {
  const re = new RegExp(`^${prefix}\\s*(\\d+)$`, 'i');
  return Math.max(0, ...codes.map(c => Number(re.exec(c.trim())?.[1] ?? 0))) + 1;
}

export function parseCourseOutcomes(text: string, existingCodes: string[]): CamCourseOutcome[] {
  let next = nextCodeNumber(existingCodes, 'CO');
  return pastedLines(text).map(line => {
    const m = /^CO\s*-?\s*(\d+)\s*[:.)\-–—]?\s*(.+)$/i.exec(line);
    const n = m ? Number(m[1]) : next;
    next = Math.max(next, n + 1);
    return { code: `CO${n}`, statement: m ? m[2].trim() : line };
  });
}

export function parseUnits(text: string, nextNumber: number): CamUnit[] {
  let n = nextNumber;
  return pastedLines(text, true).map(line => {
    let rest = line;
    let unitNumber = n;
    const m = /^(?:unit|module)?\s*([ivx]+|\d+)\s*[:.)\-–—]\s*(.+)$/i.exec(line);
    if (m && (/^\d+$/.test(m[1]) || ROMAN[m[1].toLowerCase()])) {
      unitNumber = /^\d+$/.test(m[1]) ? Number(m[1]) : ROMAN[m[1].toLowerCase()];
      rest = m[2];
    }
    n = unitNumber + 1;
    let hours: number | undefined;
    rest = rest.replace(/\s*\((\d{1,2})\s*(?:hours?|hrs?|h)\)\s*/i, (_, h) => { hours = Number(h); return ' '; }).trim();
    const [title, content] = splitTitle(rest);
    return { unitNumber, title, content, ...(hours ? { hours } : {}) };
  });
}

export function parseProgramOutcomes(text: string, kind: OutcomeKind, existingCodes: string[]): CamProgramOutcome[] {
  const next: Record<OutcomeKind, number> = { PO: nextCodeNumber(existingCodes, 'PO'), PSO: nextCodeNumber(existingCodes, 'PSO') };
  return pastedLines(text).map(line => {
    const m = /^(PSO|PO)\s*-?\s*(\d+)\s*[:.)\-–—]?\s*(.+)$/i.exec(line);
    const k: OutcomeKind = m ? (m[1].toUpperCase() as OutcomeKind) : kind;
    const n = m ? Number(m[2]) : next[k];
    next[k] = Math.max(next[k], n + 1);
    const code = `${k}${n}`;
    const [first, second] = splitTitle(m ? m[3] : line);
    return second ? { kind: k, code, title: first, statement: second } : { kind: k, code, statement: first };
  });
}

export function parseItems(text: string): CamItem[] {
  return pastedLines(text).map(line => {
    const [title, description] = splitTitle(line);
    return { title, ...(description ? { description } : {}), coIds: [] };
  });
}
