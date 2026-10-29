
package com.copo.attainment_engine.faculty.controller;

import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.faculty.dto.FacultyCourseAssignmentRequest;
import com.copo.attainment_engine.faculty.dto.FacultyCourseAssignmentResponse;
import com.copo.attainment_engine.faculty.service.FacultyCourseAssignmentService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/faculty-course-assignments")
public class FacultyCourseAssignmentController {

    private final FacultyCourseAssignmentService assignmentService;

    public FacultyCourseAssignmentController(
            FacultyCourseAssignmentService assignmentService
    ) {
        this.assignmentService = assignmentService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<FacultyCourseAssignmentResponse>> assignCourse(
            @Valid @RequestBody FacultyCourseAssignmentRequest request
    ) {
        FacultyCourseAssignmentResponse response =
                assignmentService.assignCourse(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        response,
                        "Faculty assigned successfully"
                ));
    }

    @GetMapping("/faculty/{facultyId}")
    public ResponseEntity<ApiResponse<List<FacultyCourseAssignmentResponse>>>
    getFacultyAssignments(
            @PathVariable String facultyId,
            @RequestParam(required = false) String academicYear
    ) {
        List<FacultyCourseAssignmentResponse> assignments;

        if (academicYear != null && !academicYear.isBlank()) {
            assignments = assignmentService.getByFacultyAndYear(
                    facultyId, academicYear
            );
        } else {
            assignments = assignmentService.getByFaculty(facultyId);
        }

        return ResponseEntity.ok(
                ApiResponse.success(assignments)
        );
    }
}
