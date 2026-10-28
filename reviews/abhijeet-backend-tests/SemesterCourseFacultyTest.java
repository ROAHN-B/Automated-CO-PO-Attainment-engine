package com.copo.attainment_engine.review;

import com.copo.attainment_engine.academic.controller.SemesterController;
import com.copo.attainment_engine.academic.dto.CourseRequest;
import com.copo.attainment_engine.academic.model.Course;
import com.copo.attainment_engine.academic.model.Department;
import com.copo.attainment_engine.academic.model.ProgramYear;
import com.copo.attainment_engine.academic.model.Semester;
import com.copo.attainment_engine.academic.repository.CourseRepository;
import com.copo.attainment_engine.academic.repository.DepartmentRepository;
import com.copo.attainment_engine.academic.repository.ProgramYearRepository;
import com.copo.attainment_engine.academic.repository.SemesterRepository;
import com.copo.attainment_engine.academic.service.CourseService;
import com.copo.attainment_engine.faculty.dto.FacultyCourseAssignmentRequest;
import com.copo.attainment_engine.faculty.dto.FacultyRequest;
import com.copo.attainment_engine.faculty.model.Faculty;
import com.copo.attainment_engine.faculty.model.FacultyCourseAssignment;
import com.copo.attainment_engine.faculty.repository.FacultyCourseAssignmentRepository;
import com.copo.attainment_engine.faculty.repository.FacultyRepository;
import com.copo.attainment_engine.faculty.service.FacultyCourseAssignmentService;
import com.copo.attainment_engine.faculty.service.FacultyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;
import java.util.Optional;

import static com.copo.attainment_engine.review.AcademicStructureServiceTest.status;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Service/controller tests for the modules added in this zip: Semester, Course, Faculty, assignments. */
class SemesterCourseFacultyTest {

    // ------------------------------------------------------------------ Semester
    @Nested
    @DisplayName("Semester")
    class SemesterTests {
        SemesterRepository semesters = mock(SemesterRepository.class);
        ProgramYearRepository years = mock(ProgramYearRepository.class);
        SemesterController controller = new SemesterController(semesters, years);

        void yearWith(int n, String status) {
            ProgramYear y = new ProgramYear();
            y.setId("y" + n);
            y.setYearNumber(n);
            y.setStatus(status);
            when(years.findById("y" + n)).thenReturn(Optional.of(y));
        }

        Semester request(String yearId, Integer number) {
            Semester s = new Semester();
            s.setProgramYearId(yearId);
            s.setSemesterNumber(number);
            return s;
        }

        @BeforeEach
        void setUp() { when(semesters.save(any())).thenAnswer(inv -> inv.getArgument(0)); }

        @ParameterizedTest(name = "year {0} -> semester {1}")
        @CsvSource({"1,1", "1,2", "2,3", "2,4", "3,5", "3,6", "4,7", "4,8"})
        void eachYearOwnsTwoSemesters(int year, int sem) {
            yearWith(year, "ACTIVE");
            Semester saved = controller.create(request("y" + year, sem));
            assertThat(saved.getSemesterName()).isEqualTo("Semester " + sem);
            assertThat(saved.getStatus()).isEqualTo("ACTIVE");
        }

        @ParameterizedTest(name = "year {0} rejects semester {1}")
        @CsvSource({"1,3", "2,1", "2,5", "4,6", "1,0", "4,9", "3,-5"})
        void otherSemestersAre400(int year, int sem) {
            yearWith(year, "ACTIVE");
            assertThat(status(catchThrowable(() -> controller.create(request("y" + year, sem))))).isEqualTo(400);
        }

        @Test
        void missingFieldsAre400() {
            assertThat(status(catchThrowable(() -> controller.create(request(null, 1))))).isEqualTo(400);
            assertThat(status(catchThrowable(() -> controller.create(request(" ", 1))))).isEqualTo(400);
            assertThat(status(catchThrowable(() -> controller.create(request("y1", null))))).isEqualTo(400);
        }

        @Test
        void unknownProgramYearIs404() {
            when(years.findById("nope")).thenReturn(Optional.empty());
            assertThat(status(catchThrowable(() -> controller.create(request("nope", 1))))).isEqualTo(404);
        }

        @Test
        void duplicateSemesterIs409() {
            yearWith(1, "ACTIVE");
            when(semesters.existsByProgramYearIdAndSemesterNumber("y1", 1)).thenReturn(true);
            assertThat(status(catchThrowable(() -> controller.create(request("y1", 1))))).isEqualTo(409);
        }

        @Test
        @DisplayName("[BUG] a semester can't be added to an INACTIVE program year")
        void inactiveYearRejected() {
            yearWith(2, "INACTIVE");
            assertThat(catchThrowable(() -> controller.create(request("y2", 3)))).isNotNull();
        }

        @Test
        @DisplayName("[BUG] listing semesters of an unknown program year should be 404, not an empty list")
        void listUnknownYearIs404() {
            when(years.existsById("nope")).thenReturn(false);
            when(semesters.findByProgramYearId("nope")).thenReturn(List.of());
            assertThat(catchThrowable(() -> controller.list("nope"))).isNotNull();
        }
    }

    // ------------------------------------------------------------------ Course
    @Nested
    @DisplayName("Course")
    class CourseTests {
        CourseRepository courses = mock(CourseRepository.class);
        SemesterRepository semesters = mock(SemesterRepository.class);
        CourseService service = new CourseService(courses, semesters);

        @BeforeEach
        void setUp() {
            when(courses.save(any())).thenAnswer(inv -> inv.getArgument(0));
            Semester s = new Semester();
            s.setId("sem5");
            s.setStatus("ACTIVE");
            when(semesters.findById("sem5")).thenReturn(Optional.of(s));
            when(semesters.existsById("sem5")).thenReturn(true);
        }

        CourseRequest req(String code, String type, Integer credits) {
            CourseRequest r = new CourseRequest();
            r.setSemesterId(" sem5 ");
            r.setCourseCode(code);
            r.setCourseName("  Network Security ");
            r.setCourseType(type);
            r.setCredits(credits);
            return r;
        }

        @Test
        void createsTrimsAndUppercasesCode() {
            Course c = service.createCourse(req(" ec306 ", "CORE", 3));
            assertThat(c.getCourseCode()).isEqualTo("EC306");
            assertThat(c.getCourseName()).isEqualTo("Network Security");
            assertThat(c.getSemesterId()).isEqualTo("sem5");
            assertThat(c.getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        void duplicateCodeInSemesterIs409EvenWithDifferentCase() {
            when(courses.existsBySemesterIdAndCourseCode("sem5", "EC306")).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.createCourse(req("ec306", "CORE", 3))))).isEqualTo(409);
        }

        @Test
        void unknownSemesterIs404() {
            CourseRequest r = req("EC306", "CORE", 3);
            r.setSemesterId("missing");
            when(semesters.findById("missing")).thenReturn(Optional.empty());
            assertThat(status(catchThrowable(() -> service.createCourse(r)))).isEqualTo(404);
        }

        @Test
        void inactiveSemesterIs400() {
            Semester s = new Semester();
            s.setStatus("INACTIVE");
            when(semesters.findById("sem5")).thenReturn(Optional.of(s));
            assertThat(status(catchThrowable(() -> service.createCourse(req("EC306", "CORE", 3))))).isEqualTo(400);
        }

        @Test
        @DisplayName("[BUG] courseType must be one of the contract's CourseType values")
        void unknownCourseTypeRejected() {
            assertThat(catchThrowable(() -> service.createCourse(req("EC306", "banana", 3)))).isNotNull();
        }

        @Test
        void listUnknownSemesterIs404() {
            when(semesters.existsById("missing")).thenReturn(false);
            assertThat(status(catchThrowable(() -> service.getCoursesBySemester("missing")))).isEqualTo(404);
        }

        @Test
        @DisplayName("[BUG] a race past the existence check should be 409, not a raw DuplicateKeyException (500)")
        void raceIs409() {
            when(courses.save(any())).thenThrow(new org.springframework.dao.DuplicateKeyException("dup"));
            assertThat(status(catchThrowable(() -> service.createCourse(req("EC306", "CORE", 3))))).isEqualTo(409);
        }
    }

    // ------------------------------------------------------------------ Faculty
    @Nested
    @DisplayName("Faculty")
    class FacultyTests {
        FacultyRepository repo = mock(FacultyRepository.class);
        DepartmentRepository departments = mock(DepartmentRepository.class);
        FacultyService service = new FacultyService(repo, departments);

        @BeforeEach
        void setUp() {
            when(repo.save(any())).thenAnswer(inv -> {
                Faculty f = inv.getArgument(0);
                if (f.getId() == null) f.setId("f-new");
                return f;
            });
            Department d = new Department();
            d.setId("d1");
            d.setInstitutionId("i1");
            when(departments.findById("d1")).thenReturn(Optional.of(d));
        }

        FacultyRequest req(String code, String email) {
            FacultyRequest r = new FacultyRequest();
            r.setInstitutionId("i1");
            r.setDepartmentId("d1");
            r.setFacultyCode(code);
            r.setFullName(" Rohan Belsare ");
            r.setEmail(email);
            r.setDesignation("Assistant Professor");
            return r;
        }

        Faculty existing(String id, String code, String email) {
            Faculty f = new Faculty();
            f.setId(id);
            f.setInstitutionId("i1");
            f.setDepartmentId("d1");
            f.setFacultyCode(code);
            f.setEmail(email);
            return f;
        }

        @Test
        void createsWithNormalisedEmailAndActiveStatus() {
            var res = service.createFaculty(req("F001", " Rohan@WIT.edu "));
            assertThat(res.getEmail()).isEqualTo("rohan@wit.edu");
            assertThat(res.getFullName()).isEqualTo("Rohan Belsare");
            assertThat(res.getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        void unknownDepartmentIs404() {
            FacultyRequest r = req("F001", "a@wit.edu");
            r.setDepartmentId("missing");
            when(departments.findById("missing")).thenReturn(Optional.empty());
            assertThat(status(catchThrowable(() -> service.createFaculty(r)))).isEqualTo(404);
        }

        @Test
        void departmentOfAnotherInstitutionIs400() {
            FacultyRequest r = req("F001", "a@wit.edu");
            r.setInstitutionId("i2");
            assertThat(status(catchThrowable(() -> service.createFaculty(r)))).isEqualTo(400);
        }

        @Test
        void duplicateCodeIs409() {
            when(repo.existsByInstitutionIdAndFacultyCode("i1", "F001")).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.createFaculty(req("F001", "a@wit.edu"))))).isEqualTo(409);
        }

        @Test
        void duplicateEmailIs409() {
            when(repo.findByInstitutionIdAndEmailIgnoreCase("i1", "a@wit.edu"))
                    .thenReturn(Optional.of(existing("f9", "F009", "a@wit.edu")));
            assertThat(status(catchThrowable(() -> service.createFaculty(req("F001", "A@wit.edu"))))).isEqualTo(409);
        }

        @Test
        @DisplayName("[BUG] faculty codes differing only by case should be duplicates (course codes are uppercased)")
        void codeCaseNormalised() {
            when(repo.existsByInstitutionIdAndFacultyCode("i1", "F001")).thenReturn(true);
            assertThat(catchThrowable(() -> service.createFaculty(req("f001", "b@wit.edu")))).isNotNull();
        }

        @Test
        void updateCannotMoveInstitution() {
            when(repo.findById("f1")).thenReturn(Optional.of(existing("f1", "F001", "a@wit.edu")));
            FacultyRequest r = req("F001", "a@wit.edu");
            r.setInstitutionId("i2");
            assertThat(status(catchThrowable(() -> service.updateFaculty("f1", r)))).isEqualTo(400);
        }

        @Test
        void updateKeepingOwnCodeAndEmailIsFine() {
            Faculty me = existing("f1", "F001", "a@wit.edu");
            when(repo.findById("f1")).thenReturn(Optional.of(me));
            when(repo.findByInstitutionIdAndFacultyCode("i1", "F001")).thenReturn(Optional.of(me));
            when(repo.findByInstitutionIdAndEmailIgnoreCase("i1", "a@wit.edu")).thenReturn(Optional.of(me));
            assertThat(service.updateFaculty("f1", req("F001", "a@wit.edu")).getId()).isEqualTo("f1");
        }

        @Test
        void updateToSomeoneElsesCodeIs409() {
            when(repo.findById("f1")).thenReturn(Optional.of(existing("f1", "F001", "a@wit.edu")));
            when(repo.findByInstitutionIdAndFacultyCode("i1", "F002"))
                    .thenReturn(Optional.of(existing("f2", "F002", "b@wit.edu")));
            assertThat(status(catchThrowable(() -> service.updateFaculty("f1", req("F002", "a@wit.edu"))))).isEqualTo(409);
        }

        @Test
        void unknownFacultyIs404() {
            when(repo.findById("x")).thenReturn(Optional.empty());
            assertThat(status(catchThrowable(() -> service.getFacultyById("x")))).isEqualTo(404);
        }

        @Test
        @DisplayName("[BUG] faculty can't join an INACTIVE department")
        void inactiveDepartmentRejected() {
            Department d = new Department();
            d.setInstitutionId("i1");
            d.setStatus("INACTIVE");
            when(departments.findById("d1")).thenReturn(Optional.of(d));
            assertThat(catchThrowable(() -> service.createFaculty(req("F001", "a@wit.edu")))).isNotNull();
        }
    }

    // ------------------------------------------------------------------ Assignment
    @Nested
    @DisplayName("Faculty-course assignment")
    class AssignmentTests {
        FacultyCourseAssignmentRepository repo = mock(FacultyCourseAssignmentRepository.class);
        FacultyRepository faculty = mock(FacultyRepository.class);
        CourseRepository courses = mock(CourseRepository.class);
        FacultyCourseAssignmentService service = new FacultyCourseAssignmentService(repo, faculty, courses);

        @BeforeEach
        void setUp() {
            when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            Faculty f = new Faculty();
            f.setId("f1");
            f.setStatus("ACTIVE");
            when(faculty.findById("f1")).thenReturn(Optional.of(f));
            when(faculty.existsById("f1")).thenReturn(true);
            Course c = new Course();
            c.setId("c1");
            c.setStatus("ACTIVE");
            when(courses.findById("c1")).thenReturn(Optional.of(c));
        }

        FacultyCourseAssignmentRequest req(String year) {
            FacultyCourseAssignmentRequest r = new FacultyCourseAssignmentRequest();
            r.setFacultyId("f1");
            r.setCourseId("c1");
            r.setAcademicYear(year);
            return r;
        }

        @Test
        void assignsActivePair() {
            assertThat(service.assignCourse(req("2026-27")).getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        void unknownFacultyOrCourseIs404() {
            when(faculty.findById("f1")).thenReturn(Optional.empty());
            assertThat(status(catchThrowable(() -> service.assignCourse(req("2026-27"))))).isEqualTo(404);
        }

        @Test
        void inactiveCourseIs400() {
            Course c = new Course();
            c.setStatus("INACTIVE");
            when(courses.findById("c1")).thenReturn(Optional.of(c));
            assertThat(status(catchThrowable(() -> service.assignCourse(req("2026-27"))))).isEqualTo(400);
        }

        @Test
        void duplicateAssignmentIs409() {
            when(repo.existsByFacultyIdAndCourseIdAndAcademicYear("f1", "c1", "2026-27")).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.assignCourse(req("2026-27"))))).isEqualTo(409);
        }

        @Test
        @DisplayName("[BUG] academic year must be consecutive (2026-27), not 2026-99")
        void nonConsecutiveYearRejected() {
            assertThat(catchThrowable(() -> service.assignCourse(req("2026-99")))).isNotNull();
        }

        @Test
        void listsByFacultyAndYear() {
            FacultyCourseAssignment a = new FacultyCourseAssignment();
            a.setFacultyId("f1");
            a.setAcademicYear("2026-27");
            when(repo.findByFacultyIdAndAcademicYear("f1", "2026-27")).thenReturn(List.of(a));
            assertThat(service.getByFacultyAndYear("f1", "2026-27")).hasSize(1);
        }

        @Test
        void listUnknownFacultyIs404() {
            when(faculty.existsById("x")).thenReturn(false);
            assertThat(status(catchThrowable(() -> service.getByFaculty("x")))).isEqualTo(404);
        }
    }
}
