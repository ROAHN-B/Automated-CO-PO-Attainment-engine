package com.copo.attainment_engine.workspace.qp;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** The typed question paper and its AI review (API_CONTRACT §10), stored as the frontend reads them. */
public final class QpDocs {

    private QpDocs() {}

    @Document(collection = "questionPapers")
    public static class Paper {
        @Id public String validationId;
        @Indexed(unique = true) public String assessmentId;
        public String offeringId;
        public String status = "DRAFT";  // DRAFT | ANALYZING | ANALYSIS_FAILED | ANALYSIS_READY | FINALIZED
        public int version;
        public Header header = new Header();
        public List<String> coIds = new ArrayList<>();
        public List<Question> questions = new ArrayList<>();
        public Error error;
        public Instant analysisStartedAt;
        public Instant finalizedAt;
        public Instant updatedAt;
        public String updatedBy;
    }

    public static class Header {
        public String setLabel;
        public double maxMarks;
        public Integer durationMinutes;
        public String examDate;
    }

    public static class Error {
        public String errorCode;
        public String message;

        public static Error of(String errorCode, String message) {
            Error e = new Error();
            e.errorCode = errorCode;
            e.message = message;
            return e;
        }
    }

    public static class AttemptRule {
        public int attempt;
        public int outOf;
    }

    public static class Question {
        public String questionNo;
        public String heading;
        public AttemptRule attemptRule;
        /** The CO when the question has no parts. */
        public String coId;
        public List<Part> parts;
        public List<SubQuestion> subQuestions;
    }

    public static class Part {
        public String label;
        public String coId;
        public List<SubQuestion> subQuestions = new ArrayList<>();
    }

    public static class SubQuestion {
        public String label;
        public String text;
        public String type;               // DESCRIPTIVE | MCQ
        public List<Option> options;
        public double marks;
        public String expectedBloomLevel;
    }

    public static class Option {
        public String key;
        public String text;
    }

    /** §10.3 QpValidationResult: the current one per paper (keyed by assessment). */
    @Document(collection = "qpValidationResults")
    public static class Result {
        @Id public String assessmentId;
        public String validationId;
        public int basedOnVersion;
        public int overallValidationScore;
        public String summary;
        public List<Validated> subQuestions = new ArrayList<>();
        public List<CoCoverage> coCoverage = new ArrayList<>();
        public List<BloomCount> bloomDistribution = new ArrayList<>();
        public String modelUsed;
        public String templateId;
        public String templateVersion;
        public Instant generatedAt;
    }

    public static class Validated {
        public String questionNo;
        public String partLabel;
        public String label;
        public String coId;
        public String coAlignment;
        public String suggestedCoId;
        public String expectedBloomLevel;
        public String detectedBloomLevel;
        public String bloomAlignment;
        public McqCheck mcqCheck;
        public String aiAnalysis;
        public int validationScore;
        public List<String> flags;
    }

    public static class McqCheck {
        public String status;             // OK | ISSUE
        public String note;
    }

    public static class CoCoverage {
        public String coId;
        public String code;
        public int subQuestionCount;
        public double marks;
    }

    public static class BloomCount {
        public String level;
        public int subQuestionCount;
        public double marks;
    }

    /** A sub-question with the part and question it belongs to, in paper order. */
    public record Flat(Question question, Part part, SubQuestion sub) {
        public String coId() { return part != null ? part.coId : question.coId; }
        public String partLabel() { return part != null ? part.label : null; }
    }

    public static List<Flat> flatten(Question q) {
        List<Flat> out = new ArrayList<>();
        if (q.parts != null && !q.parts.isEmpty()) {
            for (Part p : q.parts) for (SubQuestion s : p.subQuestions == null ? List.<SubQuestion>of() : p.subQuestions) out.add(new Flat(q, p, s));
        } else if (q.subQuestions != null) {
            for (SubQuestion s : q.subQuestions) out.add(new Flat(q, null, s));
        }
        return out;
    }

    public static List<Flat> flatten(List<Question> questions) {
        List<Flat> out = new ArrayList<>();
        for (Question q : questions) out.addAll(flatten(q));
        return out;
    }
}
