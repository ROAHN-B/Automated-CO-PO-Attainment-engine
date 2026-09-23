import { Routes } from '@angular/router';

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
  // 2. SUPER ADMIN PORTAL (Institution & Global Configs)
  // =========================================================
  {
    path: 'admin',
    title: 'Super Admin Portal · OBE Engine',
    loadComponent: () => import('./features/admin/layout/super-admin-layout.component').then(m => m.SuperAdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        title: 'Dashboard · Super Admin',
        loadComponent: () => import('./features/admin/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent)
      },
      { 
        path: 'institution-setup', 
        title: 'Institution Profile Setup · Super Admin',
        loadComponent: () => import('./features/admin/institution-setup/institution-setup.component').then(m => m.InstitutionSetupComponent)
      },
      {
        path: 'academic-config',
        title: 'Academic Structure · Super Admin',
        loadComponent: () => import('./features/admin/academic-config/academic-config.component').then(m => m.AcademicConfigComponent)
      },
      {
        path: 'po-pso-management',
        title: 'PO & PSO Master · Super Admin',
        loadComponent: () => import('./features/obe/po-pso-management/po-pso-management.component').then(m => m.PoPsoManagementComponent)
      },
      {
        path: 'course-master',
        title: 'Course Outcomes · Super Admin',
        loadComponent: () => import('./features/obe/course-obe-management/course-obe-management.component').then(m => m.CourseObeManagementComponent)
      },
      {
        path: 'co-po-mapping',
        title: 'CO-PO Matrix · Super Admin',
        loadComponent: () => import('./features/obe/co-po-mapping/co-po-mapping.component').then(m => m.CoPoMappingComponent)
      }
    ]
  },

  // =========================================================
  // 3. FACULTY WORKSPACE (AI Assessments, Attainment & Reports)
  // =========================================================
  {
    path: 'faculty',
    title: 'Faculty Portal · OBE Engine',
    loadComponent: () => import('./features/faculty/layout/faculty-layout.component').then(m => m.FacultyLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Faculty Dashboard',
        loadComponent: () => import('./features/dashboard/faculty-dashboard.component').then(m => m.FacultyDashboardComponent)
      },
      {
        path: 'knowledge-base',
        title: 'RAG Knowledge Base',
        loadComponent: () => import('./features/knowledge-base/reference-manager.component').then(m => m.ReferenceManagerComponent)
      },
      {
        path: 'ai-generator',
        title: 'AI Question Generator',
        loadComponent: () => import('./features/question-gen/question-generator-wizard.component').then(m => m.QuestionGeneratorWizardComponent)
      },
      {
        path: 'attainment',
        title: 'CO-PO Attainment Calculation',
        loadComponent: () => import('./features/attainment/attainment-calculation.component').then(m => m.AttainmentCalculationComponent)
      },
      {
        path: 'reports',
        title: 'NBA Report Analysis',
        loadComponent: () => import('./features/report-analysis/report-analysis.component').then(m => m.ReportAnalysisComponent)
      }
    ]
  },

  // =========================================================
  // 4. HOD / ANALYTICS PORTAL (Department Oversight)
  // =========================================================
  {
    path: 'analytics',
    title: 'HOD Analytics · OBE Engine',
    children: [
      {
        path: 'hod-dashboard',
        title: 'HOD Department Dashboard',
        loadComponent: () => import('./features/analytics/components/hod-dashboard/hod-dashboard.component').then(m => m.HodDashboardComponent)
      },
      { path: '', redirectTo: 'hod-dashboard', pathMatch: 'full' }
    ]
  },

  // =========================================================
  // DEFAULT REDIRECTS & FALLBACKS
  // =========================================================
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];