// src/app/shared/models/faculty.model.ts

export interface FacultyMetrics {
  assignedCourses: number;
  examsPendingReview: number;
  overallCoAttainment: number;
}

export interface ActiveCourse {
  courseId: number;
  courseCode: string;
  courseName: string;
  coPoStatus: 'Mapped & Approved' | 'Pending Review' | 'Not Started';
  aiQuestionStatus: 'Draft Created' | 'Not Started' | 'Completed';
}