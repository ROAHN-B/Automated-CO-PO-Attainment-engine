import { Component } from '@angular/core';

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

/**
 * HOD overview. MOCK data — the HOD workflow is PENDING SPECIFICATION
 * (AGENTS.md); no approve/return actions are wired until it is specified.
 */
@Component({
  selector: 'app-hod-dashboard',
  standalone: true,
  template: `
    <div class="page-wide stagger">
      <header class="page-header" style="--i:0">
        <div>
          <p class="page-kicker">2025–26 · Electronics &amp; Computer Engineering</p>
          <h1 class="page-title">Department overview</h1>
          <p class="page-subtitle">Course outcome mapping and attainment progress across your faculty.</p>
        </div>
        <span class="chip chip-brand self-start sm:self-auto"><span class="dot bg-brand"></span>NBA cycle active</span>
      </header>

      <section class="panel mt-8" style="--i:1" aria-label="Department metrics">
        <div class="panel-grid grid-cols-2 lg:grid-cols-4">
          @for (kpi of metrics; track kpi.title) {
            <div class="panel-cell px-5 py-6">
              <p class="stat-label">{{ kpi.title }}</p>
              <p class="stat-value">{{ kpi.value }}</p>
              <p class="stat-meta" [class.text-partial]="!kpi.isPositive">{{ kpi.change }}</p>
            </div>
          }
        </div>
      </section>

      <section class="card mt-8 overflow-hidden" style="--i:2" aria-labelledby="approvals-title">
        <div class="card-header">
          <div>
            <h2 id="approvals-title" class="section-title">Faculty progress</h2>
            <p class="section-subtitle">CO-PO mapping and attainment review status by course.</p>
          </div>
        </div>

        <div class="table-wrap">
          <table class="data-table min-w-[760px]">
            <thead>
              <tr>
                <th class="th" scope="col">Faculty</th>
                <th class="th" scope="col">Course</th>
                <th class="th" scope="col">CO-PO mapping</th>
                <th class="th" scope="col">Attainment</th>
                <th class="th text-right" scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (fac of facultyList; track fac.id) {
                <tr>
                  <td class="td">
                    <div class="flex items-center gap-3">
                      <span class="avatar h-7 w-7 text-xs">{{ initials(fac.name) }}</span>
                      <span class="font-medium text-ink">{{ fac.name }}</span>
                    </div>
                  </td>
                  <td class="td">{{ fac.assignedCourses }}</td>
                  <td class="td">
                    @if (fac.coPoMapped) {
                      <span class="chip chip-met"><span class="dot bg-met"></span>Complete</span>
                    } @else {
                      <span class="chip chip-partial"><span class="dot bg-partial"></span>Matrix pending</span>
                    }
                  </td>
                  <td class="td">
                    @switch (fac.attainmentStatus) {
                      @case ('APPROVED') { <span class="chip chip-met"><span class="dot bg-met"></span>Approved</span> }
                      @case ('PENDING') { <span class="chip chip-partial"><span class="dot bg-partial"></span>Awaiting review</span> }
                      @case ('NEEDS_REVIEW') { <span class="chip chip-gap"><span class="dot bg-gap"></span>Needs attention</span> }
                    }
                  </td>
                  <td class="td text-right">
                    <button type="button" class="btn btn-outline btn-sm" disabled title="HOD review actions are not specified yet">Review</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
})
export class HodDashboardComponent {
  metrics: DepartmentMetric[] = [
    { title: 'Faculty members', value: 24, change: '2 joined this semester', isPositive: true },
    { title: 'Active courses', value: 18, change: 'All outcomes mapped', isPositive: true },
    { title: 'Average attainment', value: '76.4%', change: '4.2 pts above target', isPositive: true },
    { title: 'Pending approvals', value: 3, change: 'Awaiting your sign-off', isPositive: false }
  ];

  facultyList: FacultyStatus[] = [
    { id: 'f_01', name: 'Prof. Rajesh Kulkarni', assignedCourses: 'Digital Signal Processing (EC301)', coPoMapped: true, attainmentStatus: 'APPROVED' },
    { id: 'f_02', name: 'Dr. Smita Patil', assignedCourses: 'Microcontrollers & IoT (EC302)', coPoMapped: true, attainmentStatus: 'PENDING' },
    { id: 'f_03', name: 'Prof. Anand Deshmukh', assignedCourses: 'VLSI Design & VHDL (EC303)', coPoMapped: false, attainmentStatus: 'NEEDS_REVIEW' }
  ];

  initials(name: string): string {
    return name.replace(/^(Prof\.|Dr\.)\s*/, '').split(' ').map(p => p[0]).slice(0, 2).join('');
  }
}
