package com.copo.attainment_engine.workspace.qp;

import com.copo.attainment_engine.common.web.ApiException;
import com.copo.attainment_engine.workspace.cam.CamDocs;
import com.copo.attainment_engine.workspace.qp.QpDocs.Flat;
import com.copo.attainment_engine.workspace.qp.QpDocs.Paper;
import com.copo.attainment_engine.workspace.qp.QpDocs.Question;
import com.copo.attainment_engine.workspace.qp.QpDocs.SubQuestion;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/** The paper checks and marks of API_CONTRACT §10.7.4: the blocking `issues` and `computedTotalMarks`. */
public final class PaperRules {

    private PaperRules() {}

    public record Issue(String code, String message, String path) {}

    public static final List<String> BLOOM_LEVELS = List.of("REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE");

    /** QPV-7 defaults: verbs that signal each level (sent to the AI as guidance). */
    public static final Map<String, List<String>> BLOOM_KEYWORDS = new LinkedHashMap<>();
    static {
        BLOOM_KEYWORDS.put("REMEMBER", List.of("define", "list", "state", "name", "what is", "which", "identify", "recall", "expand"));
        BLOOM_KEYWORDS.put("UNDERSTAND", List.of("explain", "describe", "discuss", "illustrate", "summarize", "classify", "outline", "why"));
        BLOOM_KEYWORDS.put("APPLY", List.of("apply", "compute", "calculate", "configure", "implement", "demonstrate", "solve", "use", "encrypt", "decrypt"));
        BLOOM_KEYWORDS.put("ANALYZE", List.of("analyze", "analyse", "compare", "differentiate", "distinguish", "examine", "contrast"));
        BLOOM_KEYWORDS.put("EVALUATE", List.of("evaluate", "justify", "assess", "critique", "recommend", "defend"));
        BLOOM_KEYWORDS.put("CREATE", List.of("design", "create", "propose", "develop", "construct", "formulate", "plan"));
    }

    /** A question's marks: all its sub-questions, or only the `attempt` highest with an attempt rule. */
    public static double questionMarks(Question q) {
        List<Double> marks = QpDocs.flatten(q).stream().map(f -> f.sub().marks).sorted(Comparator.reverseOrder()).toList();
        int take = q.attemptRule != null && q.attemptRule.attempt > 0 ? Math.min(q.attemptRule.attempt, marks.size()) : marks.size();
        return marks.subList(0, take).stream().mapToDouble(Double::doubleValue).sum();
    }

    public static double paperMarks(List<Question> questions) {
        return questions.stream().mapToDouble(PaperRules::questionMarks).sum();
    }

    /** Limits the form can't produce: 400 instead of an issue. */
    public static void checkLimits(List<Question> questions) {
        if (questions.size() > 30) throw ApiException.validation("A paper can have at most 30 questions.", null);
        for (Question q : questions) {
            if (q.parts != null && q.parts.size() > 10) throw ApiException.validation("A question can have at most 10 parts.", null);
            if (q.heading != null && q.heading.length() > 300) throw ApiException.validation("A heading can be at most 300 characters.", null);
            List<Flat> subs = QpDocs.flatten(q);
            if (subs.size() > 30) throw ApiException.validation("A question can have at most 30 sub-questions.", null);
            for (Flat f : subs) {
                SubQuestion s = f.sub();
                if (!"DESCRIPTIVE".equals(s.type) && !"MCQ".equals(s.type)) throw ApiException.validation("A sub-question is DESCRIPTIVE or MCQ.", null);
                if (!BLOOM_LEVELS.contains(s.expectedBloomLevel)) throw ApiException.validation("Choose an expected Bloom level for every sub-question.", null);
                if (!"MCQ".equals(s.type) && s.options != null && !s.options.isEmpty()) throw ApiException.validation("Only MCQs have options.", null);
                if (s.text != null && s.text.length() > 4000) throw ApiException.validation("Question text can be at most 4,000 characters.", null);
                if (s.options != null && s.options.stream().anyMatch(o -> o.text != null && o.text.length() > 500)) {
                    throw ApiException.validation("An option can be at most 500 characters.", null);
                }
                if (Math.round(s.marks * 10) != s.marks * 10) throw ApiException.validation("Marks can have at most one decimal place.", null);
            }
        }
    }

    public static List<Issue> issues(Paper paper, List<CamDocs.CourseOutcome> courseOutcomes) {
        List<Issue> issues = new ArrayList<>();
        Map<String, String> known = courseOutcomes.stream().collect(Collectors.toMap(c -> c.coId, c -> c.code, (a, b) -> a, LinkedHashMap::new));
        Set<String> selected = new HashSet<>(paper.coIds);

        if (paper.coIds.isEmpty()) issues.add(new Issue("CO_NOT_SELECTED", "Tick the COs this paper covers.", "coIds"));
        for (int i = 0; i < paper.coIds.size(); i++) {
            if (!known.containsKey(paper.coIds.get(i))) issues.add(new Issue("CO_NOT_SELECTED", "One of the ticked COs isn’t in the course’s CAM.", "coIds[" + i + "]"));
        }
        if (!(paper.header.maxMarks > 0)) issues.add(new Issue("INVALID_MARKS", "Enter the paper’s maximum marks.", "header.maxMarks"));
        if (paper.questions.isEmpty()) issues.add(new Issue("NO_QUESTIONS", "Add at least one question.", "questions"));
        for (String l : duplicates(paper.questions.stream().map(q -> q.questionNo).toList())) {
            issues.add(new Issue("DUPLICATE_LABEL", "Two questions are numbered " + l.toUpperCase(Locale.ROOT) + ".", "questions"));
        }

        for (int qi = 0; qi < paper.questions.size(); qi++) {
            Question q = paper.questions.get(qi);
            String qp = "questions[" + qi + "]";
            String qName = blank(q.questionNo) ? "Question " + (qi + 1) : q.questionNo.trim();
            if (blank(q.questionNo)) issues.add(new Issue("MISSING_TEXT", "Question " + (qi + 1) + " needs a number.", qp + ".questionNo"));
            boolean hasParts = q.parts != null && !q.parts.isEmpty();
            if (hasParts && q.subQuestions != null && !q.subQuestions.isEmpty()) {
                issues.add(new Issue("MISSING_TEXT", qName + " has both parts and direct sub-questions; keep one.", qp));
            }
            if (hasParts) {
                for (String l : duplicates(q.parts.stream().map(p -> p.label).toList())) {
                    issues.add(new Issue("DUPLICATE_LABEL", qName + " has two parts labelled (" + l + ").", qp + ".parts"));
                }
                for (int pi = 0; pi < q.parts.size(); pi++) {
                    QpDocs.Part p = q.parts.get(pi);
                    String where = qName + " (" + (blank(p.label) ? String.valueOf(pi + 1) : p.label.trim()) + ")";
                    if (blank(p.label)) issues.add(new Issue("MISSING_TEXT", "Part " + (pi + 1) + " of " + qName + " needs a label.", qp + ".parts[" + pi + "].label"));
                    coCheck(p.coId, where, qp + ".parts[" + pi + "].coId", selected, known, issues);
                    subs(p.subQuestions == null ? List.of() : p.subQuestions, where, qp + ".parts[" + pi + "].subQuestions", issues);
                }
            } else {
                coCheck(q.coId, qName, qp + ".coId", selected, known, issues);
                subs(q.subQuestions == null ? List.of() : q.subQuestions, qName, qp + ".subQuestions", issues);
            }
            if (q.attemptRule != null) {
                int count = QpDocs.flatten(q).size();
                int attempt = q.attemptRule.attempt, outOf = q.attemptRule.outOf;
                if (attempt < 1 || attempt > outOf || outOf != count) {
                    issues.add(new Issue("ATTEMPT_RULE", qName + ": “attempt " + attempt + " of " + outOf + "” must match its " + count + " sub-questions.", qp + ".attemptRule"));
                }
            }
        }
        double total = paperMarks(paper.questions);
        if (paper.header.maxMarks > 0 && !paper.questions.isEmpty() && total != paper.header.maxMarks) {
            issues.add(new Issue("TOTAL_MISMATCH", "The questions add up to " + fmt(total) + " marks, but the paper is out of " + fmt(paper.header.maxMarks) + ".", "header.maxMarks"));
        }
        return issues;
    }

    private static void coCheck(String coId, String where, String path, Set<String> selected, Map<String, String> known, List<Issue> issues) {
        if (blank(coId)) issues.add(new Issue("MISSING_CO", "Choose the CO for " + where + ".", path));
        else if (!selected.contains(coId)) {
            issues.add(new Issue("CO_NOT_SELECTED", where + " uses " + known.getOrDefault(coId, "a CO") + ", which isn’t ticked for this paper.", path));
        }
    }

    private static void subs(List<SubQuestion> list, String where, String path, List<Issue> issues) {
        if (list.isEmpty()) issues.add(new Issue("NO_QUESTIONS", where + " has no sub-questions.", path));
        for (String l : duplicates(list.stream().map(s -> s.label).toList())) {
            issues.add(new Issue("DUPLICATE_LABEL", where + " has two sub-questions labelled (" + l + ").", path));
        }
        for (int si = 0; si < list.size(); si++) {
            SubQuestion s = list.get(si);
            String sp = path + "[" + si + "]";
            String sName = where + " (" + (blank(s.label) ? String.valueOf(si + 1) : s.label.trim()) + ")";
            if (blank(s.label)) issues.add(new Issue("MISSING_TEXT", "Sub-question " + (si + 1) + " of " + where + " needs a label.", sp + ".label"));
            if (blank(s.text)) issues.add(new Issue("MISSING_TEXT", sName + " has no question text.", sp + ".text"));
            if (!(s.marks > 0)) issues.add(new Issue("INVALID_MARKS", sName + " needs marks greater than 0.", sp + ".marks"));
            if ("MCQ".equals(s.type)) {
                List<QpDocs.Option> opts = s.options == null ? List.of() : s.options;
                List<String> keys = opts.stream().map(o -> o.key == null ? "" : o.key.trim().toUpperCase(Locale.ROOT)).toList();
                if (opts.size() < 2 || opts.size() > 6) issues.add(new Issue("MCQ_OPTIONS", sName + " needs 2 to 6 options.", sp + ".options"));
                else if (opts.stream().anyMatch(o -> blank(o.text))) issues.add(new Issue("MCQ_OPTIONS", sName + " has an empty option.", sp + ".options"));
                else if (new HashSet<>(keys).size() != keys.size()) issues.add(new Issue("MCQ_OPTIONS", sName + " repeats an option letter.", sp + ".options"));
            }
        }
    }

    /** Repeated labels, trimmed and case-insensitive. */
    private static List<String> duplicates(List<String> labels) {
        Set<String> seen = new HashSet<>();
        List<String> out = new ArrayList<>();
        for (String l : labels) {
            String k = l == null ? "" : l.trim().toLowerCase(Locale.ROOT);
            if (!k.isEmpty() && !seen.add(k) && !out.contains(k)) out.add(k);
        }
        return out;
    }

    static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    /** 15.0 → "15", 7.5 → "7.5". */
    public static String fmt(double d) {
        return d == Math.rint(d) ? String.valueOf((long) d) : String.valueOf(d);
    }
}
