import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { KnowledgeDocument, Question, Assessment } from '../models/epic3-assessment.model';
import { BloomLevel } from '../models/epic2-course-obe.model';

@Injectable({
  providedIn: 'root'
})
export class AiAssessmentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl || 'http://localhost:5000/api'}/assessment`;

  // --- Mock Data ---
  private mockDocuments: KnowledgeDocument[] = [
    { documentId: 'doc_01', courseId: 'crs_01', fileName: 'Digital_Signal_Processing_Syllabus.pdf', fileType: 'application/pdf', fileSizeKB: 2048, uploadedAt: new Date().toISOString(), processingStatus: 'COMPLETED' },
    { documentId: 'doc_02', courseId: 'crs_01', fileName: 'Previous_Year_Question_Paper_2025.pdf', fileType: 'application/pdf', fileSizeKB: 1500, uploadedAt: new Date().toISOString(), processingStatus: 'COMPLETED' }
  ];

  private mockQuestions: Question[] = [];
  private mockAssessments: Assessment[] = [];

  // --- Knowledge Base (RAG) Methods ---
  getKnowledgeDocuments(courseId: string): Observable<KnowledgeDocument[]> {
    if (environment.useMockData) {
      return of(this.mockDocuments.filter(doc => doc.courseId === courseId));
    }
    return this.http.get<KnowledgeDocument[]>(`${this.apiUrl}/documents`, { params: { courseId } });
  }

  uploadKnowledgeDocument(courseId: string, file: File): Observable<KnowledgeDocument> {
    if (environment.useMockData) {
      const newDoc: KnowledgeDocument = {
        documentId: 'doc_' + Date.now(),
        courseId,
        fileName: file.name,
        fileType: file.type,
        fileSizeKB: Math.round(file.size / 1024),
        uploadedAt: new Date().toISOString(),
        processingStatus: 'PROCESSING' // Will simulate processing state in the UI
      };
      this.mockDocuments.push(newDoc);
      return of(newDoc).pipe(delay(800)); // Simulate network upload time
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', courseId);
    return this.http.post<KnowledgeDocument>(`${this.apiUrl}/documents/upload`, formData);
  }

  // --- AI Question Generation Methods ---
  
  /**
   * Pings the LLM backend to generate questions based on RAG context, CO, and Bloom's Level.
   */
  generateAiQuestions(courseId: string, coId: string, bloomLevel: BloomLevel, count: number): Observable<Question[]> {
    if (environment.useMockData) {
      // Simulating AI generation delay and response
      const generatedQuestions: Question[] = Array.from({ length: count }).map((_, i) => ({
        questionId: 'q_ai_' + Date.now() + i,
        courseId,
        coId,
        bloomLevel,
        questionText: `[AI Generated] Explain the concept of ${bloomLevel} in the context of Course Outcome ${coId}. Provide a detailed example with real-world applications.`,
        marks: 5,
        isAiGenerated: true,
        modelUsed: 'gemini-1.5-pro',
        status: 'DRAFT'
      }));
      
      this.mockQuestions.push(...generatedQuestions);
      return of(generatedQuestions).pipe(delay(2000)); // Simulate AI thinking time (2 seconds)
    }
    
    return this.http.post<Question[]>(`${this.apiUrl}/questions/generate`, { courseId, coId, bloomLevel, count });
  }

  getQuestionsByCourse(courseId: string): Observable<Question[]> {
    if (environment.useMockData) return of(this.mockQuestions.filter(q => q.courseId === courseId));
    return this.http.get<Question[]>(`${this.apiUrl}/questions`, { params: { courseId } });
  }

  updateQuestionStatus(questionId: string, status: 'DRAFT' | 'APPROVED' | 'REJECTED'): Observable<{success: boolean}> {
    if (environment.useMockData) {
      const q = this.mockQuestions.find(x => x.questionId === questionId);
      if (q) q.status = status;
      return of({ success: true });
    }
    return this.http.patch<{success: boolean}>(`${this.apiUrl}/questions/${questionId}/status`, { status });
  }
}