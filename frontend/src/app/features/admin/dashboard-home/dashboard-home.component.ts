import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
  imports: [CommonModule, RouterModule],
  template: `
    <div class="p-6 lg:p-10 space-y-8">
      
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">System Overview</h1>
        <p class="text-sm text-slate-500 mt-1">High-level metrics across all onboarded institutions.</p>
      </div>

      <!-- Top Row: KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Card 1 -->
        <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-slate-500 mb-1">Total Institutions</p>
            <h3 class="text-3xl font-black text-slate-900">{{ metrics.totalInstitutions }}</h3>
          </div>
          <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </div>

        <!-- Card 2 -->
        <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-slate-500 mb-1">Active Programs</p>
            <h3 class="text-3xl font-black text-slate-900">{{ metrics.activePrograms }}</h3>
          </div>
          <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        <!-- Card 3 -->
        <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-slate-500 mb-1">Pending Setups</p>
            <h3 class="text-3xl font-black text-slate-900">{{ metrics.pendingSetups }}</h3>
          </div>
          <div class="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Middle Row: Data Table -->
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 class="text-base font-bold text-slate-800">Recently Onboarded Institutions</h3>
          <button routerLink="/super-admin/institutions" class="text-sm text-indigo-600 font-semibold hover:text-indigo-800">View All &rarr;</button>
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 font-semibold">Code</th>
                <th class="px-6 py-3 font-semibold">Institution Name</th>
                <th class="px-6 py-3 font-semibold">Affiliating University</th>
                <th class="px-6 py-3 font-semibold">Status</th>
                <th class="px-6 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr *ngFor="let inst of recentInstitutions" class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 font-mono text-xs text-slate-600">{{ inst.code }}</td>
                <td class="px-6 py-4 font-medium text-slate-900">{{ inst.name }}</td>
                <td class="px-6 py-4 text-slate-600">{{ inst.university }}</td>
                <td class="px-6 py-4">
                  <span [ngClass]="{
                      'bg-emerald-100 text-emerald-700': inst.status === 'ACTIVE',
                      'bg-amber-100 text-amber-700': inst.status === 'PENDING',
                      'bg-red-100 text-red-700': inst.status === 'INACTIVE'
                    }" 
                    class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full">
                    {{ inst.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <button class="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors">
                    Manage
                  </button>
                </td>
              </tr>
              <!-- Empty State if no data -->
              <tr *ngIf="recentInstitutions.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-slate-400 italic">
                  No institutions onboarded yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

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
    // Mocking a data fetch. In reality, you'd call an admin dashboard service here.
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