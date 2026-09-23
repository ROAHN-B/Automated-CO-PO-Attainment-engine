import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      <!-- Left Sidebar -->
      <aside class="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <!-- Logo Area -->
        <div class="h-16 flex items-center px-6 border-b border-slate-800">
          <div class="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center mr-3">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <span class="text-lg font-extrabold tracking-tight">OBE Engine</span>
        </div>

        <!-- Navigation Links -->
        <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <p class="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Platform Management</p>
          
          <a routerLink="/admin/dashboard" routerLinkActive="bg-slate-800 text-white" class="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition group">
            <svg class="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Overview Dashboard
          </a>

          <a routerLink="/admin/institution-setup" routerLinkActive="bg-slate-800 text-white" class="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition group mt-1">
            <svg class="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Institution Profile
          </a>

          <p class="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Academic Setup (Epic 1)</p>
          
          <a routerLink="/admin/academic-config" routerLinkActive="bg-slate-800 text-white" class="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition group">
            <svg class="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Academic Structure
          </a>

          <p class="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">OBE Masters (Epic 2)</p>

          <a routerLink="/admin/po-pso-management" routerLinkActive="bg-slate-800 text-white" class="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition group">
            <svg class="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            PO & PSO Master
          </a>

          <a routerLink="/admin/course-master" routerLinkActive="bg-slate-800 text-white" class="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition group">
            <svg class="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Course Outcomes
          </a>
          
          <a routerLink="/admin/co-po-mapping" routerLinkActive="bg-slate-800 text-white" class="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition group">
            <svg class="w-5 h-5 text-slate-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            CO-PO Correlation Matrix
          </a>
        </nav>

        <!-- User Profile Area -->
        <div class="p-4 border-t border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">A</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white truncate">Administrator</p>
              <p class="text-[10px] text-slate-400 truncate">System Authority</p>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        <!-- Top Navigation Bar -->
        <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div class="flex-1 flex">
             <h2 class="text-lg font-bold text-slate-800">Administration Portal</h2>
          </div>
          
          <div class="flex items-center gap-4">
            <button 
              routerLink="/admin/institution-setup"
              class="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition shadow-sm flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Institution Settings
            </button>
          </div>
        </header>

        <!-- Dynamic Page Content -->
        <main class="flex-1 overflow-y-auto">
          <router-outlet></router-outlet>
        </main>

      </div>
    </div>
  `
})
export class SuperAdminLayoutComponent {}