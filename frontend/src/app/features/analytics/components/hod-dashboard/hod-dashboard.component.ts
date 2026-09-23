import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

interface DepartmentMetric {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
}

interface FacultyStatus {
  id: string;
  name: string;
  assignedCourses: string;
  coPoMapped: boolean;
  attainmentStatus: 'APPROVED' | 'PENDING' | 'NEEDS_REVIEW';
}

@Component({
  selector: 'app-hod-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Standalone full-screen layout with NO sidebar -->
    <div class="min-h-screen bg-slate-100 font-sans flex flex-col">
      
      <!-- Top Header Bar -->
      <header class="h-16 bg-slate-900 text-white px-8 flex items-center justify-between shrink-0 shadow-md">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center font-black text-white">
            H
          </div>
          <div>
            <h1 class="text-sm font-bold tracking-tight">Department of Electronics & Computer Engineering</h1>
            <p class="text-[10px] text-slate-400">HOD Academic & Accreditation Oversight Portal</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="text-xs font-medium px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
            Academic Year: <span class="text-white font-bold">2025–2026</span>
          </div>
          <button 
            (click)="logout()"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm">
            Sign Out
          </button>
        </div>
      </header>

      <!-- Main Dashboard Body -->
      <main class="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full overflow-y-auto">
        
        <!-- Welcome Banner -->
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">HOD Control Center</h2>
            <p class="text-sm text-slate-500 mt-0.5">Real-time monitoring of faculty course outcomes, mappings, and NBA accreditation readiness.</p>
          </div>
          <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span class="w-2 h-2 mr-2 bg-emerald-500 rounded-full animate-pulse"></span>
            NBA Accreditation Cycle Active
          </span>
        </div>

        <!-- KPI Metrics Grid -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div *ngFor="let kpi of metrics" class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{{ kpi.title }}</p>
              <h3 class="text-3xl font-black text-slate-900">{{ kpi.value }}</h3>
            </div>
            <div class="mt-4 text-xs font-semibold" [ngClass]="kpi.isPositive ? 'text-emerald-600' : 'text-amber-600'">
              {{ kpi.change }}
            </div>
          </div>
        </div>

        <!-- Faculty Approvals Table -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 class="text-sm font-bold text-slate-800">Faculty Course Outcome & Attainment Approvals</h3>
            <span class="text-xs font-semibold text-indigo-600 cursor-pointer hover:underline">View All Faculty &rarr;</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm whitespace-nowrap">
              <thead class="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-3 font-semibold">Faculty Name</th>
                  <th class="px-6 py-3 font-semibold">Assigned Course</th>
                  <th class="px-6 py-3 font-semibold">CO-PO Mapping Status</th>
                  <th class="px-6 py-3 font-semibold">Attainment Review</th>
                  <th class="px-6 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                <tr *ngFor="let fac of facultyList" class="hover:bg-slate-50/80 transition-colors">
                  <td class="px-6 py-4 font-semibold text-slate-900">{{ fac.name }}</td>
                  <td class="px-6 py-4 text-slate-600">{{ fac.assignedCourses }}</td>
                  <td class="px-6 py-4">
                    <span [ngClass]="fac.coPoMapped ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'" class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full">
                      {{ fac.coPoMapped ? 'Completed' : 'Pending Matrix' }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <span [ngClass]="{
                      'bg-emerald-100 text-emerald-700': fac.attainmentStatus === 'APPROVED',
                      'bg-amber-100 text-amber-700': fac.attainmentStatus === 'PENDING',
                      'bg-red-100 text-red-700': fac.attainmentStatus === 'NEEDS_REVIEW'
                    }" class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full">
                      {{ fac.attainmentStatus }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <button class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold text-xs rounded-lg transition-colors">
                      Review File
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  `
})
export class HodDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  metrics: DepartmentMetric[] = [
    { title: 'Total Faculty Members', value: 24, change: '+2 joined this semester', isPositive: true },
    { title: 'Active Courses', value: 18, change: '100% Outcome Mapped', isPositive: true },
    { title: 'Average Attainment', value: '76.4%', change: '+4.2% from target', isPositive: true },
    { title: 'Pending Approvals', value: 3, change: 'Requires HOD sign-off', isPositive: false }
  ];

  facultyList: FacultyStatus[] = [
    { id: 'f_01', name: 'Prof. Rajesh Kulkarni', assignedCourses: 'Digital Signal Processing (EC301)', coPoMapped: true, attainmentStatus: 'APPROVED' },
    { id: 'f_02', name: 'Dr. Smita Patil', assignedCourses: 'Microcontrollers & IoT (EC302)', coPoMapped: true, attainmentStatus: 'PENDING' },
    { id: 'f_03', name: 'Prof. Anand Deshmukh', assignedCourses: 'VLSI Design & VHDL (EC303)', coPoMapped: false, attainmentStatus: 'NEEDS_REVIEW' }
  ];

  ngOnInit(): void {}

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}