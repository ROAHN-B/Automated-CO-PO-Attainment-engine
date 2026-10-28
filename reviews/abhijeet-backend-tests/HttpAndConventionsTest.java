package com.copo.attainment_engine.review;

import com.copo.attainment_engine.academic.controller.CourseController;
import com.copo.attainment_engine.academic.controller.DepartmentController;
import com.copo.attainment_engine.academic.controller.ProgramController;
import com.copo.attainment_engine.academic.model.Course;
import com.copo.attainment_engine.academic.model.Department;
import com.copo.attainment_engine.academic.service.CourseService;
import com.copo.attainment_engine.academic.service.DepartmentService;
import com.copo.attainment_engine.academic.service.ProgramService;
import com.copo.attainment_engine.faculty.controller.FacultyController;
import com.copo.attainment_engine.faculty.controller.FacultyCourseAssignmentController;
import com.copo.attainment_engine.faculty.dto.FacultyCourseAssignmentResponse;
import com.copo.attainment_engine.faculty.dto.FacultyResponse;
import com.copo.attainment_engine.faculty.service.FacultyCourseAssignmentService;
import com.copo.attainment_engine.faculty.service.FacultyService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.core.type.filter.AssignableTypeFilter;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP behaviour (Spring MVC + bean validation) and project-wide conventions from API_CONTRACT §2, §6, §16, §18. */
class HttpAndConventionsTest {

    static final String BASE = "com.copo.attainment_engine";

    // ------------------------------------------------------------------ HTTP layer
    @Nested
    @DisplayName("HTTP: validation and status codes")
    class Http {
        CourseService courseService = mock(CourseService.class);
        FacultyService facultyService = mock(FacultyService.class);
        FacultyCourseAssignmentService assignmentService = mock(FacultyCourseAssignmentService.class);
        DepartmentService departmentService = mock(DepartmentService.class);
        ProgramService programService = mock(ProgramService.class);

        MockMvc mvc = MockMvcBuilders.standaloneSetup(
                new CourseController(courseService),
                new FacultyController(facultyService),
                new FacultyCourseAssignmentController(assignmentService),
                new DepartmentController(departmentService),
                new ProgramController(programService)
        ).build();

        String course(String code, String credits) {
            return """
                {"semesterId":"sem5","courseCode":%s,"courseName":"Network Security","courseType":"CORE","credits":%s}
                """.formatted(code, credits);
        }

        @Test
        void validCourseIs201() throws Exception {
            when(courseService.createCourse(any())).thenReturn(new Course());
            mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON).content(course("\"EC306\"", "3")))
                    .andExpect(status().isCreated());
        }

        @ParameterizedTest(name = "course body {0} -> 400")
        @ValueSource(strings = {"blank-code", "null-code", "negative-credits", "null-credits", "text-credits", "empty-json", "not-json"})
        void invalidCourseBodiesAre400(String kind) throws Exception {
            String body = switch (kind) {
                case "blank-code" -> course("\"  \"", "3");
                case "null-code" -> course("null", "3");
                case "negative-credits" -> course("\"EC306\"", "-1");
                case "null-credits" -> course("\"EC306\"", "null");
                case "text-credits" -> course("\"EC306\"", "\"three\"");
                case "empty-json" -> "{}";
                default -> "{not json";
            };
            mvc.perform(post("/api/courses").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
            verify(courseService, never()).createCourse(any());
        }

        @Test
        void courseListNeedsSemesterId() throws Exception {
            mvc.perform(get("/api/courses")).andExpect(status().isBadRequest());
        }

        String faculty(String email) {
            return """
                {"institutionId":"i1","departmentId":"d1","facultyCode":"F001","fullName":"Rohan","email":%s,"designation":"AP"}
                """.formatted(email);
        }

        @Test
        void validFacultyIs201() throws Exception {
            when(facultyService.createFaculty(any())).thenReturn(new FacultyResponse());
            mvc.perform(post("/api/v1/faculty").contentType(MediaType.APPLICATION_JSON).content(faculty("\"rohan@wit.edu\"")))
                    .andExpect(status().isCreated());
        }

        @ParameterizedTest
        @ValueSource(strings = {"\"not-an-email\"", "\"\"", "null"})
        void badFacultyEmailIs400(String email) throws Exception {
            mvc.perform(post("/api/v1/faculty").contentType(MediaType.APPLICATION_JSON).content(faculty(email)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void facultyListNeedsAFilter() throws Exception {
            mvc.perform(get("/api/v1/faculty")).andExpect(status().isBadRequest());
        }

        @Test
        void unknownFacultyIs404() throws Exception {
            when(facultyService.getFacultyById("x")).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Faculty not found"));
            mvc.perform(get("/api/v1/faculty/x")).andExpect(status().isNotFound());
        }

        @ParameterizedTest(name = "academic year {0} -> 400")
        @ValueSource(strings = {"2026-2027", "26-27", "2026/27", "", "abcd-ef"})
        void badAcademicYearIs400(String year) throws Exception {
            String body = "{\"facultyId\":\"f1\",\"courseId\":\"c1\",\"academicYear\":\"" + year + "\"}";
            mvc.perform(post("/api/v1/faculty-course-assignments").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void validAssignmentIs201() throws Exception {
            when(assignmentService.assignCourse(any())).thenReturn(new FacultyCourseAssignmentResponse());
            String body = "{\"facultyId\":\"f1\",\"courseId\":\"c1\",\"academicYear\":\"2026-27\"}";
            mvc.perform(post("/api/v1/faculty-course-assignments").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("[BUG] POST /api/departments passes a client-supplied id straight to save (mass assignment)")
        void departmentPostIgnoresClientId() throws Exception {
            when(departmentService.saveDepartment(any())).thenAnswer(inv -> inv.getArgument(0));
            mvc.perform(post("/api/departments").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"id\":\"existing-dept-id\",\"institutionId\":\"i1\",\"departmentCode\":\"ECE\",\"status\":\"INACTIVE\"}"));
            ArgumentCaptor<Department> sent = ArgumentCaptor.forClass(Department.class);
            verify(departmentService).saveDepartment(sent.capture());
            assertThat(sent.getValue().getId()).as("id from the request body").isNull();
        }

        @Test
        @DisplayName("[BUG] POST /api/departments without a body field set is accepted with no validation (expect 400)")
        void emptyDepartmentIs400() throws Exception {
            when(departmentService.saveDepartment(any())).thenAnswer(inv -> inv.getArgument(0));
            mvc.perform(post("/api/departments").contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        void programCreateIs201AndUnknownIs404() throws Exception {
            when(programService.saveProgram(any())).thenAnswer(inv -> inv.getArgument(0));
            mvc.perform(post("/api/programs").contentType(MediaType.APPLICATION_JSON).content("{\"departmentId\":\"d1\"}"))
                    .andExpect(status().isCreated());
            when(programService.getProgramById(eq("x"))).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND));
            mvc.perform(get("/api/programs/x")).andExpect(status().isNotFound());
        }
    }

    // ------------------------------------------------------------------ Conventions
    @Nested
    @DisplayName("Conventions vs API_CONTRACT")
    class Conventions {

        List<Class<?>> scan(ClassPathScanningCandidateComponentProvider scanner) throws Exception {
            List<Class<?>> out = new ArrayList<>();
            for (var bd : scanner.findCandidateComponents(BASE)) out.add(Class.forName(bd.getBeanClassName()));
            return out;
        }

        List<Class<?>> controllers() throws Exception {
            var s = new ClassPathScanningCandidateComponentProvider(false);
            s.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
            return scan(s).stream().filter(c -> !c.getName().contains(".review.")).toList();
        }

        @Test
        @DisplayName("[BUG] every controller should be under /api/v1 (contract §2.1)")
        void allRoutesVersioned() throws Exception {
            List<String> unversioned = controllers().stream()
                    .map(c -> c.getAnnotation(RequestMapping.class).value()[0])
                    .filter(p -> !p.startsWith("/api/v1/"))
                    .sorted().toList();
            assertThat(unversioned).as("controllers not under /api/v1").isEmpty();
        }

        @Test
        @DisplayName("[BUG] a global error handler should map errors to the contract envelope (§2.2, §18)")
        void globalErrorHandlerExists() throws Exception {
            var s = new ClassPathScanningCandidateComponentProvider(false);
            s.addIncludeFilter(new AnnotationTypeFilter(ControllerAdvice.class));
            assertThat(scan(s)).as("@RestControllerAdvice classes").isNotEmpty();
        }

        @Test
        @DisplayName("[BUG] CORS must allow the Angular app (http://localhost:4200)")
        void corsConfigured() throws Exception {
            var s = new ClassPathScanningCandidateComponentProvider(false);
            s.addIncludeFilter(new AssignableTypeFilter(WebMvcConfigurer.class));
            boolean hasConfigurer = !scan(s).isEmpty();
            boolean hasCrossOrigin = controllers().stream().anyMatch(c -> c.isAnnotationPresent(CrossOrigin.class));
            assertThat(hasConfigurer || hasCrossOrigin).as("any CORS configuration").isTrue();
        }

        @Test
        @DisplayName("[BUG] controllers should not bind MongoDB @Document entities from the request body")
        void noEntityRequestBodies() throws Exception {
            List<String> offenders = new ArrayList<>();
            for (Class<?> c : controllers()) {
                for (Method m : c.getDeclaredMethods()) {
                    for (Parameter p : m.getParameters()) {
                        if (p.isAnnotationPresent(RequestBody.class) && p.getType().isAnnotationPresent(Document.class)) {
                            offenders.add(c.getSimpleName() + "." + m.getName() + "(" + p.getType().getSimpleName() + ")");
                        }
                    }
                }
            }
            offenders.sort(null);
            assertThat(offenders).as("endpoints taking an entity as body").isEmpty();
        }

        @Test
        @DisplayName("[BUG] no CommandLineRunner should ping the database on every startup")
        void noStartupPing() throws Exception {
            var s = new ClassPathScanningCandidateComponentProvider(false);
            s.addIncludeFilter(new AnnotationTypeFilter(org.springframework.context.annotation.Configuration.class));
            boolean pings = scan(s).stream()
                    .flatMap(c -> Stream.of(c.getDeclaredMethods()))
                    .anyMatch(m -> CommandLineRunner.class.isAssignableFrom(m.getReturnType()));
            assertThat(pings).isFalse();
        }

        @Test
        @DisplayName("[BUG] package declarations should match their folders")
        void packagesMatchFolders() throws Exception {
            Path root = Path.of("src/main/java");
            List<String> mismatched = new ArrayList<>();
            try (Stream<Path> files = Files.walk(root)) {
                for (Path f : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                    String expected = root.relativize(f.getParent()).toString().replace('\\', '.').replace('/', '.');
                    String declared = Files.readAllLines(f).stream().filter(l -> l.startsWith("package "))
                            .findFirst().orElse("").replace("package ", "").replace(";", "").trim();
                    if (!declared.equals(expected)) mismatched.add(f.getFileName() + " declares " + declared);
                }
            }
            assertThat(mismatched).isEmpty();
        }

        @Test
        @DisplayName("[BUG] unique indexes are declared, so index auto-creation must be enabled")
        void indexCreationEnabled() throws Exception {
            String props = Files.readString(Path.of("src/main/resources/application.properties"));
            assertThat(props).contains("auto-index-creation=true");
        }

        @Test
        @DisplayName("no credentials are hard-coded in application.properties")
        void noSecretsInProperties() throws Exception {
            String props = Files.readString(Path.of("src/main/resources/application.properties"));
            assertThat(props).doesNotContainPattern("mongodb(\\+srv)?://[^$]");
            assertThat(props).contains("${MONGODB_URI}");
        }

        @Test
        @DisplayName("the Mongo URI comes from the environment")
        void portAndAppName() throws Exception {
            String props = Files.readString(Path.of("src/main/resources/application.properties"));
            assertThat(props).contains("server.port=8081").contains("spring.application.name=attainment-engine");
        }
    }
}
