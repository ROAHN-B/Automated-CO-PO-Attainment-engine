import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * Hub-and-spoke routing with Authentication, Super Admin setup, and Academic Structure support.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Public Authentication Route
  {
    path: 'login',
    title: 'Institutional Login · OBE Engine',
    component: LoginComponent
  },

  /* ---------------------- MODULE 1: ADMIN SETUP SCREENS ---------------------- */
  {
    path: 'admin/institution-setup',
    title: 'Institution Setup · OBE Engine',
    loadComponent: () =>
      import('./features/admin/institution-setup/institution-setup.component').then(m => m.InstitutionSetupComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRole: 'SUPER_ADMIN' }
  },
  {
    path: 'admin/academic-config',
    title: 'Academic Configuration · OBE Engine',
    loadComponent: () =>
      import('./features/admin/academic-config/academic-config.component').then(m => m.AcademicConfigComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRole: 'SUPER_ADMIN' }
  },
  {
    path: 'admin/course-master',
    title: 'Course Master Management · OBE Engine',
    loadComponent: () =>
      import('./features/admin/course-master/course-master.component').then(m => m.CourseMasterComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRole: 'SUPER_ADMIN' }
  },
  {
    path: 'admin/curriculum-mapping',
    title: 'Curriculum Course Mapping · OBE Engine',
    loadComponent: () =>
      import('./features/admin/curriculum-mapping/curriculum-mapping.component').then(m => m.CurriculumMappingComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRole: 'SUPER_ADMIN' }
  },
  {
    path: 'admin/elective-groups',
    title: 'Elective Baskets Configuration · OBE Engine',
    loadComponent: () =>
      import('./features/admin/elective-groups/elective-groups.component').then(m => m.ElectiveGroupsComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRole: 'SUPER_ADMIN' }
  },
  {
    path: 'admin/course-offerings',
    title: 'Course Offerings & Sections · OBE Engine',
    loadComponent: () =>
      import('./features/admin/course-offerings/course-offerings.component').then(m => m.CourseOfferingsComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRole: 'SUPER_ADMIN' }
  },

  /* ----------------------------- THE HUB ----------------------------- */
  {
    path: 'faculty/dashboard',
    title: 'Dashboard · OBE Engine',
    loadComponent: () =>
      import('./features/dashboard/faculty-dashboard.component').then(m => m.FacultyDashboardComponent),
  },

  /* ---------------------------- THE SPOKES --------------------------- */
  {
    path: 'faculty/manage-references',
    title: 'Reference & Vector Manager · OBE Engine',
    loadComponent: () =>
      import('./features/knowledge-base/reference-manager.component').then(m => m.ReferenceManagerComponent),
  },
  {
    path: 'faculty/generate-questions',
    title: 'AI Question Generation · OBE Engine',
    loadComponent: () =>
      import('./features/question-gen/question-generator-wizard.component').then(m => m.QuestionGeneratorWizardComponent),
  },
  {
    path: 'faculty/calculate-attainment',
    title: 'CO-PO Attainment Engine · OBE Engine',
    loadComponent: () =>
      import('./features/attainment/attainment-calculation.component').then(m => m.AttainmentCalculationComponent),
  },
  {
    path: 'faculty/report-analysis',
    title: 'Report Analysis · OBE Engine',
    loadComponent: () =>
      import('./features/report-analysis/report-analysis.component').then(m => m.ReportAnalysisComponent),
  },
  {
    path: 'hod/dashboard',
    title: 'HOD Reviews · OBE Engine',
    loadComponent: () =>
      import('./features/analytics/components/hod-dashboard/hod-dashboard.component').then(m => m.HodDashboardComponent),
  },
  // Epic 2: Course Outcomes & Syllabus Units Management
  {
    path: 'faculty/obe-management',
    title: 'OBE Master Management · OBE Engine',
    loadComponent: () =>
      import('./features/obe/course-obe-management/course-obe-management.component').then(m => m.CourseObeManagementComponent),
  },

  /* -------------------- LEGACY PATH REDIRECTS -------------------- */
  { path: 'faculty/knowledge-base', redirectTo: 'faculty/manage-references', pathMatch: 'full' },
  { path: 'faculty/attainment', redirectTo: 'faculty/calculate-attainment', pathMatch: 'full' },
  { path: 'faculty/questions', redirectTo: 'faculty/generate-questions', pathMatch: 'full' },

  { path: '**', redirectTo: 'login' },
];