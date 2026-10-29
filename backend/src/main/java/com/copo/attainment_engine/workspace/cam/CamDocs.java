package com.copo.attainment_engine.workspace.cam;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** The course articulation matrix of API_CONTRACT §9, stored as the frontend reads it. */
public final class CamDocs {

    private CamDocs() {}

    @Document(collection = "cams")
    public static class Cam {
        @Id public String camId;
        @Indexed(unique = true) public String offeringId;
        public String status = "DRAFT";      // DRAFT | FINALIZED
        public int version = 1;
        public Inputs inputs = new Inputs();
        public UnitMapping unitMapping = new UnitMapping();
        public List<Cell> cells = new ArrayList<>();
        public Rubric scoringRubric = Rubric.proposed();
        public Instant updatedAt;
        public String updatedBy;
    }

    public static class Inputs {
        public List<String> courseObjectives = new ArrayList<>();
        public List<CourseOutcome> courseOutcomes = new ArrayList<>();
        public List<Unit> units = new ArrayList<>();
        /** Faculty-editable until after the POE; starts as the department's 11 POs and 3 PSOs. */
        public List<ProgramOutcome> programOutcomes = new ArrayList<>();
        public List<Item> activities = new ArrayList<>();
        public List<Item> practicals = new ArrayList<>();
        public List<Item> tutorials = new ArrayList<>();
    }

    public static class CourseOutcome {
        public String coId;
        public String code;
        public String statement;

        public static CourseOutcome of(String coId, String code, String statement) {
            CourseOutcome c = new CourseOutcome();
            c.coId = coId;
            c.code = code;
            c.statement = statement;
            return c;
        }
    }

    public static class Unit {
        public int unitNumber;
        public String title;
        public String content;
        public Double hours;

        public static Unit of(int unitNumber, String title, double hours, String content) {
            Unit u = new Unit();
            u.unitNumber = unitNumber;
            u.title = title;
            u.hours = hours;
            u.content = content;
            return u;
        }
    }

    public static class ProgramOutcome {
        public String outcomeId;
        public String kind;                  // PO | PSO
        public String code;
        public String title;
        public String statement;

        public static ProgramOutcome of(String kind, String code, String title, String statement) {
            ProgramOutcome o = new ProgramOutcome();
            o.outcomeId = "out-" + code.toLowerCase();
            o.kind = kind;
            o.code = code;
            o.title = title;
            o.statement = statement;
            return o;
        }
    }

    public static class Item {
        public String itemId;
        public String title;
        public String description;
        public List<String> coIds = new ArrayList<>();
    }

    public static class UnitLink {
        public int unitNumber;
        public String coId;
        public String source;                // FACULTY | AI_ACCEPTED | AI_EDITED
        public String suggestionId;
    }

    public static class UnitMapping {
        public String status = "DRAFT";      // DRAFT | CONFIRMED
        public List<UnitLink> links = new ArrayList<>();
        public Instant confirmedAt;
        public String confirmedBy;
    }

    public static class Cell {
        public String coId;
        public String outcomeId;
        public int level;                    // 1..3; blank cells aren't stored
        public String justification;
        public String source;
        public String suggestionId;
    }

    /** Mayuri's proposed 3 / 2 / 1 / blank criteria, until the institution confirms official wording (O-21). */
    public static class Rubric {
        public String rubricId;
        public int version;
        public String status;
        public List<RubricLevel> levels = new ArrayList<>();
        public List<String> rules = new ArrayList<>();

        public static Rubric proposed() {
            Rubric r = new Rubric();
            r.rubricId = "rubric-cam-default";
            r.version = 1;
            r.status = "PROPOSED";
            r.levels = List.of(
                    RubricLevel.of(3, "High", "The CO directly and strongly develops the ability described by the PO/PSO."),
                    RubricLevel.of(2, "Medium", "The CO develops relevant knowledge or skills described by the PO/PSO."),
                    RubricLevel.of(1, "Low", "The CO makes a limited but meaningful contribution to the PO/PSO."),
                    RubricLevel.of(null, "Blank", "The course evidence doesn’t establish a meaningful relationship."));
            r.rules = List.of(
                    "Justify every non-blank level with evidence from the official CO, the relevant units and the PO/PSO statement.",
                    "Never give a level only because the wording looks similar.");
            return r;
        }
    }

    public static class RubricLevel {
        public Integer level;
        public String label;
        public String meaning;

        static RubricLevel of(Integer level, String label, String meaning) {
            RubricLevel l = new RubricLevel();
            l.level = level;
            l.label = label;
            l.meaning = meaning;
            return l;
        }
    }
}
