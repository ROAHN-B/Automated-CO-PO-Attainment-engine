import { AdminMockStore } from './admin.mock';
import { MockError } from './mock-error';

function errorOf(fn: () => unknown): MockError {
  try { fn(); } catch (e) { return e as MockError; }
  throw new Error('expected an error');
}

describe('AdminMockStore (mirrors the backend rules of API_CONTRACT §16)', () => {
  let store: AdminMockStore;
  const faculty = { firstName: 'Asha', lastName: 'Patil', departmentId: 'dept-ece', roles: ['FACULTY' as const], primaryRole: 'FACULTY' as const };

  beforeEach(() => store = new AdminMockStore());

  it('accepts only college emails and no duplicates', () => {
    expect(errorOf(() => store.createUser({ ...faculty, email: 'asha@gmail.com' })).fieldErrors?.['email']).toContain('wit.edu');
    const u = store.createUser({ ...faculty, email: 'Asha@WIT.edu' });
    expect(u.email).toBe('asha@wit.edu');
    expect(u.hasPassword).toBeFalse();
    expect(errorOf(() => store.createUser({ ...faculty, email: 'asha@wit.edu' })).errorCode).toBe('DUPLICATE_USER');
  });

  it('needs Faculty and a coordinated department for a coordinator', () => {
    const u = store.createUser({ ...faculty, email: 'asha@wit.edu' });
    expect(errorOf(() => store.setRoles(u.userId, { roles: ['COORDINATOR'], primaryRole: 'COORDINATOR', coordinatorDepartmentId: 'dept-ece' }, ''))
      .fieldErrors?.['roles']).toBeDefined();
    expect(errorOf(() => store.setRoles(u.userId, { roles: ['FACULTY', 'COORDINATOR'], primaryRole: 'COORDINATOR' }, ''))
      .fieldErrors?.['coordinatorDepartmentId']).toBeDefined();
    const granted = store.setRoles(u.userId, { roles: ['FACULTY', 'COORDINATOR'], primaryRole: 'COORDINATOR', coordinatorDepartmentId: 'dept-ece' }, '');
    expect(granted.coordinatorDepartmentId).toBe('dept-ece');
    expect(store.userList({ role: 'COORDINATOR' }).content.map(x => x.email)).toContain('asha@wit.edu');
  });

  it('keeps a Super Admin from locking themselves out', () => {
    expect(errorOf(() => store.setRoles('usr-admin', { roles: ['HOD'], primaryRole: 'HOD' }, 'superadmin@wit.edu')).errorCode).toBe('INVALID_STATE');
    expect(errorOf(() => store.updateUser('usr-admin', { status: 'INACTIVE' }, 'superadmin@wit.edu')).errorCode).toBe('INVALID_STATE');
  });

  it('keeps exactly one current academic year, and only an active one', () => {
    const y = store.createAcademicYear({ name: '2027-28', startDate: '2027-07-01', endDate: '2028-06-30' });
    store.makeCurrent(y.academicYearId);
    expect(store.academicYears().filter(x => x.isCurrent).map(x => x.name)).toEqual(['2027-28']);
    expect(errorOf(() => store.updateAcademicYear(y.academicYearId, { status: 'ARCHIVED' })).errorCode).toBe('INVALID_STATE');
    expect(errorOf(() => store.createAcademicYear({ name: '2028-30', startDate: '2028-07-01', endDate: '2029-06-30' })).fieldErrors?.['name']).toBeDefined();
  });
});
