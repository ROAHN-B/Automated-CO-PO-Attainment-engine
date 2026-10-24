import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon.component';

interface DashboardMetrics {
  totalInstitutions: number;
  activePrograms: number;
  pendingSetups: number;
}

interface RecentInstitution {
  id: string;
  code: string;
  name: string;
  university: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
}

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="page stagger">

      <header class="page-header" style="--i:0">
        <div>
          <p class="page-kicker">Administration</p>
          <h1 class="page-title">Overview</h1>
          <p class="page-subtitle">Institutions on the platform and how far their academic setup has progressed.</p>
        </div>
        <div class="page-actions">
          <a routerLink="/admin/institution-setup" class="btn btn-primary">
            <app-icon name="building" class="h-4 w-4" />
            Institution profile
          </a>
        </div>
      </header>

      <section class="panel mt-8" style="--i:1" aria-label="Platform metrics">
        <div class="panel-grid grid-cols-1 sm:grid-cols-3">
          <div class="panel-cell px-6 py-6">
            <p class="stat-label">Institutions</p>
            <p class="stat-value">{{ metrics.totalInstitutions }}</p>
            <p class="stat-meta">onboarded</p>
          </div>
          <div class="panel-cell px-6 py-6">
            <p class="stat-label">Programs</p>
            <p class="stat-value">{{ metrics.activePrograms }}</p>
            <p class="stat-meta">active across institutions</p>
          </div>
          <div class="panel-cell px-6 py-6">
            <p class="stat-label flex items-center gap-1.5">
              Setups in progress
              @if (metrics.pendingSetups > 0) { <span class="dot bg-partial" aria-label="Needs attention"></span> }
            </p>
            <p class="stat-value" [class.text-partial]="metrics.pendingSetups > 0">{{ metrics.pendingSetups }}</p>
            <p class="stat-meta">awaiting completion</p>
          </div>
        </div>
      </section>

      <section class="card mt-8 overflow-hidden" style="--i:2" aria-labelledby="recent-title">
        <div class="card-header">
          <div>
            <h2 id="recent-title" class="section-title">Recently onboarded</h2>
            <p class="section-subtitle">The latest institutions and their affiliation.</p>
          </div>
        </div>

        <div class="table-wrap">
          <table class="data-table min-w-[720px]">
            <thead>
              <tr>
                <th class="th" scope="col">Code</th>
                <th class="th" scope="col">Institution</th>
                <th class="th" scope="col">Affiliating university</th>
                <th class="th" scope="col">Status</th>
                <th class="th text-right" scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (inst of recentInstitutions; track inst.id) {
                <tr>
                  <td class="td font-mono text-[13px]">{{ inst.code }}</td>
                  <td class="td font-medium text-ink">{{ inst.name }}</td>
                  <td class="td">{{ inst.university }}</td>
                  <td class="td">
                    @switch (inst.status) {
                      @case ('ACTIVE') { <span class="chip chip-met"><span class="dot bg-met"></span>Active</span> }
                      @case ('PENDING') { <span class="chip chip-partial"><span class="dot bg-partial"></span>Setup pending</span> }
                      @case ('INACTIVE') { <span class="chip chip-neutral"><span class="dot bg-ink-faint"></span>Inactive</span> }
                    }
                  </td>
                  <td class="td text-right">
                    <a routerLink="/admin/institution-setup" class="btn btn-ghost btn-sm">
                      Manage <app-icon name="chevronRight" class="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <div class="empty-state">
                      <p class="empty-title">No institutions yet</p>
                      <p class="empty-text">Register the first institution to start building its academic structure.</p>
                    </div>
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
export class DashboardHomeComponent implements OnInit {
  metrics: DashboardMetrics = {
    totalInstitutions: 0,
    activePrograms: 0,
    pendingSetups: 0
  };

  recentInstitutions: RecentInstitution[] = [];

  ngOnInit(): void {
    // MOCK until an admin overview endpoint exists.
    this.metrics = {
      totalInstitutions: 14,
      activePrograms: 56,
      pendingSetups: 2
    };

    this.recentInstitutions = [
      { id: 'inst_01', code: 'WIT01', name: 'Walchand Institute of Technology', university: 'Punyashlok Ahilyadevi Holkar Solapur University', status: 'ACTIVE' },
      { id: 'inst_02', code: 'COEP01', name: 'College of Engineering Pune', university: 'Savitribai Phule Pune University', status: 'ACTIVE' },
      { id: 'inst_03', code: 'YCCE01', name: 'Yeshwantrao Chavan College of Engineering', university: 'Rashtrasant Tukadoji Maharaj Nagpur University', status: 'PENDING' }
    ];
  }
}
