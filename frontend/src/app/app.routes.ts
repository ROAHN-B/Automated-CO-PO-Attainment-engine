import { Routes } from '@angular/router';
import { AppShellComponent } from './shared/ui/app-shell/app-shell.component';
import { ADMIN_SHELL, FACULTY_SHELL, HOD_SHELL } from './shared/ui/app-shell/shell.config';
import { coordinatorGuard } from './core/guards/coordinator.guard';

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
  // 2. SUPER ADMIN PORTAL
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
      { path: 'academic-config', loadComponent: () => import('./features/admin/academic-config/academic-config.component').then(m => m.AcademicConfigComponent) }
    ]
  },

  // =========================================================
  // 3. FACULTY WORKSPACE (with the coordinator's screens under /faculty/coordination)
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
          { path: 'step/subject_selection', title: 'Accept allocation · OBE Engine', loadComponent: () => import('./features/faculty/course/accept-allocation.component').then(m => m.AcceptAllocationComponent) },
          { path: 'step/assessment_plan', title: 'Assessment plan · OBE Engine', loadComponent: () => import('./features/faculty/course/assessment-plan.component').then(m => m.AssessmentPlanComponent) },
          { path: 'step/cam', title: 'Course articulation matrix · OBE Engine', loadComponent: () => import('./features/faculty/course/cam/cam-editor.component').then(m => m.CamEditorComponent) },
          { path: 'step/marksheet', title: 'Marksheet · OBE Engine', loadComponent: () => import('./features/faculty/course/marksheet/marksheet.component').then(m => m.MarksheetComponent) },
          { path: 'step/paper_validation', title: 'Question paper validation · OBE Engine', loadComponent: () => import('./features/faculty/course/paper/question-paper.component').then(m => m.QuestionPaperComponent) },
          { path: 'step/:stepKey', loadComponent: () => import('./features/faculty/course/course-step.component').then(m => m.CourseStepComponent) }
        ]
      },
      { path: 'courses', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        // Coordinator: semester setup for their department (API_CONTRACT v2.8 §15)
        path: 'coordination',
        canActivate: [coordinatorGuard],
        children: [
          { path: '', redirectTo: 'semesters', pathMatch: 'full' },
          { path: 'semesters', title: 'Semester setup · OBE Engine', loadComponent: () => import('./features/coordination/coordination-dashboard.component').then(m => m.CoordinationDashboardComponent) },
          { path: 'faculty', title: 'Faculty · OBE Engine', loadComponent: () => import('./features/coordination/faculty/faculty-list.component').then(m => m.FacultyListComponent) },
          { path: 'outcomes', title: 'POs and PSOs · OBE Engine', loadComponent: () => import('./features/coordination/outcomes/outcomes.component').then(m => m.OutcomesComponent) },
          {
            path: 'semesters/:setupId',
            loadComponent: () => import('./features/coordination/setup/semester-setup.component').then(m => m.SemesterSetupComponent),
            children: [
              { path: '', loadComponent: () => import('./features/coordination/setup/setup-step.component').then(m => m.SetupLandingComponent) },
              { path: 'step/semester', title: 'Semester · OBE Engine', loadComponent: () => import('./features/coordination/setup/semester-details.component').then(m => m.SemesterDetailsComponent) },
              { path: 'step/faculty', title: 'Faculty · OBE Engine', loadComponent: () => import('./features/coordination/faculty/faculty-list.component').then(m => m.FacultyListComponent) },
              { path: 'step/syllabus', title: 'Syllabus load distribution · OBE Engine', loadComponent: () => import('./features/coordination/syllabus/load-distribution.component').then(m => m.LoadDistributionComponent) },
              { path: 'step/outcomes', title: 'POs and PSOs · OBE Engine', loadComponent: () => import('./features/coordination/outcomes/outcomes.component').then(m => m.OutcomesComponent) },
              { path: 'step/declaration', title: 'Declaration · OBE Engine', loadComponent: () => import('./features/coordination/syllabus/declaration.component').then(m => m.DeclarationComponent) },
              { path: 'step/allocation', title: 'Subject allocation · OBE Engine', loadComponent: () => import('./features/coordination/allocation/allocation.component').then(m => m.AllocationComponent) },
              { path: 'step/complete', title: 'Complete and notify · OBE Engine', loadComponent: () => import('./features/coordination/allocation/complete.component').then(m => m.CompleteAllocationComponent) },
              { path: 'step/:stepKey', title: 'Semester setup · OBE Engine', loadComponent: () => import('./features/coordination/setup/setup-step.component').then(m => m.SetupStepComponent) }
            ]
          }
        ]
      }
    ]
  },

  // =========================================================
  // 4. HOD / ANALYTICS PORTAL
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
