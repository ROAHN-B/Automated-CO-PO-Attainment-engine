package com.copo.attainment_engine.workspace.cam;

import com.copo.attainment_engine.common.web.ApiException;
import com.copo.attainment_engine.workspace.Offering;
import com.copo.attainment_engine.workspace.OfferingService;
import com.copo.attainment_engine.workspace.ai.AiClient;
import com.copo.attainment_engine.workspace.cam.CamDocs.Cam;
import com.copo.attainment_engine.workspace.cam.CamDocs.Cell;
import com.copo.attainment_engine.workspace.cam.CamDocs.Inputs;
import com.copo.attainment_engine.workspace.cam.CamDocs.Item;
import com.copo.attainment_engine.workspace.cam.CamDocs.UnitLink;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * API_CONTRACT §9: CAM-1 to CAM-6. The AI only suggests (Mayuri's service); this service
 * never writes a suggestion into the CAM. Faculty decisions arrive through CAM-2.
 */
@Service
public class CamService {

    public record CamUpdate(Integer version, Inputs inputs, List<UnitLink> unitLinks, List<Cell> cells) {}

    private static final Set<String> SOURCES = Set.of("FACULTY", "AI_ACCEPTED", "AI_EDITED");

    private final MongoTemplate mongo;
    private final OfferingService offerings;
    private final AiClient ai;

    public CamService(MongoTemplate mongo, OfferingService offerings, AiClient ai) {
        this.mongo = mongo;
        this.offerings = offerings;
        this.ai = ai;
    }

    /** CAM-1 */
    public Cam cam(String offeringId) {
        Offering o = offerings.own(offeringId);
        OfferingService.requireOpen(o.progress.setup.cam);
        return find(o);
    }

    /** CAM-2: inputs, unit → CO links and cells, as the faculty decided them. */
    public Cam save(String offeringId, CamUpdate update) {
        Offering o = offerings.own(offeringId);
        Cam cam = editable(o, update.version());
        if (update.inputs() == null) throw ApiException.validation("The CAM inputs are missing.", null);
        for (String kind : List.of("activities", "practicals", "tutorials")) {
            if (!itemIds(items(cam.inputs, kind)).equals(itemIds(items(update.inputs(), kind)))) {
                throw ApiException.validation("Activities, practicals and tutorials come from the assessment plan; they can’t be added or removed here.", null);
            }
        }
        Inputs inputs = validInputs(update.inputs());
        Set<String> coIds = inputs.courseOutcomes.stream().map(c -> c.coId).collect(Collectors.toSet());
        Set<String> outcomeIds = inputs.programOutcomes.stream().map(x -> x.outcomeId).collect(Collectors.toSet());
        Set<Integer> units = inputs.units.stream().map(u -> u.unitNumber).collect(Collectors.toSet());

        // Removing a CO, unit or outcome removes what pointed at it (§9.4).
        List<UnitLink> links = nonNull(update.unitLinks()).stream()
                .filter(l -> coIds.contains(l.coId) && units.contains(l.unitNumber)).toList();
        List<Cell> cells = nonNull(update.cells()).stream()
                .filter(c -> coIds.contains(c.coId) && outcomeIds.contains(c.outcomeId)).toList();
        for (UnitLink l : links) if (!SOURCES.contains(l.source)) l.source = "FACULTY";
        for (Cell c : cells) {
            if (c.level < 1 || c.level > 3) throw ApiException.validation("Each matrix cell is 1, 2, 3 or blank.", null);
            if (!SOURCES.contains(c.source)) c.source = "FACULTY";
        }
        for (String kind : List.of("activities", "practicals", "tutorials")) {
            for (Item i : items(inputs, kind)) i.coIds = i.coIds == null ? new ArrayList<>() : i.coIds.stream().filter(coIds::contains).toList();
        }

        Function<UnitLink, String> key = l -> l.unitNumber + "|" + l.coId;
        boolean linksChanged = !cam.unitMapping.links.stream().map(key).sorted().toList().equals(links.stream().map(key).sorted().toList());
        if ("CONFIRMED".equals(cam.unitMapping.status) && (linksChanged || evidenceChanged(cam.inputs, inputs))) {
            cam.unitMapping = new CamDocs.UnitMapping();   // the AI's evidence changed: back to draft
        }
        cam.inputs = inputs;
        cam.unitMapping.links = new ArrayList<>(links);
        cam.cells = new ArrayList<>(cells);
        offerings.camStarted(o);
        return touch(cam, o);
    }

    /** CAM-5 (stage 1): the AI suggests unit → CO links. */
    public JsonNode suggestUnits(String offeringId, List<String> coIds) {
        Offering o = offerings.own(offeringId);
        Cam cam = editable(o, null);
        if (cam.inputs.courseOutcomes.isEmpty() || cam.inputs.units.isEmpty()) {
            throw ApiException.precondition("Add at least one CO and one unit before asking for suggestions.");
        }
        return ai.post("/cam/unit-mapping/suggestions", request(o, cam, "UNIT_CO_MAPPING", coIds));
    }

    /** CAM-6: every CO needs at least one unit. */
    public Cam confirmUnits(String offeringId, Integer version) {
        Offering o = offerings.own(offeringId);
        Cam cam = editable(o, version);
        if (cam.inputs.courseOutcomes.isEmpty()) throw ApiException.precondition("Add the course outcomes before confirming the mapping.");
        Set<String> linked = cam.unitMapping.links.stream().map(l -> l.coId).collect(Collectors.toSet());
        List<String> missing = cam.inputs.courseOutcomes.stream().filter(c -> !linked.contains(c.coId)).map(c -> c.code).toList();
        if (!missing.isEmpty()) {
            throw ApiException.precondition(String.join(", ", missing) + (missing.size() == 1 ? " has" : " have") + " no unit yet. Link every CO to at least one unit.");
        }
        cam.unitMapping.status = "CONFIRMED";
        cam.unitMapping.confirmedAt = Instant.now();
        cam.unitMapping.confirmedBy = by(o);
        return touch(cam, o);
    }

    /** CAM-4 (stage 2): the AI suggests CO → PO/PSO levels; only after the mapping is confirmed. */
    public JsonNode suggestCells(String offeringId, List<String> coIds) {
        Offering o = offerings.own(offeringId);
        Cam cam = editable(o, null);
        if (!"CONFIRMED".equals(cam.unitMapping.status)) {
            throw ApiException.precondition("Confirm the unit → CO mapping before asking for PO/PSO suggestions.");
        }
        return ai.post("/cam/co-po-correlation/suggestions", request(o, cam, "CO_PO_CORRELATION", coIds));
    }

    /** CAM-3: locks the whole CAM and opens the first assessment cycle. */
    public Cam finalizeCam(String offeringId, Integer version) {
        Offering o = offerings.own(offeringId);
        Cam cam = editable(o, version);
        if (!"CONFIRMED".equals(cam.unitMapping.status)) throw ApiException.precondition("Confirm the unit → CO mapping before finalizing.");
        cam.status = "FINALIZED";
        Cam saved = touch(cam, o);
        offerings.camFinalized(o);
        return saved;
    }

    /** The finalized CAM's COs, for the question paper and marksheet. */
    public List<CamDocs.CourseOutcome> courseOutcomes(Offering o) {
        Cam cam = find(o);
        if (!"FINALIZED".equals(cam.status)) throw ApiException.conflict("STAGE_LOCKED", "Finalize the CAM first.");
        return cam.inputs.courseOutcomes;
    }

    /* -------------------------------- internals -------------------------------- */

    Cam find(Offering o) {
        Cam cam = mongo.findOne(Query.query(Criteria.where("offeringId").is(o.id)), Cam.class);
        if (cam == null) throw ApiException.conflict("STAGE_LOCKED", "Finalize the assessment plan first.");
        return cam;
    }

    private Cam editable(Offering o, Integer version) {
        OfferingService.requireOpen(o.progress.setup.cam);
        Cam cam = find(o);
        if ("FINALIZED".equals(cam.status)) throw ApiException.conflict("ALREADY_FINALIZED", "The CAM is finalized.");
        if (version != null && version != cam.version) throw ApiException.versionConflict();
        return cam;
    }

    private Cam touch(Cam cam, Offering o) {
        cam.version++;
        cam.updatedAt = Instant.now();
        cam.updatedBy = by(o);
        return mongo.save(cam);
    }

    private static String by(Offering o) {
        return o.courseCoordinator != null ? o.courseCoordinator.fullName : "Faculty";
    }

    /** Unique, non-blank codes; text where it's required; server IDs for new entries. */
    private static Inputs validInputs(Inputs raw) {
        Inputs in = raw;
        in.courseObjectives = nonNull(in.courseObjectives).stream().map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toCollection(ArrayList::new));
        in.courseOutcomes = new ArrayList<>(nonNull(in.courseOutcomes));
        in.units = new ArrayList<>(nonNull(in.units));
        in.programOutcomes = new ArrayList<>(nonNull(in.programOutcomes));
        Map<String, String> errors = new LinkedHashMap<>();
        unique(in.courseOutcomes.stream().map(c -> c.code).toList(), "courseOutcomes", "code", errors);
        unique(in.units.stream().map(u -> String.valueOf(u.unitNumber)).toList(), "units", "unitNumber", errors);
        unique(in.programOutcomes.stream().map(x -> x.code).toList(), "programOutcomes", "code", errors);
        for (int i = 0; i < in.courseOutcomes.size(); i++) {
            if (blank(in.courseOutcomes.get(i).statement)) errors.put("inputs.courseOutcomes[" + i + "].statement", "Required");
        }
        for (int i = 0; i < in.units.size(); i++) if (blank(in.units.get(i).title)) errors.put("inputs.units[" + i + "].title", "Required");
        for (int i = 0; i < in.programOutcomes.size(); i++) {
            String kind = in.programOutcomes.get(i).kind;
            if (!"PO".equals(kind) && !"PSO".equals(kind)) errors.put("inputs.programOutcomes[" + i + "].kind", "PO or PSO");
        }
        if (!errors.isEmpty()) {
            String first = errors.keySet().iterator().next();
            String what = first.contains("courseOutcomes") ? "course outcome" : first.contains("units") ? "unit" : "program outcome";
            throw ApiException.validation("Check the " + what + " list: each needs a unique code and some text.", errors);
        }
        for (String kind : List.of("activities", "practicals", "tutorials")) {
            if (items(in, kind).stream().anyMatch(i -> blank(i.title))) {
                throw ApiException.validation("Each activity, practical and tutorial needs a title.", null);
            }
        }
        in.courseOutcomes.forEach(c -> { if (blank(c.coId)) c.coId = "co-" + shortId(); });
        in.programOutcomes.forEach(x -> { if (blank(x.outcomeId)) x.outcomeId = "out-" + shortId(); });
        return in;
    }

    private static void unique(List<String> keys, String path, String field, Map<String, String> errors) {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < keys.size(); i++) {
            String k = keys.get(i) == null ? "" : keys.get(i).trim().toUpperCase(Locale.ROOT);
            if (k.isEmpty()) errors.put("inputs." + path + "[" + i + "]." + field, "Required");
            else if (!seen.add(k)) errors.put("inputs." + path + "[" + i + "]." + field, "Duplicate");
        }
    }

    private static boolean evidenceChanged(Inputs before, Inputs after) {
        Function<Inputs, String> evidence = in -> in.courseOutcomes.stream().map(c -> c.coId + "=" + c.code + ":" + c.statement).collect(Collectors.joining("\n"))
                + "\n--\n" + in.units.stream().map(u -> u.unitNumber + ":" + u.title + ":" + u.content).collect(Collectors.joining("\n"));
        return !evidence.apply(before).equals(evidence.apply(after));
    }

    private static List<Item> items(Inputs in, String kind) {
        return nonNull(switch (kind) {
            case "activities" -> in.activities;
            case "practicals" -> in.practicals;
            default -> in.tutorials;
        });
    }

    private static List<String> itemIds(List<Item> items) {
        return items.stream().map(i -> Objects.toString(i.itemId, "")).sorted().toList();
    }

    /** §9.5 CamSuggestionContext, as Mayuri's service expects it (unknown fields are refused there). */
    private static Map<String, Object> request(Offering o, Cam cam, String stage, List<String> coIds) {
        Map<String, Object> course = new LinkedHashMap<>();
        course.put("syllabusCourseId", o.course.syllabusCourseId);
        course.put("courseCode", o.course.courseCode);
        course.put("courseName", o.course.courseName);
        course.put("courseType", o.courseType != null ? o.courseType : "CORE");
        course.put("assessmentScheme", o.assessmentScheme);

        Inputs in = cam.inputs;
        Map<String, Object> inputs = new LinkedHashMap<>();
        inputs.put("courseObjectives", in.courseObjectives);
        inputs.put("courseOutcomes", in.courseOutcomes.stream().map(c -> Map.of("coId", c.coId, "code", c.code, "statement", c.statement)).toList());
        inputs.put("units", in.units.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("unitNumber", u.unitNumber);
            m.put("title", u.title);
            m.put("content", Objects.toString(u.content, ""));
            if (u.hours != null) m.put("hours", u.hours);
            return m;
        }).toList());
        inputs.put("programOutcomes", in.programOutcomes.stream().map(x -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("outcomeId", x.outcomeId);
            m.put("kind", x.kind);
            m.put("code", x.code);
            if (!blank(x.title)) m.put("title", x.title);
            m.put("statement", Objects.toString(x.statement, ""));
            return m;
        }).toList());
        for (String kind : List.of("activities", "practicals", "tutorials")) {
            inputs.put(kind, items(in, kind).stream().map(i -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("itemId", i.itemId);
                m.put("title", i.title);
                if (!blank(i.description)) m.put("description", i.description);
                m.put("coIds", nonNull(i.coIds));
                return m;
            }).toList());
        }

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("stage", stage);
        context.put("offeringId", o.id);
        context.put("course", course);
        context.put("inputs", inputs);
        if (coIds != null && !coIds.isEmpty()) context.put("coIds", coIds);
        if ("CO_PO_CORRELATION".equals(stage)) {
            context.put("unitLinks", cam.unitMapping.links.stream().map(l -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("unitNumber", l.unitNumber);
                m.put("coId", l.coId);
                m.put("source", l.source);
                if (l.suggestionId != null) m.put("suggestionId", l.suggestionId);
                return m;
            }).toList());
            context.put("rubric", cam.scoringRubric);
        }
        return Map.of("basedOnCamVersion", cam.version, "context", context);
    }

    private static <T> List<T> nonNull(List<T> list) {
        return list == null ? List.of() : list;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String shortId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
