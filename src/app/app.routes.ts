// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { FacultyDashboardComponent } from './features/question-gen/components/faculty-dashboard/faculty-dashboard.component';
import { HodDashboardComponent } from './features/analytics/components/hod-dashboard/hod-dashboard.component';
import { QuestionGeneratorPageComponent } from './features/question-gen/components/question-generator-page/question-generator-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'faculty/dashboard', pathMatch: 'full' },
  { path: 'faculty/dashboard', component: FacultyDashboardComponent },
  { path: 'faculty/generate-questions', component: QuestionGeneratorPageComponent },
  { path: 'hod/dashboard', component: HodDashboardComponent },
];