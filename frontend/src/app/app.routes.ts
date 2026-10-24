import { Routes } from '@angular/router';
import { AppShellComponent } from './shared/ui/app-shell/app-shell.component';
import { ADMIN_SHELL, FACULTY_SHELL, HOD_SHELL, LAB_SHELL } from './shared/ui/app-shell/shell.config';

/**
 * Every portal renders inside the same AppShellComponent; only `data.shell`
 * (portal name, navigation, user card) differs. See shell.config.ts.
 */
export const routes: Routes = [
  // =========================================================
  // 1. UNIVERSAL LOGIN ROUTE
  // =========================================================
  {
    path: 'login',
    title: 'Sign in · OBE Engine',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },

  // =========================================================
  // 2. LAB ASSISTANT PORTAL
  // =========================================================
  {
    path: 'lab-assistant',
    component: AppShellComponent,
    data: { shell: LAB_SHELL },
    children: [
      { path: '', redirectTo: 'marks-upload', pathMatch: 'full' },
      {
        path: 'marks-upload',
        title: 'Marksheet upload · OBE Engine',
        loadComponent: () => import('./features/lab-assistant/lab-assistant-dashboard.component').then(m => m.LabAssistantDashboardComponent)
      }
    ]
  },

  // =========================================================
  // 3. SUPER ADMIN PORTAL
  // =========================================================
  {
    path: 'admin',
    title: 'Administration · OBE Engine',
    component: AppShellComponent,
    data: { shell: ADMIN_SHELL },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/admin/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'institution-setup', loadComponent: () => import('./features/admin/institution-setup/institution-setup.component').then(m => m.InstitutionSetupComponent) },
      { path: 'academic-config', loadComponent: () => import('./features/admin/academic-config/academic-config.component').then(m => m.AcademicConfigComponent) },
      { path: 'courses', loadComponent: () => import('./features/admin/course-master/course-master.component').then(m => m.CourseMasterComponent) },
      { path: 'curriculum', loadComponent: () => import('./features/admin/curriculum-mapping/curriculum-mapping.component').then(m => m.CurriculumMappingComponent) },
      { path: 'electives', loadComponent: () => import('./features/admin/elective-groups/elective-groups.component').then(m => m.ElectiveGroupsComponent) },
      { path: 'offerings', loadComponent: () => import('./features/admin/course-offerings/course-offerings.component').then(m => m.CourseOfferingsComponent) },
      { path: 'po-pso-management', loadComponent: () => import('./features/obe/po-pso-management/po-pso-management.component').then(m => m.PoPsoManagementComponent) },
      { path: 'course-master', loadComponent: () => import('./features/obe/course-obe-management/course-obe-management.component').then(m => m.CourseObeManagementComponent) },
      { path: 'co-po-mapping', loadComponent: () => import('./features/obe/co-po-mapping/co-po-mapping.component').then(m => m.CoPoMappingComponent) }
    ]
  },

  // =========================================================
  // 4. FACULTY WORKSPACE (coordinator screens will join this portal)
  // =========================================================
  {
    path: 'faculty',
    title: 'Faculty · OBE Engine',
    component: AppShellComponent,
    data: { shell: FACULTY_SHELL },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/faculty/dashboard/faculty-dashboard.component').then(m => m.FacultyDashboardComponent) },
      {
        // Course workspace — strictly ordered lifecycle, live workbook, attainment (API_CONTRACT v2.2 §7, §14)
        path: 'courses/:offeringId',
        loadComponent: () => import('./features/faculty/course/course-workspace.component').then(m => m.CourseWorkspaceComponent),
        children: [
          { path: '', title: 'Course · OBE Engine', loadComponent: () => import('./features/faculty/course/course-overview.component').then(m => m.CourseOverviewComponent) },
          { path: 'workbook', title: 'Course workbook · OBE Engine', loadComponent: () => import('./features/faculty/course/course-workbook.component').then(m => m.CourseWorkbookComponent) },
          { path: 'attainment', title: 'CO-PO attainment · OBE Engine', loadComponent: () => import('./features/faculty/course/attainment-calculation.component').then(m => m.AttainmentCalculationComponent) },
          { path: 'step/:stepKey', loadComponent: () => import('./features/faculty/course/course-step.component').then(m => m.CourseStepComponent) }
        ]
      },
      { path: 'courses', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'knowledge-base', loadComponent: () => import('./features/knowledge-base/reference-manager.component').then(m => m.ReferenceManagerComponent) },
      { path: 'ai-generator', loadComponent: () => import('./features/question-gen/question-generator-wizard.component').then(m => m.QuestionGeneratorWizardComponent) }
    ]
  },

  // =========================================================
  // 5. HOD / ANALYTICS PORTAL
  // =========================================================
  {
    path: 'analytics',
    title: 'Department overview · OBE Engine',
    component: AppShellComponent,
    data: { shell: HOD_SHELL },
    children: [
      { path: '', redirectTo: 'hod-dashboard', pathMatch: 'full' },
      { path: 'hod-dashboard', loadComponent: () => import('./features/analytics/components/hod-dashboard/hod-dashboard.component').then(m => m.HodDashboardComponent) }
    ]
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
