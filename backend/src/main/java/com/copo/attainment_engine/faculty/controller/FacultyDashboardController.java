
package com.copo.attainment_engine.faculty.controller;

import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.faculty.dto.FacultyDashboardResponse;
import com.copo.attainment_engine.faculty.service.FacultyDashboardService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/faculty")
public class FacultyDashboardController {

    private final FacultyDashboardService dashboardService;

    public FacultyDashboardController(
            FacultyDashboardService dashboardService
    ) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/{facultyId}/dashboard")
    public ResponseEntity<ApiResponse<FacultyDashboardResponse>> getDashboard(
            @PathVariable String facultyId,
            @RequestParam(required = false) String academicYear
    ) {
        FacultyDashboardResponse dashboard =
                dashboardService.getDashboard(facultyId, academicYear);

        return ResponseEntity.ok(
                ApiResponse.success(dashboard)
        );
    }
}
