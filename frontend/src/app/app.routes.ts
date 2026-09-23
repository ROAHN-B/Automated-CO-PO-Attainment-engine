import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'admin',
    title: 'Admin Portal · OBE Engine',
    // 1. This acts as the wrapper for all admin pages
    loadComponent: () => import('./features/admin/layout/super-admin-layout.component').then(m => m.SuperAdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      
      // 2. The Dashboard Home
      { 
        path: 'dashboard', 
        title: 'Dashboard · Admin',
        loadComponent: () => import('./features/admin/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent)
      },
      
      // 3. The Institution Profile Form
      { 
        path: 'institution-setup', 
        title: 'Institution Profile Setup · Admin',
        loadComponent: () => import('./features/admin/institution-setup/institution-setup.component').then(m => m.InstitutionSetupComponent)
      },

      // 4. Academic Configuration
      {
        path: 'academic-config',
        title: 'Academic Structure · Admin',
        loadComponent: () => import('./features/admin/academic-config/academic-config.component').then(m => m.AcademicConfigComponent)
      },

      // 5. Epic 2: PO & PSO Management
      {
        path: 'po-pso-management',
        title: 'PO & PSO Master · Admin',
        loadComponent: () => import('./features/obe/po-pso-management/po-pso-management.component').then(m => m.PoPsoManagementComponent)
      },

      // 6. Epic 2: Course Outcomes Management
      {
        path: 'course-master',
        title: 'Course Outcomes · Admin',
        loadComponent: () => import('./features/obe/course-obe-management/course-obe-management.component').then(m => m.CourseObeManagementComponent)
      }
    ]
  },

  // Fallbacks
  { path: '', redirectTo: 'admin/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'admin/dashboard' }
];