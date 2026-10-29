package com.copo.attainment_engine.workspace;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** API_CONTRACT §8: generated from the load distribution row; faculty set only order, dates and activity types. */
@Document(collection = "assessmentPlans")
public class AssessmentPlan {

    @Id public String planId;
    @Indexed(unique = true) public String offeringId;
    public String status = "DRAFT";      // DRAFT | FINALIZED
    public int version = 1;
    public Scheme examinationScheme = new Scheme();
    public List<Planned> assessments = new ArrayList<>();
    public List<Issue> issues = new ArrayList<>();
    public Instant updatedAt;
    public String updatedBy;

    public static class Scheme {
        public List<SchemeComponent> components = new ArrayList<>();
    }

    public static class SchemeComponent {
        public String type;
        public double maxMarks;
    }

    public static class Planned {
        public String assessmentId;
        public String category;
        public String activityType;
        public String phase;            // ISE | ESE
        public String componentType;    // ESE | ISE | ICA | POE | OE | OE_POE
        public String name;
        public int sequence;
        public int order;
        public double maxMarks;
        public List<String> coIds = new ArrayList<>();
        public String plannedDate;
    }

    public static class Issue {
        public String code;
        public String message;
        public String assessmentId;
    }
}
