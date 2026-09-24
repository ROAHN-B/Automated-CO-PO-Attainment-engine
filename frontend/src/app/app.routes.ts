import { Routes } from '@angular/router';
import { LabAssistantDashboardComponent } from './features/lab-assistant/lab-assistant-dashboard.component';
import { AttainmentCalculationComponent } from './features/attainment/attainment-calculation.component';

export const routes: Routes = [
  // =========================================================
  // 1. UNIVERSAL LOGIN ROUTE
  // =========================================================
  {
    path: 'login',
    title: 'Sign In · OBE Engine',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },

  // =========================================================
  // 2. LAB ASSISTANT PORTAL
  // =========================================================
  {
    path: 'lab-assistant/marks-upload',
    component: LabAssistantDashboardComponent,
    title: 'Lab Assistant - Marksheet Upload'
  },

  // =========================================================
  // 3. SUPER ADMIN PORTAL 
  // =========================================================
  {
    path: 'admin',
    title: 'Super Admin Portal · OBE Engine',
    loadComponent: () => import('./features/admin/layout/super-admin-layout.component').then(m => m.SuperAdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/admin/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'institution-setup', loadComponent: () => import('./features/admin/institution-setup/institution-setup.component').then(m => m.InstitutionSetupComponent) },
      { path: 'academic-config', loadComponent: () => import('./features/admin/academic-config/academic-config.component').then(m => m.AcademicConfigComponent) },
      { path: 'po-pso-management', loadComponent: () => import('./features/obe/po-pso-management/po-pso-management.component').then(m => m.PoPsoManagementComponent) },
      { path: 'course-master', loadComponent: () => import('./features/obe/course-obe-management/course-obe-management.component').then(m => m.CourseObeManagementComponent) },
      { path: 'co-po-mapping', loadComponent: () => import('./features/obe/co-po-mapping/co-po-mapping.component').then(m => m.CoPoMappingComponent) }
    ]
  },

  // =========================================================
  // 4. FACULTY WORKSPACE 
  // =========================================================
  {
    path: 'faculty',
    title: 'Faculty Portal · OBE Engine',
    loadComponent: () => import('./features/faculty/layout/faculty-layout.component').then(m => m.FacultyLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/faculty-dashboard.component').then(m => m.FacultyDashboardComponent) },
      { path: 'knowledge-base', loadComponent: () => import('./features/knowledge-base/reference-manager.component').then(m => m.ReferenceManagerComponent) },
      { path: 'ai-generator', loadComponent: () => import('./features/question-gen/question-generator-wizard.component').then(m => m.QuestionGeneratorWizardComponent) },
      { path: 'attainment', loadComponent: () => import('./features/attainment/attainment-calculation.component').then(m => m.AttainmentCalculationComponent) },
      { path: 'reports', loadComponent: () => import('./features/report-analysis/report-analysis.component').then(m => m.ReportAnalysisComponent) }
    ]
  },

  // =========================================================
  // 5. HOD / ANALYTICS PORTAL
  // =========================================================
  {
    path: 'analytics',
    title: 'HOD Analytics · OBE Engine',
    children: [
      { path: 'hod-dashboard', loadComponent: () => import('./features/analytics/components/hod-dashboard/hod-dashboard.component').then(m => m.HodDashboardComponent) },
      { path: '', redirectTo: 'hod-dashboard', pathMatch: 'full' }
    ]
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];