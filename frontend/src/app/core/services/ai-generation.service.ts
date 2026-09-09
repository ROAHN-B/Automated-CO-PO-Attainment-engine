/**
 * ============================================================================
 *  ai-generation.service.ts
 * ============================================================================
 *  The AI/RAG surface owned by MAYURI. Two responsibilities:
 *    1. Vector Knowledge Base — ingest reference material into a unit's vector
 *       store ("upload once").
 *    2. Question Generation — RAG over an embedded unit ("query many").
 *
 *  Every method flips on `environment.useMockData`:
 *    • true  → returns realistic hardcoded data with simulated latency, so the
 *              frontend is fully demoable before any backend exists.
 *    • false → real HTTP to `${environment.apiBaseUrl}` (default
 *              http://localhost:8080/api/v1), unwrapping ApiResponse<T>.
 *
 *  Abhijeet/Mayuri: match the REST paths + JSON shapes documented on each method
 *  (see also API_CONTRACT.md at the frontend root).
 * ============================================================================
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  CreateUnitRequest,
  GeneratedQuestion,
  IngestReferenceRequest,
  IngestionJob,
  QuestionGenerationRequest,
  QuestionGenerationResponse,
  QuestionOption,
  QuestionPaper,
  QuestionPaperRequest,
  QuestionType,
  ReferenceMaterial,
  SyllabusUnit,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AiGenerationService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly useMock = environment.useMockData;

  /* ======================================================================
   *  PART A — Vector Knowledge Base (reference materials)
   * ==================================================================== */

  /** GET /courses/{courseId}/units — list units + their vector-KB summary. */
  getUnits(courseId: string): Observable<SyllabusUnit[]> {
    if (this.useMock) return of(MOCK_UNITS.filter(u => u.courseId === courseId)).pipe(delay(500));
    return this.http
      .get<ApiResponse<SyllabusUnit[]>>(`${this.base}/courses/${courseId}/units`)
      .pipe(map(r => r.data));
  }

  /** GET /units/{unitId}/materials — documents attached to a unit. */
  getUnitMaterials(unitId: string): Observable<ReferenceMaterial[]> {
    if (this.useMock) return of(MOCK_MATERIALS.filter(m => m.unitId === unitId)).pipe(delay(500));
    return this.http
      .get<ApiResponse<ReferenceMaterial[]>>(`${this.base}/units/${unitId}/materials`)
      .pipe(map(r => r.data));
  }

  /**
   * POST /units/ingest  (multipart/form-data)
   *   part "meta"  : IngestReferenceRequest (JSON)
   *   part "files" : the uploaded File[]
   * Kicks off Mayuri's parse→chunk→embed pipeline; returns an async job.
   */
  ingestReferences(req: IngestReferenceRequest, files: File[]): Observable<IngestionJob> {
    if (this.useMock) return of(buildMockJob(req, files)).pipe(delay(2600));

    const form = new FormData();
    form.append('meta', new Blob([JSON.stringify(req)], { type: 'application/json' }));
    files.forEach(f => form.append('files', f, f.name));
    return this.http
      .post<ApiResponse<IngestionJob>>(`${this.base}/units/ingest`, form)
      .pipe(map(r => r.data));
  }

  /** GET /ingest/jobs/{jobId} — poll until COMPLETED/FAILED (real mode only). */
  getIngestionJob(jobId: string): Observable<IngestionJob> {
    if (this.useMock) return of({ ...MOCK_COMPLETED_JOB, jobId }).pipe(delay(400));
    return this.http
      .get<ApiResponse<IngestionJob>>(`${this.base}/ingest/jobs/${jobId}`)
      .pipe(map(r => r.data));
  }

  /** POST /units — create a new unit (when faculty types a new name). */
  createUnit(req: CreateUnitRequest): Observable<SyllabusUnit> {
    if (this.useMock) {
      const unit: SyllabusUnit = {
        unitId: `unit-${Date.now()}`,
        courseId: req.courseId,
        unitNumber: req.unitNumber,
        unitName: req.unitName,
        description: req.description,
        documentCount: 0,
        chunkCount: 0,
        isEmbedded: false,
      };
      return of(unit).pipe(delay(400));
    }
    return this.http
      .post<ApiResponse<SyllabusUnit>>(`${this.base}/units`, req)
      .pipe(map(r => r.data));
  }

  /* ======================================================================
   *  PART B — RAG Question Generation
   * ==================================================================== */

  /** POST /generation/questions — RAG generate CO/Bloom-tagged questions. */
  generateQuestions(req: QuestionGenerationRequest): Observable<QuestionGenerationResponse> {
    if (this.useMock) return of(buildMockGeneration(req)).pipe(delay(2800));
    return this.http
      .post<ApiResponse<QuestionGenerationResponse>>(`${this.base}/generation/questions`, req)
      .pipe(map(r => r.data));
  }

  /** POST /papers — assemble selected questions into a paper (+ render PDF). */
  exportQuestionPaper(req: QuestionPaperRequest, keep: GeneratedQuestion[]): Observable<QuestionPaper> {
    if (this.useMock) {
      const paper: QuestionPaper = {
        paperId: `paper-${Date.now()}`,
        title: req.title,
        courseId: req.courseId,
        courseCode: 'CS301',
        questions: keep,
        totalMarks: keep.reduce((s, q) => s + q.marks, 0),
        totalQuestions: keep.length,
        createdAt: new Date().toISOString(),
        pdfUrl: undefined, // in mock we generate the PDF client-side
      };
      return of(paper).pipe(delay(1200));
    }
    return this.http
      .post<ApiResponse<QuestionPaper>>(`${this.base}/papers`, req)
      .pipe(map(r => r.data));
  }
}

/* ============================================================================
 *  MOCK FIXTURES  (only used when environment.useMockData === true)
 * ========================================================================== */

const MOCK_UNITS: SyllabusUnit[] = [
  {
    unitId: 'unit-1', courseId: 'course-cs301', unitNumber: 1,
    unitName: 'Unit 1: Introduction to Data Structures',
    description: 'Abstract data types, complexity, arrays.',
    documentCount: 3, chunkCount: 128, isEmbedded: true,
    lastIngestedAt: '2026-08-18T06:12:00Z',
  },
  {
    unitId: 'unit-2', courseId: 'course-cs301', unitNumber: 2,
    unitName: 'Unit 2: Linear Structures (Stacks & Queues)',
    description: 'Stacks, queues, deques, applications.',
    documentCount: 5, chunkCount: 214, isEmbedded: true,
    lastIngestedAt: '2026-08-19T10:41:00Z',
  },
  {
    unitId: 'unit-3', courseId: 'course-cs301', unitNumber: 3,
    unitName: 'Unit 3: Advanced Trees & Graphs',
    description: 'BST, AVL, heaps, graph traversal & shortest paths.',
    documentCount: 2, chunkCount: 96, isEmbedded: true,
    lastIngestedAt: '2026-08-21T04:05:00Z',
  },
  {
    unitId: 'unit-4', courseId: 'course-cs301', unitNumber: 4,
    unitName: 'Unit 4: Hashing & Searching',
    description: 'Not yet embedded — upload references to enable generation.',
    documentCount: 0, chunkCount: 0, isEmbedded: false,
  },
];

const MOCK_MATERIALS: ReferenceMaterial[] = [
  {
    materialId: 'mat-1', unitId: 'unit-3', courseId: 'course-cs301',
    fileName: 'graphs_question_bank_2024.pdf', mimeType: 'application/pdf',
    fileSizeBytes: 812_344, materialType: 'QUESTION_BANK',
    ingestionStatus: 'COMPLETED', progressPercent: 100, chunkCount: 54,
    uploadedAt: '2026-08-21T04:00:00Z', uploadedBy: 'rohan',
  },
  {
    materialId: 'mat-2', unitId: 'unit-3', courseId: 'course-cs301',
    fileName: 'dijkstra_lecture_slides.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    fileSizeBytes: 2_104_998, materialType: 'LECTURE_PPT',
    ingestionStatus: 'COMPLETED', progressPercent: 100, chunkCount: 42,
    uploadedAt: '2026-08-21T04:05:00Z', uploadedBy: 'rohan',
  },
];

const MOCK_COMPLETED_JOB: IngestionJob = {
  jobId: 'job-mock', unitId: 'unit-3', courseId: 'course-cs301',
  materials: [], overallStatus: 'COMPLETED', overallProgressPercent: 100,
  startedAt: '2026-08-23T09:00:00Z', completedAt: '2026-08-23T09:00:03Z',
};

function buildMockJob(req: IngestReferenceRequest, files: File[]): IngestionJob {
  const unitId = req.unitId ?? `unit-${Date.now()}`;
  const now = new Date().toISOString();
  const materials: ReferenceMaterial[] = files.map((f, i) => ({
    materialId: `mat-${Date.now()}-${i}`,
    unitId,
    courseId: req.newUnit?.courseId ?? 'course-cs301',
    fileName: f.name,
    mimeType: f.type || 'application/octet-stream',
    fileSizeBytes: f.size,
    materialType: req.materialType,
    ingestionStatus: 'COMPLETED',
    progressPercent: 100,
    chunkCount: Math.max(12, Math.round(f.size / 18000)),
    uploadedAt: now,
    uploadedBy: 'rohan',
  }));
  return {
    jobId: `job-${Date.now()}`,
    unitId,
    courseId: materials[0]?.courseId ?? 'course-cs301',
    materials,
    overallStatus: 'COMPLETED',
    overallProgressPercent: 100,
    startedAt: now,
    completedAt: now,
  };
}

/* ----- type-aware mock question banks (keyed by QuestionType) ----- */

const MCQ_BANK: { text: string; options: string[]; correct: number }[] = [
  { text: 'Which traversal of a binary search tree visits keys in ascending order?', options: ['Pre-order', 'In-order', 'Post-order', 'Level-order'], correct: 1 },
  { text: 'What is the worst-case time complexity of search in a balanced AVL tree?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], correct: 1 },
  { text: 'Which data structure follows first-in-first-out (FIFO) ordering?', options: ['Stack', 'Queue', 'Priority queue', 'Binary heap'], correct: 1 },
  { text: 'Dijkstra’s shortest-path algorithm can give incorrect results when a graph contains:', options: ['Cycles', 'Negative edge weights', 'Disconnected vertices', 'Self-loops'], correct: 1 },
];

const FILL_BANK: string[] = [
  'Binary search on a sorted array of n elements runs in O(____) time.',
  'A ____ tree is a binary tree in which every node has at most two children.',
  'In a min-heap the ____ element is always stored at the root.',
  'The graph traversal that uses a queue as its frontier is ____.',
];

const SHORT_BANK: string[] = [
  'Differentiate between BFS and DFS traversal, giving one use-case for each.',
  'State and justify the time complexity of extract-min on a binary min-heap.',
  'Define a spanning tree and give the property that makes it *minimum*.',
  'Explain why hashing offers average O(1) lookup and one situation where it degrades.',
];

const LONG_BANK: string[] = [
  'Design and analyse Dijkstra’s shortest-path algorithm; explain with a worked example why it fails on graphs with negative edges.',
  'Illustrate inserting the keys 30, 20, 40, 10, 25 into an AVL tree, showing every rotation and the resulting balance factors.',
  'Compare adjacency-matrix and adjacency-list graph representations across traversal cost, space, and edge queries, with examples.',
  'Construct the minimum spanning tree of a weighted graph using Kruskal’s algorithm and prove the correctness of its greedy choice.',
];

/** Build a type-appropriate mock question body (+ options for MCQ). */
function mockQuestionBody(type: QuestionType, i: number): { text: string; options?: QuestionOption[] } {
  switch (type) {
    case 'MCQ': {
      const item = MCQ_BANK[i % MCQ_BANK.length];
      return {
        text: item.text,
        options: item.options.map((text, k) => ({
          key: String.fromCharCode(65 + k), // A, B, C, D
          text,
          isCorrect: k === item.correct,
        })),
      };
    }
    case 'FILL_IN_THE_BLANK':
      return { text: FILL_BANK[i % FILL_BANK.length] };
    case 'SHORT_ANSWER':
      return { text: SHORT_BANK[i % SHORT_BANK.length] };
    case 'LONG_ANSWER':
    default:
      return { text: LONG_BANK[i % LONG_BANK.length] };
  }
}

function buildMockGeneration(req: QuestionGenerationRequest): QuestionGenerationResponse {
  const blooms = req.bloomLevels?.length ? req.bloomLevels : ['L3_APPLY', 'L4_ANALYZE'] as const;
  const cos = req.coIds?.length ? req.coIds : ['co-2'];
  const now = new Date().toISOString();
  const blueprintRows = req.blueprint ?? [];

  let seq = 0;
  const questions: GeneratedQuestion[] = [];
  for (const row of blueprintRows) {
    for (let i = 0; i < row.count; i++) {
      const coId = cos[seq % cos.length];
      const body = mockQuestionBody(row.questionType, i);
      questions.push({
        questionId: `gen-${Date.now()}-${seq}`,
        questionText: body.text,
        marks: row.marks,
        questionType: row.questionType,
        options: body.options,
        coId,
        coCode: coCodeFor(coId),
        bloomLevel: blooms[seq % blooms.length] as GeneratedQuestion['bloomLevel'],
        sourceChunkIds: [`chunk-${100 + seq}`, `chunk-${200 + seq}`],
        confidenceScore: Math.round((0.82 + Math.random() * 0.15) * 100) / 100,
        status: 'GENERATED',
        selected: true,
      });
      seq++;
    }
  }
  return {
    generationId: `gen-${Date.now()}`,
    courseId: req.courseId,
    unitId: req.unitId,
    modelUsed: 'gemini-2.5-pro (mock)',
    requestedAt: now,
    completedAt: now,
    questions,
  };
}

function coCodeFor(coId: string): string {
  const map: Record<string, string> = { 'co-1': 'CO1', 'co-2': 'CO2', 'co-3': 'CO3', 'co-4': 'CO4' };
  return map[coId] ?? 'CO2';
}
