package com.copo.attainment_engine.workspace;

import com.copo.attainment_engine.workspace.cam.CamDocs;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * One subject allocated to one faculty member for one academic year (API_CONTRACT §7.3).
 * Besides the lifecycle it holds what the coordinator provides (§15.4, §15.5), hardcoded
 * by the seeder until the coordinator backend exists: the load distribution row, the
 * syllabus that pre-fills the CAM, and the department's POs and PSOs.
 */
@Document(collection = "offerings")
public class Offering {

    @Id public String id;
    /** The users._id of the faculty member it's allocated to. */
    @Indexed public String facultyUserId;

    public CourseRef course;
    /** CORE, PROGRAM_ELECTIVE…, as Mayuri's service expects. */
    public String courseType;
    public Ref academicYear;
    public SemesterRef semester;
    public String programName;
    public String className;
    public String division;
    public String departmentName;
    public String institutionName;
    public String assessmentScheme;      // THEORY | PRACTICAL
    public int classStrength;
    public PersonRef courseCoordinator;
    public Allocation allocation = new Allocation();
    public boolean readOnly;
    public Lifecycle.Progress progress = new Lifecycle.Progress();

    /* ------------------- coordinator data (hardcoded for the POE) ------------------- */

    /** The load distribution row's items, e.g. ISE: 2 × 15 and 2 activities × 5 (§15.4). */
    public List<ComponentItem> components = new ArrayList<>();
    public List<String> courseObjectives = new ArrayList<>();
    public List<CamDocs.CourseOutcome> courseOutcomes = new ArrayList<>();
    public List<CamDocs.Unit> units = new ArrayList<>();
    public List<CamDocs.ProgramOutcome> programOutcomes = new ArrayList<>();
    public List<Student> students = new ArrayList<>();

    public static class CourseRef {
        public String syllabusCourseId;
        public String courseCode;
        public String courseName;
    }

    public static class Ref {
        public String academicYearId;
        public String name;
    }

    public static class SemesterRef {
        public String semesterId;
        public int semesterNumber;
    }

    public static class PersonRef {
        public String userId;
        public String fullName;
    }

    public static class Allocation {
        public String allocationId;
        public String status = "PENDING_ACCEPTANCE";   // PENDING_ACCEPTANCE | ACCEPTED
        public String allocatedBy;
        public Instant notifiedAt;
        public Instant acceptedAt;
    }

    /** One column item of the load distribution: `component` is ESE, OE_POE, ISE or ICA. */
    public static class ComponentItem {
        public String component;
        public String category;
        public int count;
        public double maxMarksEach;

        public static ComponentItem of(String component, String category, int count, double maxMarksEach) {
            ComponentItem i = new ComponentItem();
            i.component = component;
            i.category = category;
            i.count = count;
            i.maxMarksEach = maxMarksEach;
            return i;
        }
    }

    public static class Student {
        public String rollNumber;
        public String studentName;

        public static Student of(String rollNumber, String studentName) {
            Student s = new Student();
            s.rollNumber = rollNumber;
            s.studentName = studentName;
            return s;
        }
    }
}
