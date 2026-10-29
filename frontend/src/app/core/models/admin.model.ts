/**
 * API_CONTRACT §6 (academic reads) and §16 (Super Admin): institution, academic
 * years, departments, programs, and users with their roles.
 */
import { ID, IsoDate, IsoDateTime } from './common.model';

export type SystemRole = 'SUPER_ADMIN' | 'HOD' | 'FACULTY' | 'COORDINATOR';
export type RecordStatus = 'ACTIVE' | 'INACTIVE';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED';

export const ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  HOD: 'Head of department',
  FACULTY: 'Faculty',
  COORDINATOR: 'Coordinator',
};

/** ADM-1 */
export interface Institution {
  institutionId: ID;
  institutionCode: string;
  institutionName: string;
  /** "wit.edu": user emails must use one of these. */
  emailDomains: string[];
  status: RecordStatus;
}
export type InstitutionUpdate = Omit<Institution, 'institutionId'>;

/** ACAD-1, ACAD-2, ADM-2 */
export interface AcademicYear {
  academicYearId: ID;
  /** "2026-27" */
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  isCurrent: boolean;
}
export interface AcademicYearCreate { name: string; startDate: IsoDate; endDate: IsoDate; }
export type AcademicYearUpdate = Partial<AcademicYearCreate & { status: AcademicYear['status'] }>;

/** ACAD-3, ADM-3 */
export interface Department {
  departmentId: ID;
  departmentCode: string;
  departmentName: string;
  status: RecordStatus;
}
export interface DepartmentCreate { departmentCode: string; departmentName: string; }
export type DepartmentUpdate = Partial<{ departmentName: string; status: RecordStatus }>;

/** ACAD-4, ADM-4 */
export interface Program {
  programId: ID;
  departmentId: ID;
  programCode: string;
  programName: string;
  programLevel: 'UG' | 'PG';
  status: RecordStatus;
}
export type ProgramCreate = Omit<Program, 'programId' | 'status'>;
export type ProgramUpdate = Partial<Pick<Program, 'programName' | 'programLevel' | 'status'>>;

/** ADM-12 */
export interface AdminUser {
  userId: ID;
  userCode?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  roles: SystemRole[];
  primaryRole: SystemRole;
  departmentId?: ID;
  departmentName?: string;
  /** The department a COORDINATOR coordinates. */
  coordinatorDepartmentId?: ID;
  status: UserStatus;
  /** False until the person sets a password from their invitation link. */
  hasPassword: boolean;
  lastLoginAt?: IsoDateTime;
}

export interface UserCreate {
  userCode?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId?: ID;
  roles: SystemRole[];
  primaryRole: SystemRole;
  coordinatorDepartmentId?: ID;
}

/** PATCH: omitted fields stay as they are. `departmentId: ''` clears the department. */
export type UserUpdate = Partial<Pick<AdminUser, 'userCode' | 'firstName' | 'lastName' | 'phone' | 'departmentId' | 'status'>>;

export interface RolesUpdate {
  roles: SystemRole[];
  primaryRole: SystemRole;
  /** Required when `roles` includes COORDINATOR. */
  coordinatorDepartmentId?: ID;
}

export interface UserQuery {
  q?: string;
  role?: SystemRole;
  departmentId?: ID;
  status?: UserStatus;
  page?: number;
  size?: number;
}
