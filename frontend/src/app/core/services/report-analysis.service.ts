/**
 * ============================================================================
 *  report-analysis.service.ts  —  AI-driven Report Analysis (Mayuri, RAG/LLM)
 * ============================================================================
 *  Generative narrative over attainment results: gaps, causes, trends, actions.
 * ============================================================================
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, ReportAnalysis, ReportAnalysisRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class ReportAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly useMock = environment.useMockData;

  /** POST /analysis/report — run the RAG analysis (loading state in UI). */
  analyzeReport(req: ReportAnalysisRequest): Observable<ReportAnalysis> {
    if (this.useMock) return of(buildMockAnalysis(req)).pipe(delay(3000));
    return this.http
      .post<ApiResponse<ReportAnalysis>>(`${this.base}/analysis/report`, req)
      .pipe(map(r => r.data));
  }
}

/* ============================== MOCK FIXTURES ============================== */

function buildMockAnalysis(req: ReportAnalysisRequest): ReportAnalysis {
  return {
    analysisId: `an-${Date.now()}`,
    courseId: req.courseId,
    courseCode: 'CS301',
    modelUsed: 'gemini-2.5-pro (mock)',
    generatedAt: new Date().toISOString(),
    executiveSummary:
      'Overall CO attainment sits at 67.8%, comfortably above target for 3 of 4 outcomes. ' +
      'CO2 (non-linear structures) is the single weak point at 54.2%, dragging PO3 (design/development) ' +
      'into Level 1. The pattern points to graph-implementation problems rather than conceptual gaps.',
    gapCount: 2,
    strengthCount: 2,
    insights: [
      {
        insightId: 'i1', category: 'ATTAINMENT_GAP', severity: 'CRITICAL',
        title: 'CO2 below target — graph implementation',
        description: 'Only 35 of 65 students met the 60% target on CO2. Item analysis shows marks concentrated in the 6-mark Dijkstra/MST questions, where partial-credit answers stopped at formulation without implementation.',
        relatedCoCodes: ['CO2'], relatedPoCodes: ['PO3'],
        recommendedActions: [
          'Add a guided lab on implementing Dijkstra & Kruskal from scratch.',
          'Introduce a formative coding quiz before the summative test.',
        ],
        confidenceScore: 0.9,
      },
      {
        insightId: 'i2', category: 'ATTAINMENT_GAP', severity: 'WARNING',
        title: 'PO3 pulled to Level 1',
        description: 'PO3 depends on CO2 and CO3; CO2’s shortfall pulls the weighted PO3 value to 1.7. Strengthening CO2 alone is projected to lift PO3 to Level 2.',
        relatedPoCodes: ['PO3'],
        recommendedActions: ['Re-run attainment after the CO2 intervention to confirm PO3 recovery.'],
        confidenceScore: 0.82,
      },
      {
        insightId: 'i3', category: 'STRENGTH', severity: 'INFO',
        title: 'CO1 (complexity analysis) is a strength',
        description: 'CO1 attainment of 78.5% (Level 3) is consistent with last year. Current question difficulty is well-calibrated.',
        relatedCoCodes: ['CO1'], relatedPoCodes: ['PO1'],
        confidenceScore: 0.88,
      },
      {
        insightId: 'i4', category: 'RECOMMENDATION', severity: 'INFO',
        title: 'Rebalance the CO2 question blueprint',
        description: 'Shift one 6-mark CO2 item to two 3-mark items so partial understanding is rewarded and item discrimination improves.',
        relatedCoCodes: ['CO2'],
        recommendedActions: ['Regenerate the CO2 section with a 3+3 split in the Question Generator.'],
        confidenceScore: 0.76,
      },
    ],
    trends: [
      { period: '2023-24 ODD', overallCoAttainment: 63.1, overallPoAttainment: 1.9 },
      { period: '2024-25 ODD', overallCoAttainment: 65.4, overallPoAttainment: 2.0 },
      { period: '2025-26 ODD', overallCoAttainment: 67.8, overallPoAttainment: 2.1 },
    ],
  };
}
