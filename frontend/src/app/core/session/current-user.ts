/**
 * The signed-in user.
 *
 * Single source of truth for identity across the shell (sidebar profile card)
 * and the hub (welcome banner), so the two can never disagree.
 *
 * MOCK today. When Abhijeet ships the session endpoint this becomes a small
 * SessionService exposing `profile: Signal<FacultyProfile | null>`; the shape
 * below is the contract it should satisfy.
 */
export interface FacultyProfile {
  name: string;
  /** Avatar monogram. */
  initials: string;
  role: string;
  department: string;
  /** Active teaching semester, e.g. "ODD 2026". */
  semester: string;
}

export const CURRENT_USER: FacultyProfile = {
  name: 'Rohan',
  initials: 'R',
  role: 'Faculty',
  department: 'Electronics and Computer Engineering',
  semester: 'ODD 2026',
};
