import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiAssessmentService } from '../../../core/services/ai-assessment.service';
import { KnowledgeDocument } from '../../../core/models/epic3-assessment.model';

@Component({
  selector: 'app-document-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-5xl mx-auto space-y-8">

        <!-- Header -->
        <div class="flex justify-between items-end border-b border-slate-200 pb-5">
          <div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">RAG Knowledge Base</h1>
            <p class="text-slate-600 mt-1">Upload course materials, previous papers, and syllabus to provide context for the AI Question Generator.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Left Column: Upload Area -->
          <div class="lg:col-span-1 space-y-4">
            <div class="bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 hover:border-indigo-400 transition-colors flex flex-col items-center justify-center min-h-[250px]">
              
              <div class="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              
              <h3 class="text-sm font-bold text-slate-700 mb-1">Upload Document</h3>
              <p class="text-xs text-slate-500 mb-6">PDF, DOCX, or TXT up to 10MB</p>
              
              <input type="file" #fileInput (change)="onFileSelected($event)" class="hidden" accept=".pdf,.doc,.docx,.txt">
              
              <button (click)="fileInput.click()" [disabled]="isUploading" class="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm">
                {{ isUploading ? 'Uploading...' : 'Browse Files' }}
              </button>
            </div>
            
            <!-- Context Hint -->
            <div class="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
              <svg class="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-xs text-blue-800 leading-relaxed">
                <strong>Why upload?</strong> The AI uses these documents via Retrieval-Augmented Generation (RAG) to ensure generated questions perfectly match your specific curriculum and teaching style.
              </p>
            </div>
          </div>

          <!-- Right Column: Document List -->
          <div class="lg:col-span-2">
            <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 class="text-sm font-bold text-slate-800">Course Context Library</h3>
                <span class="text-xs font-medium px-2.5 py-1 bg-slate-200 text-slate-700 rounded-full">{{ documents.length }} Files</span>
              </div>
              
              <div class="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                <div *ngIf="documents.length === 0" class="p-8 text-center text-slate-400 text-sm italic">
                  No context documents uploaded yet.
                </div>

                <div *ngFor="let doc of documents" class="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                  <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded bg-red-50 flex items-center justify-center shrink-0">
                      <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 class="text-sm font-semibold text-slate-800 truncate max-w-[250px]" [title]="doc.fileName">{{ doc.fileName }}</h4>
                      <p class="text-[10px] text-slate-500 mt-0.5">{{ doc.fileSizeKB }} KB • {{ doc.uploadedAt | date:'mediumDate' }}</p>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-3">
                    <!-- Status Badge -->
                    <span [ngClass]="{
                        'bg-emerald-100 text-emerald-700': doc.processingStatus === 'COMPLETED',
                        'bg-amber-100 text-amber-700 animate-pulse': doc.processingStatus === 'PROCESSING',
                        'bg-red-100 text-red-700': doc.processingStatus === 'FAILED'
                      }" 
                      class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                      <svg *ngIf="doc.processingStatus === 'PROCESSING'" class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {{ doc.processingStatus === 'PROCESSING' ? 'Vectorizing...' : doc.processingStatus }}
                    </span>
                    
                    <button class="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class DocumentUploadComponent implements OnInit {
  private aiService = inject(AiAssessmentService);

  // Hardcoded for Epic 3 prototype
  currentCourseId = 'crs_01'; 
  
  documents: KnowledgeDocument[] = [];
  isUploading = false;

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.aiService.getKnowledgeDocuments(this.currentCourseId).subscribe(docs => {
      // Sort newest first
      this.documents = docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    });
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.isUploading = true;
      this.aiService.uploadKnowledgeDocument(this.currentCourseId, file).subscribe(newDoc => {
        this.isUploading = false;
        this.documents.unshift(newDoc);
        
        // Simulate RAG Vectorization time (changes PROCESSING -> COMPLETED after 4 seconds)
        setTimeout(() => {
          const docToUpdate = this.documents.find(d => d.documentId === newDoc.documentId);
          if (docToUpdate) {
            docToUpdate.processingStatus = 'COMPLETED';
          }
        }, 4000);
      });
    }
    // Reset file input so the same file can be uploaded again if needed
    event.target.value = '';
  }
}