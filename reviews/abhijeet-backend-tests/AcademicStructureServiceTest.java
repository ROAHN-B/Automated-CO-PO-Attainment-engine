package com.copo.attainment_engine.review;

import com.copo.attainment_engine.academic.model.*;
import com.copo.attainment_engine.academic.repository.*;
import com.copo.attainment_engine.academic.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Service-level tests for the five Module 1 collections (repositories mocked, no database). */
class AcademicStructureServiceTest {

    static int status(Throwable t) {
        assertThat(t).isInstanceOf(ResponseStatusException.class);
        return ((ResponseStatusException) t).getStatusCode().value();
    }

    @SuppressWarnings("unchecked")
    static <T> void echoSave(org.springframework.data.repository.CrudRepository<T, String> repo) {
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ------------------------------------------------------------------ Institution
    @Nested
    @DisplayName("Institution")
    class InstitutionTests {
        InstitutionRepository repo = mock(InstitutionRepository.class);
        InstitutionService service = new InstitutionService(repo);

        @BeforeEach
        void setUp() { echoSave(repo); }

        Institution inst(String code) {
            Institution i = new Institution();
            i.setInstitutionCode(code);
            i.setInstitutionName("Walchand Institute");
            return i;
        }

        @Test
        void createsANewInstitution() {
            assertThat(service.saveInstitution(inst("WIT")).getInstitutionCode()).isEqualTo("WIT");
        }

        @Test
        void duplicateCodeIs409() {
            when(repo.existsByInstitutionCode("WIT")).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.saveInstitution(inst("WIT"))))).isEqualTo(409);
        }

        @Test
        @DisplayName("[BUG] a new institution should start ACTIVE like every other collection")
        void newInstitutionIsActive() {
            assertThat(service.saveInstitution(inst("WIT")).getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        @DisplayName("[BUG] get by unknown id should be 404, not a RuntimeException (500)")
        void unknownIdIs404() {
            when(repo.findById("nope")).thenReturn(Optional.empty());
            assertThat(status(catchThrowable(() -> service.getInstitutionById("nope")))).isEqualTo(404);
        }

        @Test
        @DisplayName("[BUG] update must not let the client set status (bypasses deactivate/reactivate)")
        void updateIgnoresStatus() {
            Institution existing = inst("WIT");
            existing.setId("i1");
            existing.setStatus("INACTIVE");
            when(repo.findById("i1")).thenReturn(Optional.of(existing));
            Institution body = inst("WIT");
            body.setStatus("ACTIVE");
            assertThat(service.updateInstitution("i1", body).getStatus()).isEqualTo("INACTIVE");
        }

        @Test
        @DisplayName("[BUG] update to another institution's code should be 409")
        void updateToDuplicateCodeIs409() {
            Institution existing = inst("WIT");
            existing.setId("i1");
            when(repo.findById("i1")).thenReturn(Optional.of(existing));
            when(repo.existsByInstitutionCode("COEP")).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.updateInstitution("i1", inst("COEP"))))).isEqualTo(409);
        }

        @Test
        void deactivateAndReactivate() {
            Institution existing = inst("WIT");
            when(repo.findById("i1")).thenReturn(Optional.of(existing));
            assertThat(service.deactivateInstitution("i1").getStatus()).isEqualTo("INACTIVE");
            assertThat(service.reactivateInstitution("i1").getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        @DisplayName("[BUG] POST body with an existing id must not overwrite that record (mass assignment)")
        void createIgnoresClientId() {
            Institution body = inst("NEW");
            body.setId("existing-id");
            assertThat(service.saveInstitution(body).getId()).isNotEqualTo("existing-id");
        }
    }

    // ------------------------------------------------------------------ Department
    @Nested
    @DisplayName("Department")
    class DepartmentTests {
        DepartmentRepository repo = mock(DepartmentRepository.class);
        InstitutionRepository institutions = mock(InstitutionRepository.class);
        DepartmentService service = new DepartmentService(repo, institutions);

        @BeforeEach
        void setUp() { echoSave(repo); when(institutions.existsById("i1")).thenReturn(true); }

        Department dept(String code) {
            Department d = new Department();
            d.setInstitutionId("i1");
            d.setDepartmentCode(code);
            d.setDepartmentName("Electronics and Computer");
            return d;
        }

        @Test
        void createsActiveDepartment() {
            assertThat(service.saveDepartment(dept("ECE")).getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        void unknownInstitutionIs404() {
            Department d = dept("ECE");
            d.setInstitutionId("missing");
            assertThat(status(catchThrowable(() -> service.saveDepartment(d)))).isEqualTo(404);
        }

        @Test
        void duplicateCodeInInstitutionIs409() {
            when(repo.existsByInstitutionIdAndDepartmentCode("i1", "ECE")).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.saveDepartment(dept("ECE"))))).isEqualTo(409);
        }

        @Test
        @DisplayName("[BUG] codes differing only by case/space should count as duplicates")
        void codeIsNormalised() {
            when(repo.existsByInstitutionIdAndDepartmentCode("i1", "ECE")).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.saveDepartment(dept(" ece "))))).isEqualTo(409);
        }

        @Test
        @DisplayName("[BUG] missing departmentCode should be 400, not a NullPointerException or a saved null")
        void missingCodeIs400() {
            Throwable t = catchThrowable(() -> service.saveDepartment(dept(null)));
            assertThat(t).isInstanceOf(ResponseStatusException.class);
            assertThat(status(t)).isEqualTo(400);
        }

        @Test
        @DisplayName("[BUG] update without a code must not erase the stored code")
        void updateWithoutCodeKeepsCode() {
            Department existing = dept("ECE");
            existing.setId("d1");
            when(repo.findById("d1")).thenReturn(Optional.of(existing));
            Department body = new Department();
            body.setDepartmentName("Renamed");
            Throwable t = catchThrowable(() -> service.updateDepartment("d1", body));
            if (t == null) assertThat(existing.getDepartmentCode()).isEqualTo("ECE");
            else assertThat(status(t)).isEqualTo(400);
        }

        @Test
        void unknownDepartmentIs404() {
            when(repo.findById("x")).thenReturn(Optional.empty());
            assertThat(status(catchThrowable(() -> service.getDepartmentById("x")))).isEqualTo(404);
        }

        @Test
        @DisplayName("[BUG] a department can't be created under an INACTIVE institution")
        void inactiveInstitutionRejected() {
            Institution inactive = new Institution();
            inactive.setStatus("INACTIVE");
            when(institutions.findById("i1")).thenReturn(Optional.of(inactive));
            Throwable t = catchThrowable(() -> service.saveDepartment(dept("ECE")));
            assertThat(t).isNotNull();
        }
    }

    // ------------------------------------------------------------------ Program
    @Nested
    @DisplayName("Program")
    class ProgramTests {
        ProgramRepository repo = mock(ProgramRepository.class);
        DepartmentRepository departments = mock(DepartmentRepository.class);
        ProgramService service = new ProgramService(repo, departments);

        @BeforeEach
        void setUp() { echoSave(repo); when(departments.existsById("d1")).thenReturn(true); }

        Program program(String code, String level) {
            Program p = new Program();
            p.setDepartmentId("d1");
            p.setProgramCode(code);
            p.setProgramName("B.Tech ECM");
            p.setProgramLevel(level);
            return p;
        }

        @Test
        void createsActiveProgram() {
            assertThat(service.saveProgram(program("BTECH-ECM", "UG")).getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        void unknownDepartmentIs404() {
            Program p = program("X", "UG");
            p.setDepartmentId("missing");
            assertThat(status(catchThrowable(() -> service.saveProgram(p)))).isEqualTo(404);
        }

        @Test
        void duplicateCodeIs409() {
            when(repo.existsByDepartmentIdAndProgramCode("d1", "BTECH-ECM")).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.saveProgram(program("BTECH-ECM", "UG"))))).isEqualTo(409);
        }

        @Test
        @DisplayName("[BUG] programLevel must be UG or PG (contract §6)")
        void invalidLevelRejected() {
            assertThat(status(catchThrowable(() -> service.saveProgram(program("X", "DIPLOMA-ISH"))))).isEqualTo(400);
        }

        @Test
        void unknownProgramIs404() {
            when(repo.findById("x")).thenReturn(Optional.empty());
            assertThat(status(catchThrowable(() -> service.getProgramById("x")))).isEqualTo(404);
        }
    }

    // ------------------------------------------------------------------ Syllabus
    @Nested
    @DisplayName("Syllabus")
    class SyllabusTests {
        SyllabusRepository repo = mock(SyllabusRepository.class);
        InstitutionRepository institutions = mock(InstitutionRepository.class);
        DepartmentRepository departments = mock(DepartmentRepository.class);
        ProgramRepository programs = mock(ProgramRepository.class);
        SyllabusService service = new SyllabusService(repo, institutions, departments, programs);

        @BeforeEach
        void setUp() {
            echoSave(repo);
            Institution i = new Institution();
            i.setId("i1");
            when(institutions.findById("i1")).thenReturn(Optional.of(i));
            Program p = new Program();
            p.setId("p1");
            p.setDepartmentId("d1");
            when(programs.findById("p1")).thenReturn(Optional.of(p));
            Department d = new Department();
            d.setId("d1");
            d.setInstitutionId("i1");
            when(departments.findById("d1")).thenReturn(Optional.of(d));
        }

        Syllabus syllabus(String scope, String programId) {
            Syllabus s = new Syllabus();
            s.setInstitutionId("i1");
            s.setSyllabusScope(scope);
            s.setProgramId(programId);
            s.setSyllabusName("2025 scheme");
            s.setSchemeCode("2025");
            return s;
        }

        @Test
        void programSyllabusIsCreated() {
            assertThat(service.saveSyllabus(syllabus("PROGRAM", "p1")).getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        void firstYearSyllabusIsCreated() {
            assertThat(service.saveSyllabus(syllabus("FIRST_YEAR", null)).getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        void programScopeNeedsProgramId() {
            assertThat(status(catchThrowable(() -> service.saveSyllabus(syllabus("PROGRAM", null))))).isEqualTo(400);
        }

        @Test
        void firstYearMustNotHaveProgram() {
            assertThat(status(catchThrowable(() -> service.saveSyllabus(syllabus("FIRST_YEAR", "p1"))))).isEqualTo(400);
        }

        @Test
        void unknownScopeIs400() {
            assertThat(status(catchThrowable(() -> service.saveSyllabus(syllabus("ELECTIVE", null))))).isEqualTo(400);
        }

        @Test
        @DisplayName("[BUG] scope matching is case-sensitive here but not in ProgramYearService")
        void lowercaseScopeAccepted() {
            assertThatNoException().isThrownBy(() -> service.saveSyllabus(syllabus("program", "p1")));
        }

        @Test
        void programFromAnotherInstitutionIs400() {
            Department other = new Department();
            other.setInstitutionId("i2");
            when(departments.findById("d1")).thenReturn(Optional.of(other));
            assertThat(status(catchThrowable(() -> service.saveSyllabus(syllabus("PROGRAM", "p1"))))).isEqualTo(400);
        }

        @Test
        void missingSchemeIs400() {
            Syllabus s = syllabus("PROGRAM", "p1");
            s.setSchemeCode(" ");
            assertThat(status(catchThrowable(() -> service.saveSyllabus(s)))).isEqualTo(400);
        }

        @Test
        void duplicateSchemeIs409() {
            when(repo.existsByProgramIdAndSchemeCodeAndSyllabusScope("p1", "2025", "PROGRAM")).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.saveSyllabus(syllabus("PROGRAM", "p1"))))).isEqualTo(409);
        }

        @Test
        void raceOnUniqueIndexIs409() {
            when(repo.save(any())).thenThrow(new DuplicateKeyException("dup"));
            assertThat(status(catchThrowable(() -> service.saveSyllabus(syllabus("PROGRAM", "p1"))))).isEqualTo(409);
        }

        @Test
        void missingInstitutionIs400() {
            Syllabus s = syllabus("PROGRAM", "p1");
            s.setInstitutionId(null);
            assertThat(status(catchThrowable(() -> service.saveSyllabus(s)))).isEqualTo(400);
        }

        @Test
        void updateRequiresName() {
            when(repo.findById("s1")).thenReturn(Optional.of(syllabus("PROGRAM", "p1")));
            Syllabus body = new Syllabus();
            assertThat(status(catchThrowable(() -> service.updateSyllabus("s1", body)))).isEqualTo(400);
        }
    }

    // ------------------------------------------------------------------ Program year
    @Nested
    @DisplayName("Program year")
    class ProgramYearTests {
        ProgramYearRepository repo = mock(ProgramYearRepository.class);
        SyllabusRepository syllabi = mock(SyllabusRepository.class);
        ProgramYearService service = new ProgramYearService(repo, syllabi);

        @BeforeEach
        void setUp() { echoSave(repo); }

        void syllabusWith(String scope, String status) {
            Syllabus s = new Syllabus();
            s.setId("s1");
            s.setSyllabusScope(scope);
            s.setStatus(status);
            when(syllabi.findById("s1")).thenReturn(Optional.of(s));
        }

        ProgramYear year(Integer n) {
            ProgramYear y = new ProgramYear();
            y.setSyllabusId("s1");
            y.setYearNumber(n);
            return y;
        }

        @ParameterizedTest
        @CsvSource({"PROGRAM,2,Second Year", "PROGRAM,3,Third Year", "PROGRAM,4,Fourth Year", "FIRST_YEAR,1,First Year"})
        void validYearsGetTheirName(String scope, int n, String name) {
            syllabusWith(scope, "ACTIVE");
            assertThat(service.saveProgramYear(year(n)).getYearName()).isEqualTo(name);
        }

        @ParameterizedTest
        @CsvSource({"PROGRAM,1", "FIRST_YEAR,2", "PROGRAM,5", "PROGRAM,0", "PROGRAM,-1"})
        void invalidYearsAre400(String scope, int n) {
            syllabusWith(scope, "ACTIVE");
            assertThat(status(catchThrowable(() -> service.saveProgramYear(year(n))))).isEqualTo(400);
        }

        @Test
        void nullYearIs400() {
            syllabusWith("PROGRAM", "ACTIVE");
            assertThat(status(catchThrowable(() -> service.saveProgramYear(year(null))))).isEqualTo(400);
        }

        @Test
        void inactiveSyllabusIs400() {
            syllabusWith("PROGRAM", "INACTIVE");
            assertThat(status(catchThrowable(() -> service.saveProgramYear(year(2))))).isEqualTo(400);
        }

        @Test
        void unknownSyllabusIs404() {
            when(syllabi.findById("s1")).thenReturn(Optional.empty());
            assertThat(status(catchThrowable(() -> service.saveProgramYear(year(2))))).isEqualTo(404);
        }

        @Test
        void duplicateYearIs409() {
            syllabusWith("PROGRAM", "ACTIVE");
            when(repo.existsBySyllabusIdAndYearNumber("s1", 2)).thenReturn(true);
            assertThat(status(catchThrowable(() -> service.saveProgramYear(year(2))))).isEqualTo(409);
        }

        @Test
        void raceOnUniqueIndexIs409() {
            syllabusWith("PROGRAM", "ACTIVE");
            when(repo.save(any())).thenThrow(new DuplicateKeyException("dup"));
            assertThat(status(catchThrowable(() -> service.saveProgramYear(year(2))))).isEqualTo(409);
        }

        @Test
        void renameTrimsAndRequiresName() {
            ProgramYear existing = year(2);
            when(repo.findById("y1")).thenReturn(Optional.of(existing));
            ProgramYear body = new ProgramYear();
            body.setYearName("  SY B.Tech  ");
            assertThat(service.updateProgramYear("y1", body).getYearName()).isEqualTo("SY B.Tech");
            body.setYearName("   ");
            assertThat(status(catchThrowable(() -> service.updateProgramYear("y1", body)))).isEqualTo(400);
        }
    }

    @Test
    @DisplayName("lookups never call save")
    void readsDontWrite() {
        DepartmentRepository repo = mock(DepartmentRepository.class);
        new DepartmentService(repo, mock(InstitutionRepository.class)).getAllDepartments();
        verify(repo, never()).save(any());
        verify(repo, never()).deleteById(anyString());
    }
}
