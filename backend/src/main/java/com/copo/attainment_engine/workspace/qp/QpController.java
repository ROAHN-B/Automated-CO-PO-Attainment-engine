package com.copo.attainment_engine.workspace.qp;

import com.copo.attainment_engine.common.files.FileService;
import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.workspace.OfferingController.VersionBody;
import com.copo.attainment_engine.workspace.qp.QpService.PaperUpdate;
import com.copo.attainment_engine.workspace.qp.QpService.PaperView;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** API_CONTRACT §10: QPV-1 to QPV-8. */
@RestController
@RequestMapping("/api/v1")
public class QpController {

    public record FormatBody(String format) {}

    private final QpService papers;

    public QpController(QpService papers) {
        this.papers = papers;
    }

    @GetMapping("/assessments/{assessmentId}/question-paper")
    public ApiResponse<PaperView> paper(@PathVariable String assessmentId) {
        return ApiResponse.success(papers.paper(assessmentId));
    }

    @PutMapping("/assessments/{assessmentId}/question-paper")
    public ApiResponse<PaperView> save(@PathVariable String assessmentId, @RequestBody PaperUpdate body) {
        return ApiResponse.success(papers.save(assessmentId, body));
    }

    @PostMapping("/assessments/{assessmentId}/question-paper/validate")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ApiResponse<PaperView> validate(@PathVariable String assessmentId, @RequestBody VersionBody body) {
        return ApiResponse.success(papers.validate(assessmentId, body.version()));
    }

    @GetMapping("/assessments/{assessmentId}/question-paper/result")
    public ApiResponse<QpDocs.Result> result(@PathVariable String assessmentId) {
        return ApiResponse.success(papers.result(assessmentId));
    }

    @PostMapping("/assessments/{assessmentId}/question-paper/moderation-sheet")
    public ApiResponse<FileService.ExportFile> moderationSheet(@PathVariable String assessmentId, @RequestBody FormatBody body) {
        return ApiResponse.success(papers.moderationSheet(assessmentId, body.format()));
    }

    @PostMapping("/assessments/{assessmentId}/question-paper/finalize")
    public ApiResponse<PaperView> confirm(@PathVariable String assessmentId, @RequestBody VersionBody body) {
        return ApiResponse.success(papers.confirm(assessmentId, body.version()));
    }

    @PostMapping("/assessments/{assessmentId}/question-paper/reopen")
    public ApiResponse<PaperView> reopen(@PathVariable String assessmentId, @RequestBody VersionBody body) {
        return ApiResponse.success(papers.reopen(assessmentId, body.version()));
    }

    /** QPV-7: the Bloom keyword map sent to the AI. */
    @GetMapping("/bloom-keywords/defaults")
    public ApiResponse<Map<String, List<String>>> bloomKeywords() {
        return ApiResponse.success(PaperRules.BLOOM_KEYWORDS);
    }
}
