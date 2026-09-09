// src/app/app.routes.ts
import { Routes } from '@angular/router';

/**
 * Hub-and-spoke routing.
 *
 *   HUB    → /faculty/dashboard   (the command center: metrics + launch tiles)
 *   SPOKES → one isolated full-page view per feature, lazy-loaded so each
 *            spoke ships in its own chunk and the hub stays lean.
 *
 * Every feature is reachable by a stable, self-describing URL — faculty can
 * bookmark a spoke directly, and NBA/NAAC audit trails can cite one.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'faculty/dashboard', pathMatch: 'full' },

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

  /* -------------------- LEGACY PATH REDIRECTS --------------------
     These two spokes were renamed during the hub-and-spoke refactor.
     Kept so older bookmarks and teammate links don't 404. Safe to drop
     once nothing external points at them. */
  { path: 'faculty/knowledge-base', redirectTo: 'faculty/manage-references', pathMatch: 'full' },
  { path: 'faculty/attainment', redirectTo: 'faculty/calculate-attainment', pathMatch: 'full' },

  { path: '**', redirectTo: 'faculty/dashboard' },
];
