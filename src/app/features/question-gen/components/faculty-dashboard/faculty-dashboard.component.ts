import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router'; 

@Component({
  selector: 'app-faculty-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink], 
  templateUrl: './faculty-dashboard.component.html',
  styleUrl: './faculty-dashboard.component.scss'
})
export class FacultyDashboardComponent {}