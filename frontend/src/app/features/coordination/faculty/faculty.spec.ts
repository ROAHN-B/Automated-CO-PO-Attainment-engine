import { CoordinationMockStore, facultyErrors, normalisePhone } from '../../../core/mocks/coordination.mock';
import { MockError } from '../../../core/mocks/mock-error';

function errorOf(fn: () => unknown): MockError {
  try { fn(); } catch (e) { return e as MockError; }
  throw new Error('expected an error');
}

const HEADER = ['First Name', 'Last Name', 'Email ID', 'Phone Number'];

describe('Coordinator faculty list (API_CONTRACT v2.8 §15.3)', () => {
  let store: CoordinationMockStore;
  beforeEach(() => { store = new CoordinationMockStore({ demoHistory: false }); });

  describe('field rules (shared by the form and the import)', () => {
    it('accepts the ways people write an Indian mobile number', () => {
      for (const raw of ['9876543210', '+91 98765 43210', '98765-43210', '919876543210', '09876543210']) {
        expect(normalisePhone(raw)).withContext(raw).toBe('9876543210');
      }
      for (const raw of ['5876543210', '987654321', '98765432100', 'phone']) {
        expect(normalisePhone(raw)).withContext(raw).toBeNull();
      }
    });

    it('requires names and a college email', () => {
      const errs = facultyErrors({ firstName: ' ', lastName: 'Patil', email: 'rahul@gmail.com', phone: '9876543210' });
      expect(errs.map(e => e.field)).toEqual(['firstName', 'email']);
      expect(errs[1].message).toContain('@wit.edu');
    });
  });

  describe('list, add and edit (CRD-1 to CRD-3)', () => {
    it('lists the seeded department faculty sorted by surname, with search and paging', () => {
      const all = store.facultyList({ size: 100 });
      expect(all.totalElements).toBe(10);
      expect(all.content[0].lastName).toBe('Belsare');
      expect(store.facultyList({ search: 'PATIL' }).content.map(f => f.fullName)).toEqual(['Amit Patil']);
      const page2 = store.facultyList({ page: 1, size: 4 });
      expect([page2.content.length, page2.totalPages]).toEqual([4, 3]);
    });

    it('adds a member with tidied fields and no invitation', () => {
      const f = store.createFaculty({ firstName: ' Rahul ', lastName: 'Kadam', email: 'Rahul.Kadam@WIT.edu', phone: '+91 98765 43210' });
      expect([f.fullName, f.email, f.phone, f.credentialStatus]).toEqual(['Rahul Kadam', 'rahul.kadam@wit.edu', '9876543210', 'NOT_INVITED']);
    });

    it('returns field errors for invalid input and 409 for a taken email', () => {
      const bad = errorOf(() => store.createFaculty({ firstName: '', lastName: 'X', email: 'x@wit.edu', phone: '12' }));
      expect([bad.status, bad.errorCode]).toEqual([400, 'VALIDATION_FAILED']);
      expect(Object.keys(bad.fieldErrors ?? {})).toEqual(['firstName', 'phone']);

      const dup = errorOf(() => store.createFaculty({ firstName: 'A', lastName: 'B', email: 'AMIT.PATIL@wit.edu', phone: '9876543210' }));
      expect([dup.status, dup.errorCode]).toEqual([409, 'DUPLICATE_EMAIL']);
      expect(dup.fieldErrors?.['email']).toContain('Amit Patil');
    });

    it('lets a member keep their own email when edited', () => {
      const amit = store.facultyList({ search: 'amit' }).content[0];
      expect(store.updateFaculty(amit.userId, { email: amit.email, lastName: 'Patil-Rao' }).fullName).toBe('Amit Patil-Rao');
    });

    it('unlocks the setup\'s syllabus step only while someone is active', () => {
      const setupId = store.createSetup({ academicYearId: 'ay-2026-27', semesterNumber: 4 }).setupId;
      for (const f of store.facultyList({ size: 100 }).content) store.updateFaculty(f.userId, { status: 'INACTIVE' });
      const steps = store.setup(setupId).steps;
      expect(steps[0].state.status).toBe('AVAILABLE');
      expect(steps[1].state).toEqual(jasmine.objectContaining({ status: 'LOCKED' }));
      expect(store.overview().facultyCount).toBe(0);
    });

    it('resends an invitation only when one was sent', () => {
      const rohan = store.facultyList({ search: 'rohan' }).content[0];
      const rahul = store.facultyList({ search: 'rahul' }).content[0];
      expect(errorOf(() => store.resendInvite(rohan.userId)).errorCode).toBe('INVALID_STATE');
      expect(errorOf(() => store.resendInvite(rahul.userId)).message).toContain('first allocation email');
    });
  });

  describe('Excel import (CRD-16 to CRD-18)', () => {
    it('only takes .xlsx files up to 2 MB', () => {
      expect(errorOf(() => store.checkUpload('faculty.csv', 100)).status).toBe(415);
      expect(errorOf(() => store.checkUpload('faculty.xlsx', 3 * 1024 * 1024)).status).toBe(413);
      expect(() => store.checkUpload('Faculty.XLSX', 1000)).not.toThrow();
    });

    it('reports missing columns as file errors and imports nothing', () => {
      const p = store.importPreview('f.xlsx', [['First Name', 'Surname', 'Email ID'], ['A', 'B', 'a@wit.edu']]);
      expect(p.fileErrors).toEqual(['The column "Last Name" is missing.', 'The column "Phone Number" is missing.']);
      expect(p.rows).toEqual([]);
      expect(errorOf(() => store.commitImport(p.importId)).status).toBe(422);
    });

    it('matches headers loosely, skips blank rows and classifies every row', () => {
      const p = store.importPreview('f.xlsx', [
        [],
        ['  first   NAME ', 'last name', 'EMAIL ID', 'Phone Number'],
        ['Rahul', 'Kadam', 'rahul.kadam@wit.edu', '98765 43210'],
        ['', '', '', ''],
        ['Rahul', 'Kadam', 'RAHUL.KADAM@wit.edu', '9876543210'],
        ['Amit', 'Patil', 'amit.patil@wit.edu', '9000000003'],
        ['Meera', '', 'meera@gmail.com', '123'],
      ]);
      expect(p.fileErrors).toEqual([]);
      expect(p.rows.map(r => [r.rowNumber, r.status])).toEqual([
        [3, 'VALID'], [5, 'DUPLICATE_IN_FILE'], [6, 'ALREADY_EXISTS'], [7, 'INVALID'],
      ]);
      expect(p.rows[3].errors.map(e => e.field)).toEqual(['lastName', 'email', 'phone']);
      expect(p.counts).toEqual({ valid: 1, invalid: 1, duplicateInFile: 1, alreadyExists: 1 });
    });

    it('does not count a row as a duplicate of an earlier invalid row', () => {
      const p = store.importPreview('f.xlsx', [HEADER, ['', 'Kadam', 'r.k@wit.edu', '9876543210'], ['Rahul', 'Kadam', 'r.k@wit.edu', '9876543210']]);
      expect(p.rows.map(r => r.status)).toEqual(['INVALID', 'VALID']);
    });

    it('writes nothing until confirmed, then creates only the valid rows, once', () => {
      const before = store.facultyList({ size: 100 }).totalElements;
      const p = store.importPreview('f.xlsx', [HEADER, ['Rahul', 'Kadam', 'rahul.kadam@wit.edu', '9876543210'], ['Bad', 'Row', 'nope', '1']]);
      expect(store.facultyList({ size: 100 }).totalElements).toBe(before);

      const r = store.commitImport(p.importId);
      expect([r.created.map(f => f.email), r.skipped]).toEqual([['rahul.kadam@wit.edu'], 1]);
      expect(store.facultyList({ size: 100 }).totalElements).toBe(before + 1);
      expect(errorOf(() => store.commitImport(p.importId)).status).toBe(404);
    });

    it('refuses more than 500 faculty in one file', () => {
      const rows = [HEADER, ...Array.from({ length: 501 }, (_, i) => ['A', 'B', `a${i}@wit.edu`, '9876543210'])];
      expect(errorOf(() => store.importPreview('f.xlsx', rows)).status).toBe(422);
    });
  });
});
