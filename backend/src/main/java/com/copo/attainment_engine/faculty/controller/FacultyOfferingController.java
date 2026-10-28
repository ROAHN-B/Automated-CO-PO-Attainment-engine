
package com.copo.attainment_engine.faculty.controller;

import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.faculty.dto.FacultyOfferingResponse;
import com.copo.attainment_engine.faculty.service.FacultyOfferingService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class FacultyOfferingController {

    private final FacultyOfferingService offeringService;

    public FacultyOfferingController(
            FacultyOfferingService offeringService
    ) {
        this.offeringService = offeringService;
    }

    @GetMapping("/faculty/{facultyId}/offerings")
    public ResponseEntity<ApiResponse<List<FacultyOfferingResponse>>>
    getFacultyOfferings(
            @PathVariable String facultyId,
            @RequestParam(required = false) String academicYear
    ) {
        List<FacultyOfferingResponse> offerings =
                offeringService.getFacultyOfferings(
                        facultyId,
                        academicYear
                );

        return ResponseEntity.ok(
                ApiResponse.success(offerings)
        );
    }

    @GetMapping("/offerings/{offeringId}")
    public ResponseEntity<ApiResponse<FacultyOfferingResponse>> getOfferingById(
            @PathVariable String offeringId
    ) {
        FacultyOfferingResponse offering =
                offeringService.getOfferingById(offeringId);

        return ResponseEntity.ok(
                ApiResponse.success(offering)
        );
    }

}
