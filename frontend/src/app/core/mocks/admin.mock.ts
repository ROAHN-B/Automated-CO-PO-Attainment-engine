/**
 * In-memory stand-in for API_CONTRACT §6 and §16, used when the "admin" area
 * isn't live (environment.liveAreas). Mirrors the backend's main rules so the
 * screens behave the same; the backend stays the authority.
 */
import { Page } from '../models/common.model';
import {
  AcademicYear, AcademicYearCreate, AcademicYearUpdate, AdminUser, Department, DepartmentCreate, DepartmentUpdate,
  Institution, InstitutionUpdate, Program, ProgramCreate, ProgramUpdate, RolesUpdate, UserCreate, UserQuery, UserUpdate,
} from '../models/admin.model';
import { MockError } from './mock-error';

const CHECK = 'Check the highlighted fields.';
let seq = 100;
const nextId = (prefix: string) => `${prefix}-${++seq}`;
const invalid = (field: string, message: string) => new MockError(400, 'VALIDATION_FAILED', CHECK, { [field]: message });

export class AdminMockStore {
  private institutionRecord: Institution = {
    institutionId: 'inst-wit', institutionCode: 'WIT', institutionName: 'Walchand Institute of Technology',
    emailDomains: ['wit.edu'], status: 'ACTIVE',
  };

  private years: AcademicYear[] = [
    { academicYearId: 'ay-2025', name: '2025-26', startDate: '2025-07-01', endDate: '2026-06-30', status: 'ACTIVE', isCurrent: false },
    { academicYearId: 'ay-2026', name: '2026-27', startDate: '2026-07-01', endDate: '2027-06-30', status: 'ACTIVE', isCurrent: true },
  ];

  private departmentList: Department[] = [
    ['CIVIL', 'Civil Engineering'], ['CSE', 'Computer Science'], ['ECE', 'Electronics and Computer Engineering'],
    ['IT', 'Information Technology'], ['MECH', 'Mechanical and Automation'],
  ].map(([code, name]) => ({ departmentId: `dept-${code.toLowerCase()}`, departmentCode: code, departmentName: name, status: 'ACTIVE' }));

  private programList: Program[] = [
    { programId: 'prog-btech-ece', departmentId: 'dept-ece', programCode: 'BTECH-ECE', programName: 'B.Tech Electronics and Computer Engineering', programLevel: 'UG', status: 'ACTIVE' },
  ];

  private users: AdminUser[] = [
    this.seedUser('usr-admin', 'ADM001', 'System', 'Administrator', 'superadmin@wit.edu', ['SUPER_ADMIN'], 'SUPER_ADMIN'),
    this.seedUser('usr-hod', 'HOD-ECE', 'Head', 'of Department', 'hod.ecm@wit.edu', ['HOD'], 'HOD', 'dept-ece'),
    { ...this.seedUser('usr-crd', 'FAC-COORD', 'Sneha', 'Kulkarni', 'coordinator@wit.edu', ['COORDINATOR', 'FACULTY'], 'COORDINATOR', 'dept-ece'), coordinatorDepartmentId: 'dept-ece' },
    this.seedUser('usr-fac', 'FAC-002', 'Rohan', 'Belsare', 'faculty@wit.edu', ['FACULTY'], 'FACULTY', 'dept-ece'),
  ];

  /* ---- institution ---- */

  institution(): Institution { return { ...this.institutionRecord }; }

  saveInstitution(body: InstitutionUpdate): Institution {
    const domains = [...new Set(body.emailDomains.map(d => d.trim().toLowerCase()).filter(Boolean))];
    if (!domains.length) throw invalid('emailDomains', 'Add at least one email domain.');
    const bad = domains.findIndex(d => !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d));
    if (bad >= 0) throw invalid(`emailDomains[${bad}]`, 'Enter a domain such as wit.edu.');
    this.institutionRecord = { ...this.institutionRecord, ...body, institutionCode: body.institutionCode.trim().toUpperCase(), emailDomains: domains };
    return this.institution();
  }

  /* ---- academic years ---- */

  academicYears(status?: string): AcademicYear[] {
    return this.years.filter(y => !status || y.status === status)
      .sort((a, b) => b.startDate.localeCompare(a.startDate)).map(y => ({ ...y }));
  }

  createAcademicYear(body: AcademicYearCreate): AcademicYear {
    if (this.years.some(y => y.name === body.name)) throw new MockError(409, 'DUPLICATE_ACADEMIC_YEAR', `Academic year ${body.name} already exists.`);
    const y: AcademicYear = { academicYearId: nextId('ay'), ...body, status: 'ACTIVE', isCurrent: false };
    this.checkYear(y);
    this.years.push(y);
    return { ...y };
  }

  updateAcademicYear(id: string, body: AcademicYearUpdate): AcademicYear {
    const y = this.year(id);
    if (body.status && body.status !== 'ACTIVE' && y.isCurrent) {
      throw new MockError(409, 'INVALID_STATE', 'This is the current academic year. Make another year current first.');
    }
    const next = { ...y, ...body };
    this.checkYear(next);
    Object.assign(y, next);
    return { ...y };
  }

  makeCurrent(id: string): AcademicYear {
    const y = this.year(id);
    if (y.status !== 'ACTIVE') throw new MockError(409, 'INVALID_STATE', 'Only an active academic year can be made current.');
    this.years.forEach(o => o.isCurrent = o === y);
    return { ...y };
  }

  private year(id: string): AcademicYear {
    const y = this.years.find(o => o.academicYearId === id);
    if (!y) throw new MockError(404, 'NOT_FOUND', 'Academic year not found.');
    return y;
  }

  private checkYear(y: { name: string; startDate: string; endDate: string }): void {
    const m = /^(\d{4})-(\d{2})$/.exec(y.name);
    if (!m) throw invalid('name', 'Use the form 2026-27.');
    if (+m[2] !== (+m[1] + 1) % 100) throw invalid('name', 'The second part must be the next year, e.g. 2026-27.');
    if (!y.startDate.startsWith(m[1])) throw invalid('startDate', `The year must start in ${m[1]}.`);
    if (!(y.endDate > y.startDate)) throw invalid('endDate', 'The end date must be after the start date.');
  }

  /* ---- departments ---- */

  departments(): Department[] {
    return [...this.departmentList].sort((a, b) => a.departmentCode.localeCompare(b.departmentCode)).map(d => ({ ...d }));
  }

  createDepartment(body: DepartmentCreate): Department {
    const code = body.departmentCode.trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,12}$/.test(code)) throw invalid('departmentCode', 'Use 2 to 12 letters, digits or dashes.');
    if (!body.departmentName.trim()) throw invalid('departmentName', 'Enter a name.');
    if (this.departmentList.some(d => d.departmentCode === code)) throw new MockError(409, 'DUPLICATE_DEPARTMENT', `A department with code ${code} already exists.`);
    const d: Department = { departmentId: nextId('dept'), departmentCode: code, departmentName: body.departmentName.trim(), status: 'ACTIVE' };
    this.departmentList.push(d);
    return { ...d };
  }

  updateDepartment(id: string, body: DepartmentUpdate): Department {
    const d = this.departmentList.find(o => o.departmentId === id);
    if (!d) throw new MockError(404, 'NOT_FOUND', 'Department not found.');
    if (body.departmentName !== undefined && !body.departmentName.trim()) throw invalid('departmentName', 'Enter a name.');
    Object.assign(d, body);
    return { ...d };
  }

  /* ---- programs ---- */

  programs(departmentId?: string): Program[] {
    return this.programList.filter(p => !departmentId || p.departmentId === departmentId)
      .sort((a, b) => a.programCode.localeCompare(b.programCode)).map(p => ({ ...p }));
  }

  createProgram(body: ProgramCreate): Program {
    if (!this.activeDepartment(body.departmentId)) throw invalid('departmentId', 'Choose an active department.');
    const code = body.programCode.trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,12}$/.test(code)) throw invalid('programCode', 'Use 2 to 12 letters, digits or dashes.');
    if (!body.programName.trim()) throw invalid('programName', 'Enter a name.');
    if (this.programList.some(p => p.departmentId === body.departmentId && p.programCode === code)) {
      throw new MockError(409, 'DUPLICATE_PROGRAM', `This department already has a program with code ${code}.`);
    }
    const p: Program = { ...body, programId: nextId('prog'), programCode: code, programName: body.programName.trim(), status: 'ACTIVE' };
    this.programList.push(p);
    return { ...p };
  }

  updateProgram(id: string, body: ProgramUpdate): Program {
    const p = this.programList.find(o => o.programId === id);
    if (!p) throw new MockError(404, 'NOT_FOUND', 'Program not found.');
    if (body.programName !== undefined && !body.programName.trim()) throw invalid('programName', 'Enter a name.');
    Object.assign(p, body);
    return { ...p };
  }

  /* ---- users and roles ---- */

  userList(q: UserQuery): Page<AdminUser> {
    const term = q.q?.trim().toLowerCase();
    const all = this.users
      .filter(u => !term || [u.fullName, u.email, u.userCode ?? ''].some(v => v.toLowerCase().includes(term)))
      .filter(u => !q.role || u.roles.includes(q.role))
      .filter(u => !q.departmentId || u.departmentId === q.departmentId)
      .filter(u => !q.status || u.status === q.status)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    const size = q.size ?? 20, page = q.page ?? 0;
    return {
      content: all.slice(page * size, page * size + size).map(u => this.withDepartment(u)),
      page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size),
    };
  }

  createUser(body: UserCreate): AdminUser {
    const email = body.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw invalid('email', 'Enter a valid email address.');
    const domains = this.institutionRecord.emailDomains;
    if (!domains.includes(email.split('@')[1])) throw invalid('email', `Use a college email address (${domains.join(', ')}).`);
    if (!body.firstName.trim()) throw invalid('firstName', 'Enter a first name.');
    if (!body.lastName.trim()) throw invalid('lastName', 'Enter a last name.');
    if (this.users.some(u => u.email === email)) throw new MockError(409, 'DUPLICATE_USER', 'A user with this email already exists.');
    const code = body.userCode?.trim().toUpperCase() || undefined;
    this.checkCode(code);
    const departmentId = body.departmentId || undefined;
    if (departmentId && !this.activeDepartment(departmentId)) throw invalid('departmentId', 'Choose an active department.');
    const coordinatorDepartmentId = this.checkRoles(body, departmentId);
    const u: AdminUser = {
      userId: nextId('usr'), userCode: code, firstName: body.firstName.trim(), lastName: body.lastName.trim(),
      fullName: `${body.firstName.trim()} ${body.lastName.trim()}`, email, phone: body.phone?.trim() || undefined,
      roles: [...body.roles].sort(), primaryRole: body.primaryRole, departmentId, coordinatorDepartmentId,
      status: 'ACTIVE', hasPassword: false,
    };
    this.users.push(u);
    return this.withDepartment(u);
  }

  updateUser(id: string, body: UserUpdate, me: string): AdminUser {
    const u = this.user(id);
    if (body.status && body.status !== 'ACTIVE' && u.email === me) {
      throw new MockError(409, 'INVALID_STATE', 'You can’t deactivate or lock your own account.');
    }
    if (body.userCode !== undefined) {
      const code = body.userCode.trim().toUpperCase() || undefined;
      this.checkCode(code, id);
      u.userCode = code;
    }
    if (body.departmentId !== undefined) {
      const departmentId = body.departmentId || undefined;
      if (departmentId && !this.activeDepartment(departmentId)) throw invalid('departmentId', 'Choose an active department.');
      this.checkRoles(u, departmentId);
      u.departmentId = departmentId;
    }
    if (body.firstName !== undefined) u.firstName = body.firstName.trim();
    if (body.lastName !== undefined) u.lastName = body.lastName.trim();
    if (body.phone !== undefined) u.phone = body.phone.trim() || undefined;
    if (body.status) u.status = body.status;
    u.fullName = `${u.firstName} ${u.lastName}`;
    return this.withDepartment(u);
  }

  setRoles(id: string, body: RolesUpdate, me: string): AdminUser {
    const u = this.user(id);
    if (u.email === me && !body.roles.includes('SUPER_ADMIN')) {
      throw new MockError(409, 'INVALID_STATE', 'You can’t remove the Super Admin role from your own account.');
    }
    u.coordinatorDepartmentId = this.checkRoles(body, u.departmentId);
    u.roles = [...body.roles].sort();
    u.primaryRole = body.primaryRole;
    return this.withDepartment(u);
  }

  private checkRoles(r: RolesUpdate, departmentId?: string): string | undefined {
    if (!r.roles.length) throw invalid('roles', 'Choose at least one role.');
    if (!r.roles.includes(r.primaryRole)) throw invalid('primaryRole', 'The primary role must be one of the user’s roles.');
    if (r.roles.some(x => x !== 'SUPER_ADMIN') && !departmentId) {
      throw invalid('departmentId', 'Faculty, HOD and coordinators belong to a department.');
    }
    if (!r.roles.includes('COORDINATOR')) return undefined;
    if (!r.roles.includes('FACULTY')) throw invalid('roles', 'A coordinator must also hold the Faculty role.');
    if (!r.coordinatorDepartmentId || !this.activeDepartment(r.coordinatorDepartmentId)) {
      throw invalid('coordinatorDepartmentId', 'Choose the department this person coordinates.');
    }
    return r.coordinatorDepartmentId;
  }

  private checkCode(code: string | undefined, ownId?: string): void {
    if (code && this.users.some(u => u.userCode === code && u.userId !== ownId)) {
      throw new MockError(409, 'DUPLICATE_USER', `Another user already has the code ${code}.`);
    }
  }

  private user(id: string): AdminUser {
    const u = this.users.find(o => o.userId === id);
    if (!u) throw new MockError(404, 'NOT_FOUND', 'User not found.');
    return u;
  }

  private activeDepartment(id: string): Department | undefined {
    return this.departmentList.find(d => d.departmentId === id && d.status === 'ACTIVE');
  }

  private withDepartment(u: AdminUser): AdminUser {
    return { ...u, roles: [...u.roles], departmentName: this.departmentList.find(d => d.departmentId === u.departmentId)?.departmentName };
  }

  private seedUser(userId: string, userCode: string, firstName: string, lastName: string, email: string,
                   roles: AdminUser['roles'], primaryRole: AdminUser['primaryRole'], departmentId?: string): AdminUser {
    return { userId, userCode, firstName, lastName, fullName: `${firstName} ${lastName}`, email, roles: [...roles].sort(), primaryRole,
             departmentId, status: 'ACTIVE', hasPassword: true };
  }
}
