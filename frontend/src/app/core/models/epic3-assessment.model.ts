import { BloomLevel } from './epic2-course-obe.model';

// Represents files uploaded to the RAG vector database for context
export interface KnowledgeDocument {
  documentId?: string;
  courseId: string;
  fileName: string;
  fileType: string;
  fileSizeKB: number;
  uploadedAt: string;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

// Represents a single question in the question bank
export interface Question {
  questionId?: string;
  courseId: string;
  coId: string; // Links the question directly to a Course Outcome
  bloomLevel: BloomLevel; // Ensures the question difficulty matches the CO
  questionText: string;
  marks: number;
  isAiGenerated: boolean;
  modelUsed?: string; // e.g., 'gemini-1.5-pro'
  status: 'DRAFT' | 'APPROVED' | 'REJECTED';
}

// Represents the final assembled exam paper
export interface Assessment {
  assessmentId?: string;
  courseId: string;
  academicYearId: string;
  title: string; // e.g., "Mid-Semester Examination 1"
  assessmentType: 'INTERNAL' | 'EXTERNAL' | 'ASSIGNMENT';
  totalMarks: number;
  durationMinutes: number;
  questions: Question[]; // Array of selected questions
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
}