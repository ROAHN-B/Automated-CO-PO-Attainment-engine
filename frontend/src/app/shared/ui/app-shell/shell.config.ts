import { IconName } from '../icons';

export interface ShellNavItem {
  label: string;
  route: string;
  icon: IconName;
}

export interface ShellNavSection {
  /** Omit for the first, unlabelled group. */
  label?: string;
  items: ShellNavItem[];
}

export interface ShellUser {
  name: string;
  initials: string;
  role: string;
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
  user: { name: 'Rohan', initials: 'R', role: 'Faculty · ECE' },
  sections: [
    {
      items: [{ label: 'Overview', route: '/faculty/dashboard', icon: 'home' }],
    },
    {
      label: 'Teaching',
      items: [
        { label: 'Reference library', route: '/faculty/knowledge-base', icon: 'stack' },
        { label: 'Question generator', route: '/faculty/ai-generator', icon: 'sparkles' },
      ],
    },
    {
      label: 'Outcomes',
      items: [
        { label: 'CO-PO attainment', route: '/faculty/attainment', icon: 'chart' },
        { label: 'Report analysis', route: '/faculty/reports', icon: 'presentation' },
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
      label: 'Academic structure',
      items: [
        { label: 'Years & semesters', route: '/admin/academic-config', icon: 'calendar' },
        { label: 'Course catalogue', route: '/admin/courses', icon: 'book' },
        { label: 'Curriculum', route: '/admin/curriculum', icon: 'table' },
        { label: 'Elective groups', route: '/admin/electives', icon: 'tag' },
        { label: 'Course offerings', route: '/admin/offerings', icon: 'squares' },
      ],
    },
    {
      label: 'Outcomes',
      items: [
        { label: 'POs & PSOs', route: '/admin/po-pso-management', icon: 'shield' },
        { label: 'Course outcomes', route: '/admin/course-master', icon: 'document' },
        { label: 'CO-PO mapping', route: '/admin/co-po-mapping', icon: 'link' },
      ],
    },
  ],
};

export const LAB_SHELL: ShellConfig = {
  portal: 'Lab assistant',
  user: { name: 'Lab Assistant', initials: 'L', role: 'Lab assistant · ECE' },
  sections: [
    {
      items: [{ label: 'Marksheet upload', route: '/lab-assistant/marks-upload', icon: 'upload' }],
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
