/**
 * Module 1: Course & Offering Models
 * Maps to courses, curriculum_courses, elective_groups, course_offerings, and course_faculty tables.
 */

export interface CourseMaster {
  id: string;
  institutionId: string;
  courseCode: string;          // e.g., 'EC301'
  courseName: string;          // e.g., 'Digital Signal Processing'
  credits: number;             // e.g., 4
  lectureHoursPerWeek: number;
  tutorialHoursPerWeek: number;
  practicalHoursPerWeek: number;
  courseType: 'THEORY' | 'PRACTICAL' | 'HYBRID';
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CurriculumCourse {
  id: string;
  curriculumId: string;
  semesterId: string;
  courseId: string;
  courseCategory: 'CORE' | 'PROFESSIONAL_ELECTIVE' | 'OPEN_ELECTIVE' | 'MANDATORY_AUDIT';
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ElectiveGroup {
  id: string;
  semesterId: string;
  groupName: string;           // e.g., 'Professional Elective - I'
  minSelections: number;
  maxSelections: number;
}

export interface CourseOffering {
  id: string;
  curriculumCourseId: string;
  academicYearId: string;
  sectionCode?: string;        // Optional minimal section support (e.g., 'A', 'B')
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface CourseFacultyAssignment {
  id: string;
  courseOfferingId: string;
  facultyUserId: string;
  assignmentRole: 'PRIMARY_LECTURER' | 'LAB_ASSISTANT' | 'CO_INSTRUCTOR';
}