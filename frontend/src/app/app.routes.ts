import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * Hub-and-spoke routing with Authentication and Super Admin support.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Public Authentication Route
  {
    path: 'login',
    title: 'Institutional Login · OBE Engine',
    component: LoginComponent
  },

  // Super Admin Protected Route
  {
    path: 'admin/institution-setup',
    title: 'Institution Setup · OBE Engine',
    loadComponent: () =>
      import('./features/admin/institution-setup/institution-setup.component').then(m => m.InstitutionSetupComponent),
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
  // Feature 1 — upload syllabus docs/notes once per unit, build RAG embeddings.
  {
    path: 'faculty/manage-references',
    title: 'Reference & Vector Manager · OBE Engine',
    loadComponent: () =>
      import('./features/knowledge-base/reference-manager.component').then(m => m.ReferenceManagerComponent),
  },
  // Feature 2 — unit → blueprint → CO mapping → generate → select → export.
  {
    path: 'faculty/generate-questions',
    title: 'AI Question Generation · OBE Engine',
    loadComponent: () =>
      import('./features/question-gen/question-generator-wizard.component').then(m => m.QuestionGeneratorWizardComponent),
  },
  // Feature 3 — assessment marks → CO/PO attainment against thresholds.
  {
    path: 'faculty/calculate-attainment',
    title: 'CO-PO Attainment Engine · OBE Engine',
    loadComponent: () =>
      import('./features/attainment/attainment-calculation.component').then(m => m.AttainmentCalculationComponent),
  },
  // Feature 4 — AI gap analysis + qualitative course performance reporting.
  {
    path: 'faculty/report-analysis',
    title: 'Report Analysis · OBE Engine',
    loadComponent: () =>
      import('./features/report-analysis/report-analysis.component').then(m => m.ReportAnalysisComponent),
  },
  // Feature 5 — HOD approvals and audit locks (separate role scope).
  {
    path: 'hod/dashboard',
    title: 'HOD Reviews · OBE Engine',
    loadComponent: () =>
      import('./features/analytics/components/hod-dashboard/hod-dashboard.component').then(m => m.HodDashboardComponent),
  },

  /* -------------------- LEGACY PATH REDIRECTS -------------------- */
  { path: 'faculty/knowledge-base', redirectTo: 'faculty/manage-references', pathMatch: 'full' },
  { path: 'faculty/attainment', redirectTo: 'faculty/calculate-attainment', pathMatch: 'full' },

  { path: '**', redirectTo: 'login' },
];