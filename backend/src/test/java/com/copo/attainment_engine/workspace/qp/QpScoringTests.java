package com.copo.attainment_engine.workspace.qp;

import com.copo.attainment_engine.workspace.cam.CamDocs;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class QpScoringTests {

    private final JsonMapper json = JsonMapper.builder().build();

    private static QpDocs.Paper paper() {
        QpDocs.SubQuestion i = new QpDocs.SubQuestion();
        i.label = "i";
        i.text = "Explain the OSI security architecture.";
        i.type = "DESCRIPTIVE";
        i.marks = 15;
        i.expectedBloomLevel = "UNDERSTAND";
        QpDocs.Question q = new QpDocs.Question();
        q.questionNo = "Q1";
        q.coId = "co-1";
        q.subQuestions = List.of(i);
        QpDocs.Paper p = new QpDocs.Paper();
        p.assessmentId = "as-1";
        p.coIds = List.of("co-1");
        p.questions = List.of(q);
        p.version = 3;
        return p;
    }

    private static List<CamDocs.CourseOutcome> cos() {
        return List.of(CamDocs.CourseOutcome.of("co-1", "CO1", "Explain security."));
    }

    @Test
    void acceptsTheLabelRepeatedAsPartLabelOnAQuestionWithoutParts() {
        var answer = json.readTree("""
                {"modelUsed":"m","subQuestions":[{"questionNo":"Q1","partLabel":"i","label":"i",
                 "coAlignment":"ALIGNED","detectedBloomLevel":"UNDERSTAND","aiAnalysis":"ok"}]}""");
        QpDocs.Result r = QpService.score(paper(), cos(), answer);
        assertThat(r).isNotNull();
        assertThat(r.subQuestions.getFirst().validationScore).isEqualTo(100);
    }

    @Test
    void rejectsAnAnswerForAnotherSubQuestion() {
        var answer = json.readTree("""
                {"modelUsed":"m","subQuestions":[{"questionNo":"Q1","label":"ii",
                 "coAlignment":"ALIGNED","detectedBloomLevel":"UNDERSTAND","aiAnalysis":"ok"}]}""");
        assertThat(QpService.score(paper(), cos(), answer)).isNull();
    }
}
