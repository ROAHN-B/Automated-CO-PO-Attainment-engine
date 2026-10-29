package com.copo.attainment_engine.seed;

import com.copo.attainment_engine.academic.model.Department;
import com.copo.attainment_engine.academic.model.Institution;
import com.copo.attainment_engine.auth.User;
import com.copo.attainment_engine.auth.UserRepository;
import com.copo.attainment_engine.workspace.AssessmentPlan;
import com.copo.attainment_engine.workspace.Lifecycle;
import com.copo.attainment_engine.workspace.Offering;
import com.copo.attainment_engine.workspace.cam.CamDocs;
import com.copo.attainment_engine.workspace.cam.CamDocs.CourseOutcome;
import com.copo.attainment_engine.workspace.cam.CamDocs.ProgramOutcome;
import com.copo.attainment_engine.workspace.cam.CamDocs.Unit;
import com.copo.attainment_engine.workspace.marksheet.MarksheetService;
import com.copo.attainment_engine.workspace.qp.QpDocs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;

/**
 * Demo data for the POE (30 Oct 2026). The coordinator backend comes later, so what the
 * coordinator would provide is hardcoded here: the Network Security allocation to the
 * faculty demo account, its load distribution row, its syllabus, and the department's
 * 11 POs and 3 PSOs. Safe on every start: existing records are kept. Start once with
 * {@code --app.seed.reset-course=true} to put Network Security back at step 1.
 */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class PoeSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PoeSeeder.class);
    private static final String COURSE_CODE = "23ECU7E23T";

    private final MongoTemplate mongo;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String demoPassword;
    private final boolean resetCourse;

    public PoeSeeder(MongoTemplate mongo, UserRepository users, PasswordEncoder passwords,
                     @Value("${app.seed.demo-password}") String demoPassword,
                     @Value("${app.seed.reset-course:false}") boolean resetCourse) {
        this.mongo = mongo;
        this.users = users;
        this.passwords = passwords;
        this.demoPassword = demoPassword;
        this.resetCourse = resetCourse;
    }

    @Override
    public void run(ApplicationArguments args) {
        Institution wit = mongo.findOne(Query.query(Criteria.where("institutionCode").is("WIT")), Institution.class);
        if (wit == null) {
            wit = new Institution();
            wit.setInstitutionCode("WIT");
            wit.setInstitutionName("Walchand Institute of Technology, Solapur");
            wit.setStatus("ACTIVE");
            wit = mongo.save(wit);
        }
        Department ece = mongo.findOne(Query.query(Criteria.where("departmentCode").is("ECE")), Department.class);
        if (ece == null) {
            ece = new Department();
            ece.setInstitutionId(wit.getId());
            ece.setDepartmentCode("ECE");
            ece.setDepartmentName("Electronics and Computer Engineering");
            ece.setStatus("ACTIVE");
            ece = mongo.save(ece);
        }

        user("superadmin@wit.edu", "ADM001", "System Administrator", null, User.Role.SUPER_ADMIN, EnumSet.of(User.Role.SUPER_ADMIN));
        user("hod.ecm@wit.edu", "HOD-ECE", "Head of Department", ece.getId(), User.Role.HOD, EnumSet.of(User.Role.HOD));
        user("coordinator@wit.edu", "FAC-COORD", "Sneha Kulkarni", ece.getId(), User.Role.COORDINATOR, EnumSet.of(User.Role.FACULTY, User.Role.COORDINATOR));
        User rohan = user("faculty@wit.edu", "FAC-002", "Rohan Belsare", ece.getId(), User.Role.FACULTY, EnumSet.of(User.Role.FACULTY));

        Query mine = Query.query(Criteria.where("facultyUserId").is(rohan.getId()).and("course.courseCode").is(COURSE_CODE));
        Offering existing = mongo.findOne(mine, Offering.class);
        if (existing != null && resetCourse) {
            removeCourse(existing);
            existing = null;
        }
        if (existing == null) {
            mongo.save(networkSecurity(rohan, ece.getDepartmentName()));
            log.info("POE demo: Network Security allocated to {} and waiting at \"Accept allocation\".", rohan.getEmail());
        }
    }

    private User user(String email, String code, String fullName, String departmentId, User.Role primary, EnumSet<User.Role> roles) {
        return users.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email);
            u.setUserCode(code);
            u.setFullName(fullName);
            u.setDepartmentId(departmentId);
            u.setPrimaryRole(primary);
            u.setRoles(roles);
            u.setPasswordHash(passwords.encode(demoPassword));
            return users.save(u);
        });
    }

    /** Deletes the course and everything the faculty made for it, so the demo starts at step 1 again. */
    private void removeCourse(Offering o) {
        Query byOffering = Query.query(Criteria.where("offeringId").is(o.id));
        mongo.remove(byOffering, AssessmentPlan.class);
        mongo.remove(byOffering, CamDocs.Cam.class);
        mongo.remove(byOffering, QpDocs.Paper.class);
        mongo.remove(byOffering, MarksheetService.Structure.class);
        List<String> assessments = o.progress.cycles.stream().map(c -> c.assessmentId).toList();
        mongo.remove(Query.query(Criteria.where("_id").in(assessments)), QpDocs.Result.class);
        mongo.remove(o);
        log.info("POE demo: Network Security reset.");
    }

    private static Offering networkSecurity(User faculty, String departmentName) {
        Offering o = new Offering();
        o.facultyUserId = faculty.getId();
        o.course = new Offering.CourseRef();
        o.course.syllabusCourseId = "sc-23ecu7e23t";
        o.course.courseCode = COURSE_CODE;
        o.course.courseName = "Network Security";
        o.courseType = "PROGRAM_ELECTIVE";
        o.academicYear = new Offering.Ref();
        o.academicYear.academicYearId = "ay-2026-27";
        o.academicYear.name = "2026-27";
        o.semester = new Offering.SemesterRef();
        o.semester.semesterId = "sem-7";
        o.semester.semesterNumber = 7;
        o.programName = "B.Tech Electronics & Computer Engineering";
        o.className = "Final Year B.Tech ECM";
        o.departmentName = departmentName;
        o.institutionName = "Walchand Institute of Technology, Solapur";
        o.assessmentScheme = "THEORY";
        o.classStrength = 30;
        o.courseCoordinator = new Offering.PersonRef();
        o.courseCoordinator.userId = faculty.getId();
        o.courseCoordinator.fullName = faculty.getFullName();
        o.allocation.allocationId = "alloc-ns-2026";
        o.allocation.allocatedBy = "Sneha Kulkarni";
        o.allocation.notifiedAt = Instant.now();

        Lifecycle.Progress p = o.progress;
        p.setup.subjectSelection = Lifecycle.StepState.available();
        p.setup.assessmentPlan = Lifecycle.StepState.locked("Accept the allocation first");
        p.setup.cam = Lifecycle.StepState.locked("Finalize the assessment plan first");
        String closing = "Finish every assessment cycle first";
        p.closeOut.indirectSurveys = Lifecycle.StepState.locked(closing);
        p.closeOut.finalAttainment = Lifecycle.StepState.locked(closing);
        p.closeOut.submission = Lifecycle.StepState.locked(closing);
        p.nextAction = Lifecycle.NextAction.of("SUBJECT_SELECTION", null, "Accept your allocation of Network Security");

        // The Semester VII "Programme Elective Course IV" row: ESE 60, ISE 40 = 2 tests × 15 + 2 activities × 5.
        o.components = new ArrayList<>(List.of(
                Offering.ComponentItem.of("ESE", "ESE", 1, 60),
                Offering.ComponentItem.of("ISE", "ISE", 2, 15),
                Offering.ComponentItem.of("ISE", "ACTIVITY", 2, 5)));

        o.courseObjectives = new ArrayList<>(List.of(
                "Introduce fundamental principles of network security models and classical encryption techniques.",
                "Introduce the design and operation of block ciphers, public-key cryptography and key distribution mechanisms.",
                "Help students comprehend security standards and protocols at the network, internet and transport layers.",
                "Help students analyze wireless network vulnerabilities and propose security solutions for mobile and cloud computing."));
        o.courseOutcomes = new ArrayList<>(List.of(
                CourseOutcome.of("co-ns-1", "CO1", "Explain the fundamental principles of network security models and classical encryption techniques."),
                CourseOutcome.of("co-ns-2", "CO2", "Illustrate the design and working of block ciphers, public key cryptography, and key distribution mechanisms."),
                CourseOutcome.of("co-ns-3", "CO3", "Analyze the functioning of security standards and protocols across the network, internet, and transport layers."),
                CourseOutcome.of("co-ns-4", "CO4", "Analyze network and wireless vulnerabilities and apply basic ethical hacking and penetration testing techniques to recommend security solutions.")));
        o.units = new ArrayList<>(List.of(
                Unit.of(1, "Security Fundamentals", 8, "Computer security concepts; OSI security architecture; classification of attacks; security services and mechanisms; network security model; symmetric cipher model; Caesar, monoalphabetic, Playfair, Hill and polyalphabetic ciphers; transposition techniques; rotor machines; steganography."),
                Unit.of(2, "Block Ciphers and DES", 7, "Traditional block cipher structure; stream vs block ciphers; Feistel architecture; DES encryption, decryption and strength; public-key cryptosystems; RSA operation, mathematics, computational aspects and security."),
                Unit.of(3, "Key Management and Distribution", 7, "Symmetric key distribution using symmetric and asymmetric encryption; distribution of public keys; X.509 certificates; public key infrastructure."),
                Unit.of(4, "Network and Internet Security", 6, "Network access control; EAP; IEEE 802.1X; vulnerability assessment; conceptual penetration testing: reconnaissance, scanning, exploitation."),
                Unit.of(5, "Wireless Network Security", 8, "IEEE 802.11 wireless LAN security; mobile device security; PGP; S/MIME; introductory IPsec policies and ESP."),
                Unit.of(6, "IP Security & Ethical Hacking", 6, "IPsec architecture, policies, ESP, security associations, IKE; ethical hacking fundamentals; legal and ethical considerations; responsibilities; standard security tools.")));
        o.programOutcomes = new ArrayList<>(List.of(
                ProgramOutcome.of("PO", "PO1", "Engineering knowledge", "Apply knowledge of mathematics, natural science, computing, engineering fundamentals and an engineering specialization to develop solutions to complex engineering problems."),
                ProgramOutcome.of("PO", "PO2", "Problem analysis", "Identify, formulate, review research literature and analyse complex engineering problems, reaching substantiated conclusions."),
                ProgramOutcome.of("PO", "PO3", "Design/development of solutions", "Design creative solutions for complex engineering problems and design or develop systems, components or processes to meet identified needs."),
                ProgramOutcome.of("PO", "PO4", "Conduct investigations of complex problems", "Conduct investigations of complex engineering problems using research-based knowledge and methods, including design of experiments and analysis of data."),
                ProgramOutcome.of("PO", "PO5", "Engineering tool usage", "Create, select and apply appropriate techniques, resources and modern engineering and IT tools, recognising their limitations."),
                ProgramOutcome.of("PO", "PO6", "The engineer and the world", "Analyse and evaluate societal and environmental aspects while solving complex engineering problems, including their impact on sustainability."),
                ProgramOutcome.of("PO", "PO7", "Ethics", "Apply ethical principles and commit to professional ethics, human values, diversity and inclusion, and the norms of engineering practice."),
                ProgramOutcome.of("PO", "PO8", "Individual and collaborative team work", "Function effectively as an individual, and as a member or leader in diverse and multidisciplinary teams."),
                ProgramOutcome.of("PO", "PO9", "Communication", "Communicate effectively and inclusively within the engineering community and with society at large."),
                ProgramOutcome.of("PO", "PO10", "Project management and finance", "Apply knowledge and understanding of engineering management principles and economic decision-making to one's own work, as a member or leader in a team."),
                ProgramOutcome.of("PO", "PO11", "Life-long learning", "Recognise the need for, and have the preparation and ability for, independent and life-long learning in the broadest context of technological change."),
                ProgramOutcome.of("PSO", "PSO1", "Embedded and IoT systems", "Design and implement embedded and IoT systems that integrate sensing, computing and communication."),
                ProgramOutcome.of("PSO", "PSO2", "Signals and communication", "Apply signal processing and communication principles to analyse and build electronic subsystems."),
                ProgramOutcome.of("PSO", "PSO3", "Computing and security", "Use modern software tools, AI and networking to develop secure, reliable solutions for industry and society.")));

        String[] names = {"Aarav Kulkarni", "Aditi Patil", "Akash Deshmukh", "Ananya Joshi", "Atharva Pawar", "Bhakti Shinde",
                "Chinmay Jadhav", "Diya Kale", "Gaurav Bhosale", "Isha Gaikwad", "Kunal Chavan", "Mansi Kadam", "Neha Mane",
                "Omkar More", "Pooja Salunkhe", "Pranav Kamble", "Riya Sawant", "Rohit Nikam", "Sakshi Waghmare", "Sanket Mhetre",
                "Shreya Pujari", "Siddharth Lokhande", "Sneha Birajdar", "Soham Kumbhar", "Tanvi Gavade", "Tejas Swami",
                "Vaishnavi Hiremath", "Vedant Biradar", "Yash Koli", "Zoya Shaikh"};
        for (int i = 0; i < names.length; i++) o.students.add(Offering.Student.of(String.format("22ECM%03d", i + 1), names[i]));
        return o;
    }
}
