/**
 * Module 1: Course & Offering Models (V1.0 ER Diagram Standards)
 */

export interface CourseMaster {
  courseId?: string;
  institutionId: string;
  courseCode: string;
  courseName: string;
  courseType: string;
  defaultCredits: number;
  category?: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CurriculumCourse {
  curriculumCourseId?: string;
  curriculumId: string;
  semesterId: string;
  courseId: string;
  isElective: boolean;
  isMandatory: boolean;
  credits: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ElectiveGroup {
  electiveGroupId?: string;
  semesterId: string;
  groupName: string;
  groupType: 'PE' | 'OE';
  minSelection: number;
  maxSelection: number;
  creditsRequired?: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CourseOffering {
  courseOfferingId?: string;
  curriculumCourseId: string;
  academicYearId: string;
  offeringName?: string;
  plannedCredits?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface CourseSection {
  courseSectionId?: string;
  courseOfferingId: string;
  sectionName: string;
  sectionCode: string;
  capacity?: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CourseFacultyAssignment {
  courseFacultyId?: string;
  courseSectionId?: string;
  facultyUserId: string;
  assignmentRole: string;
}