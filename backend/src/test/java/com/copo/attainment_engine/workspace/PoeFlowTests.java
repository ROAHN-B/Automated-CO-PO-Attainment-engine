package com.copo.attainment_engine.workspace;

import com.copo.attainment_engine.TestcontainersConfiguration;
import com.copo.attainment_engine.workspace.ai.AiClient;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The POE flow on the live course, end to end through the API: sign in, accept, plan,
 * CAM with both AI stages, ISE-1 paper validation with the AI, moderation sheet,
 * confirm paper, marksheet, workbook columns. The AI client answers like Mayuri's service.
 */
@SpringBootTest(properties = {
        "app.jwt.secret=test-only-signing-key-0123456789abcdef",
        "app.seed.enabled=true",
        "app.seed.demo-password=test-pass-123",
        "app.seed.reset-course=true"})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PoeFlowTests {

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @MockitoBean AiClient ai;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        token = login("faculty@wit.edu");
        when(ai.post(eq("/cam/unit-mapping/suggestions"), any())).thenReturn(json.readTree("""
                {"suggestionSetId":"uss-1","basedOnCamVersion":2,"modelUsed":"gemini-test","generatedAt":"2026-10-29T10:00:00Z",
                 "suggestions":[{"suggestionId":"us-1","unitNumber":1,"coId":"co-ns-1","rationale":"Unit 1 teaches CO1.","needsReview":false}]}"""));
        when(ai.post(eq("/cam/co-po-correlation/suggestions"), any())).thenReturn(json.readTree("""
                {"suggestionSetId":"css-1","basedOnCamVersion":4,"rubricVersion":1,"modelUsed":"gemini-test","generatedAt":"2026-10-29T10:00:00Z",
                 "suggestions":[{"suggestionId":"cs-1","coId":"co-ns-1","outcomeId":"out-po1","suggestedLevel":3,"rationale":"r",
                                 "evidence":{"unitNumbers":[1],"itemIds":[]},"needsReview":false}]}"""));
        // The QP review: one judgement per sub-question; the first one reads closer to CO2 and a level higher.
        when(ai.post(eq("/question-paper/validate"), any())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked") Map<String, Object> req = (Map<String, Object>) inv.getArgument(1);
            @SuppressWarnings("unchecked") Map<String, Object> ctx = (Map<String, Object>) req.get("context");
            @SuppressWarnings("unchecked") List<Map<String, Object>> subs = (List<Map<String, Object>>) ctx.get("subQuestions");
            ArrayNode out = json.createArrayNode();
            for (int i = 0; i < subs.size(); i++) {
                Map<String, Object> s = subs.get(i);
                ObjectNode n = out.addObject();
                n.put("questionNo", (String) s.get("questionNo"));
                n.put("partLabel", (String) s.get("partLabel"));
                n.put("label", (String) s.get("label"));
                n.put("coAlignment", i == 0 ? "PARTIAL" : "ALIGNED");
                if (i == 0) n.put("suggestedCoId", "co-ns-2");
                n.put("detectedBloomLevel", i == 0 ? "APPLY" : (String) s.get("expectedBloomLevel"));
                n.put("aiAnalysis", "Checked.");
            }
            ObjectNode answer = json.createObjectNode();
            answer.put("modelUsed", "gemini-test");
            answer.put("basedOnVersion", (Integer) req.get("basedOnVersion"));
            answer.put("summary", "Mostly aligned.");
            answer.set("subQuestions", out);
            return answer;
        });
    }

    @Test
    void theWholePoeFlow() throws Exception {
        // Dashboard: Network Security waits at "Accept allocation".
        String dash = body(call(get("/api/v1/me/dashboard"), null));
        String id = JsonPath.read(dash, "$.data.offerings[0].offeringId");
        assertThat((String) JsonPath.read(dash, "$.data.attention[0].step")).isEqualTo("SUBJECT_SELECTION");
        mvc.perform(call(post("/api/v1/offerings/" + id + "/assessment-plan/finalize"), "{\"version\":1}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("STAGE_LOCKED"));

        // Accept, then the generated plan: ISE-1, Activity 1, ISE-2, Activity 2, ESE.
        mvc.perform(call(post("/api/v1/offerings/" + id + "/accept"), null))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.progress.setup.assessmentPlan.status").value("AVAILABLE"));
        JsonNode plan = data(call(get("/api/v1/offerings/" + id + "/assessment-plan"), null));
        assertThat(plan.path("assessments").valueStream().map(a -> a.path("name").asString()).toList())
                .containsExactly("ISE-1", "Activity 1", "ISE-2", "Activity 2", "ESE");
        mvc.perform(call(post("/api/v1/offerings/" + id + "/assessment-plan/finalize"), "{\"version\":" + plan.path("version").asInt() + "}"))
                .andExpect(status().isUnprocessableContent()).andExpect(jsonPath("$.errorCode").value("PRECONDITION_FAILED"));
        ObjectNode update = json.createObjectNode();
        update.put("version", plan.path("version").asInt());
        ArrayNode items = update.putArray("assessments");
        for (JsonNode a : plan.path("assessments")) {
            ObjectNode i = items.addObject();
            i.put("assessmentId", a.path("assessmentId").asString());
            i.put("order", a.path("order").asInt());
            if ("ACTIVITY".equals(a.path("category").asString())) i.put("activityType", "MINI_PROJECT");
        }
        plan = data(call(put("/api/v1/offerings/" + id + "/assessment-plan"), json.writeValueAsString(update)));
        data(call(post("/api/v1/offerings/" + id + "/assessment-plan/finalize"), "{\"version\":" + plan.path("version").asInt() + "}"));
        String ise1 = plan.path("assessments").get(0).path("assessmentId").asString();

        // CAM: pre-filled from the syllabus and the department's outcomes; both AI stages.
        JsonNode cam = data(call(get("/api/v1/offerings/" + id + "/cam"), null));
        assertThat(cam.path("inputs").path("courseOutcomes").size()).isEqualTo(4);
        assertThat(cam.path("inputs").path("programOutcomes").size()).isEqualTo(14);
        assertThat(cam.path("inputs").path("activities").size()).isEqualTo(2);
        JsonNode stage1 = data(call(post("/api/v1/offerings/" + id + "/cam/unit-mapping/suggestions"), "{}"));
        assertThat(stage1.path("suggestions").get(0).path("coId").asString()).isEqualTo("co-ns-1");
        mvc.perform(call(post("/api/v1/offerings/" + id + "/cam/suggestions"), "{}"))
                .andExpect(status().isUnprocessableContent());

        ObjectNode camUpdate = json.createObjectNode();
        camUpdate.put("version", cam.path("version").asInt());
        ObjectNode inputs = (ObjectNode) cam.path("inputs").deepCopy();
        ((ObjectNode) inputs.path("programOutcomes").get(11)).put("statement", "Edited by the faculty.");   // PSO1
        camUpdate.set("inputs", inputs);
        ArrayNode links = camUpdate.putArray("unitLinks");
        String[][] unitCo = {{"1", "co-ns-1"}, {"2", "co-ns-2"}, {"3", "co-ns-2"}, {"4", "co-ns-3"}, {"6", "co-ns-4"}};
        for (String[] l : unitCo) links.addObject().put("unitNumber", Integer.parseInt(l[0])).put("coId", l[1]).put("source", "FACULTY");
        camUpdate.putArray("cells");
        cam = data(call(put("/api/v1/offerings/" + id + "/cam"), json.writeValueAsString(camUpdate)));
        assertThat(cam.path("inputs").path("programOutcomes").get(11).path("statement").asString()).isEqualTo("Edited by the faculty.");
        cam = data(call(post("/api/v1/offerings/" + id + "/cam/unit-mapping/confirm"), "{\"version\":" + cam.path("version").asInt() + "}"));
        assertThat(cam.path("unitMapping").path("status").asString()).isEqualTo("CONFIRMED");
        JsonNode stage2 = data(call(post("/api/v1/offerings/" + id + "/cam/suggestions"), "{}"));
        assertThat(stage2.path("suggestions").get(0).path("suggestedLevel").asInt()).isEqualTo(3);

        camUpdate = json.createObjectNode();
        camUpdate.put("version", cam.path("version").asInt());
        camUpdate.set("inputs", cam.path("inputs"));
        camUpdate.set("unitLinks", cam.path("unitMapping").path("links"));
        camUpdate.putArray("cells").addObject().put("coId", "co-ns-1").put("outcomeId", "out-po1").put("level", 3).put("source", "AI_ACCEPTED");
        cam = data(call(put("/api/v1/offerings/" + id + "/cam"), json.writeValueAsString(camUpdate)));
        assertThat(cam.path("unitMapping").path("status").asString()).isEqualTo("CONFIRMED");
        data(call(post("/api/v1/offerings/" + id + "/cam/finalize"), "{\"version\":" + cam.path("version").asInt() + "}"));
        JsonNode offering = data(call(get("/api/v1/offerings/" + id), null));
        assertThat(offering.path("progress").path("phase").asString()).isEqualTo("ASSESSMENTS");
        assertThat(offering.path("progress").path("nextAction").path("step").asString()).isEqualTo("PAPER_VALIDATION");

        // ISE-1 paper: an empty draft out of 15, then issues, then a valid paper.
        JsonNode paper = data(call(get("/api/v1/assessments/" + ise1 + "/question-paper"), null));
        assertThat(paper.path("version").asInt()).isZero();
        assertThat(paper.path("header").path("maxMarks").asDouble()).isEqualTo(15);
        String questions = """
                [{"questionNo":"Q1","coId":"co-ns-1","subQuestions":[
                    {"label":"i","text":"Explain the OSI security architecture with a neat diagram.","type":"DESCRIPTIVE","marks":5,"expectedBloomLevel":"UNDERSTAND"},
                    {"label":"ii","text":"Which cipher uses a 5x5 key matrix?","type":"MCQ","marks":1,"expectedBloomLevel":"REMEMBER",
                     "options":[{"key":"A","text":"Playfair"},{"key":"B","text":"Caesar"},{"key":"C","text":"Hill"},{"key":"D","text":"Vigenere"}]}]},
                 {"questionNo":"Q2","attemptRule":{"attempt":1,"outOf":2},"parts":[{"label":"a","coId":"co-ns-2","subQuestions":[
                    {"label":"i","text":"Illustrate one round of DES with the Feistel structure.","type":"DESCRIPTIVE","marks":9,"expectedBloomLevel":"UNDERSTAND"},
                    {"label":"ii","text":"Compute the RSA ciphertext for p = 3, q = 11, e = 7 and M = 5.","type":"DESCRIPTIVE","marks":9,"expectedBloomLevel":"APPLY"}]}]}]""";
        paper = data(call(put("/api/v1/assessments/" + ise1 + "/question-paper"),
                "{\"version\":0,\"header\":{\"setLabel\":\"A\",\"maxMarks\":99},\"coIds\":[\"co-ns-1\"],\"questions\":" + questions + "}"));
        assertThat(paper.path("header").path("maxMarks").asDouble()).isEqualTo(15);       // always the plan's
        assertThat(paper.path("computedTotalMarks").asDouble()).isEqualTo(15);
        assertThat(paper.path("issues").valueStream().map(i -> i.path("code").asString()).toList()).containsExactly("CO_NOT_SELECTED");
        mvc.perform(call(post("/api/v1/assessments/" + ise1 + "/question-paper/validate"), "{\"version\":" + paper.path("version").asInt() + "}"))
                .andExpect(status().isUnprocessableContent());
        paper = data(call(put("/api/v1/assessments/" + ise1 + "/question-paper"),
                "{\"version\":" + paper.path("version").asInt() + ",\"header\":{\"setLabel\":\"A\",\"maxMarks\":15},\"coIds\":[\"co-ns-1\",\"co-ns-2\"],\"questions\":" + questions + "}"));
        assertThat(paper.path("issues").size()).isZero();

        // Validate: 202 ANALYZING, then the background job finishes.
        mvc.perform(call(post("/api/v1/assessments/" + ise1 + "/question-paper/validate"), "{\"version\":" + paper.path("version").asInt() + "}"))
                .andExpect(status().isAccepted()).andExpect(jsonPath("$.data.status").value("ANALYZING"));
        for (int i = 0; i < 50 && !"ANALYSIS_READY".equals(paper.path("status").asString()); i++) {
            Thread.sleep(100);
            paper = data(call(get("/api/v1/assessments/" + ise1 + "/question-paper"), null));
        }
        assertThat(paper.path("status").asString()).isEqualTo("ANALYSIS_READY");
        JsonNode result = data(call(get("/api/v1/assessments/" + ise1 + "/question-paper/result"), null));
        // Q1(i): CO PARTIAL (−20) and APPLY vs UNDERSTAND, one level apart (−15) → 65; the rest 100.
        // Weighted by every sub-question's marks: (65×5 + 100×19) / 24 = 92.7 → 93.
        assertThat(result.path("subQuestions").get(0).path("validationScore").asInt()).isEqualTo(65);
        assertThat(result.path("subQuestions").get(0).path("bloomAlignment").asString()).isEqualTo("PARTIAL");
        assertThat(result.path("overallValidationScore").asInt()).isEqualTo(93);
        assertThat(result.path("coCoverage").size()).isEqualTo(2);
        assertThat(result.path("bloomDistribution").size()).isEqualTo(6);

        // Moderation sheet as Word and PDF, downloadable from the link without a token header.
        for (String format : List.of("DOCX", "PDF")) {
            JsonNode file = data(call(post("/api/v1/assessments/" + ise1 + "/question-paper/moderation-sheet"), "{\"format\":\"" + format + "\"}"));
            String path = file.path("downloadUrl").asString().replace("http://localhost", "");
            byte[] bytes = mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
            assertThat(bytes.length).isGreaterThan(1000);
            assertThat(new String(bytes, 0, 4)).isEqualTo(format.equals("PDF") ? "%PDF" : "PK\u0003\u0004");
        }

        // Confirm: the read-only marksheet is generated from the paper.
        data(call(post("/api/v1/assessments/" + ise1 + "/question-paper/finalize"), "{\"version\":" + paper.path("version").asInt() + "}"));
        JsonNode sheet = data(call(get("/api/v1/assessments/" + ise1 + "/structure"), null));
        assertThat(sheet.path("source").asString()).isEqualTo("QUESTION_PAPER");
        assertThat(sheet.path("questions").get(1).path("subQuestions").get(0).path("label").asString()).isEqualTo("(a)(i)");
        assertThat(sheet.path("computedMaxMarks").asDouble()).isEqualTo(15);
        assertThat(sheet.path("issues").size()).isZero();

        // Finalize: its columns appear in the workbook, read-only, and marks entry opens.
        data(call(post("/api/v1/assessments/" + ise1 + "/structure/finalize"), "{\"version\":" + sheet.path("version").asInt() + "}"));
        JsonNode wb = data(call(get("/api/v1/offerings/" + id + "/workbook"), null));
        JsonNode block = wb.path("data").path("blocks").get(0);
        assertThat(block.path("status").asString()).isEqualTo("AWAITING_MARKS");
        assertThat(block.path("questions").valueStream().map(q -> q.path("label").asString()).toList())
                .containsExactly("Q1(i)", "Q1(ii)", "Q2(a)(i)", "Q2(a)(ii)");
        assertThat(block.path("questions").get(2).path("coCodes").get(0).asString()).isEqualTo("CO2");
        assertThat(wb.path("poPso").path("matrix").get(0).path("correlations").path("PO1").asInt()).isEqualTo(3);
        assertThat(wb.path("data").path("studentCount").asInt()).isEqualTo(30);
        mvc.perform(call(post("/api/v1/assessments/" + ise1 + "/question-paper/reopen"), "{\"version\":99}"))
                .andExpect(status().isConflict());
    }

    @Test
    void anotherFacultyMemberCannotOpenTheCourse() throws Exception {
        String id = JsonPath.read(body(call(get("/api/v1/me/dashboard"), null)), "$.data.offerings[0].offeringId");
        String other = login("coordinator@wit.edu");
        mvc.perform(get("/api/v1/offerings/" + id).header("Authorization", "Bearer " + other))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
        mvc.perform(get("/api/v1/offerings/" + id)).andExpect(status().isUnauthorized());
    }

    /* -------------------------------- helpers -------------------------------- */

    private String login(String email) throws Exception {
        String res = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + email + "\",\"password\":\"test-pass-123\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(res, "$.data.accessToken");
    }

    private MockHttpServletRequestBuilder call(MockHttpServletRequestBuilder req, String body) {
        req.header("Authorization", "Bearer " + token);
        return body == null ? req : req.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private String body(MockHttpServletRequestBuilder req) throws Exception {
        return mvc.perform(req).andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString();
    }

    private JsonNode data(MockHttpServletRequestBuilder req) throws Exception {
        return json.readTree(body(req)).path("data");
    }
}
