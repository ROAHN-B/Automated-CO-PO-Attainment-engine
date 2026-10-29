package com.copo.attainment_engine.workspace;

import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.workspace.OfferingService.Dashboard;
import com.copo.attainment_engine.workspace.OfferingService.OfferingView;
import com.copo.attainment_engine.workspace.OfferingService.PlanUpdate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** API_CONTRACT §7 (FAC-1 to FAC-4) and §8 (PLAN-1 to PLAN-3) for the signed-in faculty member. */
@RestController
@RequestMapping("/api/v1")
public class OfferingController {

    public record VersionBody(Integer version) {}

    private final OfferingService offerings;

    public OfferingController(OfferingService offerings) {
        this.offerings = offerings;
    }

    @GetMapping("/me/offerings")
    public ApiResponse<List<OfferingView>> mine() {
        return ApiResponse.success(offerings.mine());
    }

    @GetMapping("/me/dashboard")
    public ApiResponse<Dashboard> dashboard() {
        return ApiResponse.success(offerings.dashboard());
    }

    @GetMapping("/offerings/{offeringId}")
    public ApiResponse<OfferingView> offering(@PathVariable String offeringId) {
        return ApiResponse.success(offerings.get(offeringId));
    }

    @PostMapping("/offerings/{offeringId}/accept")
    public ApiResponse<OfferingView> accept(@PathVariable String offeringId) {
        return ApiResponse.success(offerings.accept(offeringId));
    }

    @GetMapping("/offerings/{offeringId}/assessment-plan")
    public ApiResponse<AssessmentPlan> plan(@PathVariable String offeringId) {
        return ApiResponse.success(offerings.plan(offeringId));
    }

    @PutMapping("/offerings/{offeringId}/assessment-plan")
    public ApiResponse<AssessmentPlan> savePlan(@PathVariable String offeringId, @RequestBody PlanUpdate body) {
        return ApiResponse.success(offerings.savePlan(offeringId, body));
    }

    @PostMapping("/offerings/{offeringId}/assessment-plan/finalize")
    public ApiResponse<AssessmentPlan> finalizePlan(@PathVariable String offeringId, @RequestBody VersionBody body) {
        return ApiResponse.success(offerings.finalizePlan(offeringId, body.version()));
    }
}
