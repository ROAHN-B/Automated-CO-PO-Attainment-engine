package com.copo.attainment_engine.workspace.marksheet;

import com.copo.attainment_engine.common.files.FileService;
import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.workspace.OfferingController.VersionBody;
import com.copo.attainment_engine.workspace.marksheet.MarksheetService.StructureView;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** API_CONTRACT §12: MS-1, MS-3 and MS-4. */
@RestController
@RequestMapping("/api/v1/assessments/{assessmentId}")
public class MarksheetController {

    private final MarksheetService marksheets;

    public MarksheetController(MarksheetService marksheets) {
        this.marksheets = marksheets;
    }

    @GetMapping("/structure")
    public ApiResponse<StructureView> structure(@PathVariable String assessmentId) {
        return ApiResponse.success(marksheets.structure(assessmentId));
    }

    @PostMapping("/structure/finalize")
    public ApiResponse<StructureView> finalize(@PathVariable String assessmentId, @RequestBody VersionBody body) {
        return ApiResponse.success(marksheets.finalize(assessmentId, body.version()));
    }

    @PostMapping("/marksheet-template")
    public ApiResponse<FileService.ExportFile> template(@PathVariable String assessmentId) {
        return ApiResponse.success(marksheets.template(assessmentId));
    }
}
