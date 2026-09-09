import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { InstitutionRegistrationDto } from '../models/institution.model';
import { CalculateAttainmentRequest, CoAttainmentResult, PoAttainmentResult } from '../models/attainment.model';
import { QuestionGenerationRequest, GeneratedQuestion } from '../models/question-gen.model';

@Injectable({
  providedIn: 'root'
})
export class BackendContractService {
  private baseUrl = '/api/v1'; // Base URL for Spring Boot backend

  constructor(private http: HttpClient) {}

  // --- ADMIN / INSTITUTION ENDPOINTS (Abhijeet) ---
  registerInstitution(payload: InstitutionRegistrationDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/institutions`, payload);
  }

  // --- ATTAINMENT CALCULATION ENDPOINTS (Abhijeet) ---
  calculateCoAttainment(payload: CalculateAttainmentRequest): Observable<CoAttainmentResult[]> {
    return this.http.post<CoAttainmentResult[]>(`${this.baseUrl}/attainment/co`, payload);
  }

  calculatePoAttainment(assessmentId: number): Observable<PoAttainmentResult[]> {
    return this.http.get<PoAttainmentResult[]>(`${this.baseUrl}/attainment/po/${assessmentId}`);
  }

  // --- AI & RAG QUESTION GENERATION ENDPOINTS (Mayuri) ---
  generateAiQuestions(payload: QuestionGenerationRequest): Observable<GeneratedQuestion[]> {
    return this.http.post<GeneratedQuestion[]>(`${this.baseUrl}/ai/generate-questions`, payload);
  }
}