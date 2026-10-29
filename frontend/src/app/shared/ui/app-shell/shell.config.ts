import { IconName } from '../icons';

export interface ShellNavItem {
  label: string;
  route: string;
  icon: IconName;
}

export interface ShellNavSection {
  /** Omit for the first, unlabelled group. */
  label?: string;
  /** Shown only to users holding this role (e.g. COORDINATOR). The server still checks every call. */
  requiresRole?: string;
  items: ShellNavItem[];
}

export interface ShellUser {
  name: string;
  initials: string;
  role: string;
  /** Role line to show instead of `role` when the user holds the given role, e.g. COORDINATOR. */
  roleLabels?: Record<string, string>;
}

/** Everything the shared shell needs to render one portal. Passed via route `data.shell`. */
export interface ShellConfig {
  portal: string;
  sections: ShellNavSection[];
  /**
   * MOCK until AUTH-4 (`GET /auth/me`, see API_CONTRACT.md §5) is wired —
   * then the shell reads the signed-in user from the session instead.
   */
  user: ShellUser;
}

export const FACULTY_SHELL: ShellConfig = {
  portal: 'Faculty',
  user: { name: 'Rohan', initials: 'R', role: 'Faculty · ECE', roleLabels: { COORDINATOR: 'Coordinator · ECE' } },
  sections: [
    {
      // "My courses" lives on the dashboard; each course opens its own workspace.
      items: [{ label: 'My courses', route: '/faculty/dashboard', icon: 'home' }],
    },
    {
      // The department coordinator's screens (API_CONTRACT §15), inside the faculty portal.
      label: 'Coordination',
      requiresRole: 'COORDINATOR',
      items: [
        { label: 'Semester setup', route: '/faculty/coordination/semesters', icon: 'calendar' },
        { label: 'Faculty', route: '/faculty/coordination/faculty', icon: 'users' },
        { label: 'POs & PSOs', route: '/faculty/coordination/outcomes', icon: 'shield' },
      ],
    },
  ],
};

export const ADMIN_SHELL: ShellConfig = {
  portal: 'Administration',
  user: { name: 'Administrator', initials: 'A', role: 'Super admin' },
  sections: [
    {
      items: [
        { label: 'Overview', route: '/admin/dashboard', icon: 'home' },
        { label: 'Institution', route: '/admin/institution-setup', icon: 'building' },
      ],
    },
    {
      // Semesters, syllabi, courses, offerings and POs/PSOs belong to each department's coordinator (API_CONTRACT §15, §16).
      label: 'Setup',
      items: [
        { label: 'Academic structure', route: '/admin/academic-config', icon: 'calendar' },
        { label: 'Users and roles', route: '/admin/users', icon: 'users' },
      ],
    },
  ],
};

export const HOD_SHELL: ShellConfig = {
  portal: 'Head of department',
  user: { name: 'Head of Department', initials: 'H', role: 'HOD · ECE' },
  sections: [
    {
      items: [{ label: 'Department overview', route: '/analytics/hod-dashboard', icon: 'chart' }],
    },
  ],
};
