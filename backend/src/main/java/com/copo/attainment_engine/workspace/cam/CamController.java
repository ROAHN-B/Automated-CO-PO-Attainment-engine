package com.copo.attainment_engine.workspace.cam;

import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.workspace.OfferingController.VersionBody;
import com.copo.attainment_engine.workspace.cam.CamDocs.Cam;
import com.copo.attainment_engine.workspace.cam.CamService.CamUpdate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

import java.util.List;

/** API_CONTRACT §9, CAM-1 to CAM-6. */
@RestController
@RequestMapping("/api/v1/offerings/{offeringId}/cam")
public class CamController {

    public record CoIdsBody(List<String> coIds) {}

    private final CamService cams;

    public CamController(CamService cams) {
        this.cams = cams;
    }

    @GetMapping
    public ApiResponse<Cam> cam(@PathVariable String offeringId) {
        return ApiResponse.success(cams.cam(offeringId));
    }

    @PutMapping
    public ApiResponse<Cam> save(@PathVariable String offeringId, @RequestBody CamUpdate update) {
        return ApiResponse.success(cams.save(offeringId, update));
    }

    @PostMapping("/unit-mapping/suggestions")
    public ApiResponse<JsonNode> suggestUnits(@PathVariable String offeringId, @RequestBody(required = false) CoIdsBody body) {
        return ApiResponse.success(cams.suggestUnits(offeringId, body == null ? null : body.coIds()));
    }

    @PostMapping("/unit-mapping/confirm")
    public ApiResponse<Cam> confirmUnits(@PathVariable String offeringId, @RequestBody VersionBody body) {
        return ApiResponse.success(cams.confirmUnits(offeringId, body.version()));
    }

    @PostMapping("/suggestions")
    public ApiResponse<JsonNode> suggestCells(@PathVariable String offeringId, @RequestBody(required = false) CoIdsBody body) {
        return ApiResponse.success(cams.suggestCells(offeringId, body == null ? null : body.coIds()));
    }

    @PostMapping("/finalize")
    public ApiResponse<Cam> finalizeCam(@PathVariable String offeringId, @RequestBody VersionBody body) {
        return ApiResponse.success(cams.finalizeCam(offeringId, body.version()));
    }
}
