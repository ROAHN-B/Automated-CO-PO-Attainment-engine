import { Component } from '@angular/core';
// 1. Import the faculty dashboard component
import { FacultyDashboardComponent } from './features/question-gen/components/faculty-dashboard/faculty-dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  // 2. Add it to the imports array (and remove RouterOutlet for now)
  imports: [FacultyDashboardComponent], 
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'frontend';
}