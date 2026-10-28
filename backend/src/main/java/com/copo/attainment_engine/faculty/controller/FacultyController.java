
package com.copo.attainment_engine.faculty.controller;

import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.faculty.dto.FacultyRequest;
import com.copo.attainment_engine.faculty.dto.FacultyResponse;
import com.copo.attainment_engine.faculty.service.FacultyService;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/faculty")
public class FacultyController {

    private final FacultyService facultyService;

    public FacultyController(FacultyService facultyService) {
        this.facultyService = facultyService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<FacultyResponse>> createFaculty(
            @Valid @RequestBody FacultyRequest request
    ) {
        FacultyResponse response = facultyService.createFaculty(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        response,
                        "Faculty created successfully"
                ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<FacultyResponse>> getFacultyById(
            @PathVariable String id
    ) {
        return ResponseEntity.ok(
                ApiResponse.success(facultyService.getFacultyById(id))
        );
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<FacultyResponse>>> getFaculty(
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) String institutionId
    ) {
        List<FacultyResponse> faculty;

        if (departmentId != null && !departmentId.isBlank()) {
            faculty = facultyService.getFacultyByDepartment(departmentId);
        } else if (institutionId != null && !institutionId.isBlank()) {
            faculty = facultyService.getFacultyByInstitution(institutionId);
        } else {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Provide departmentId or institutionId"
            );
        }

        return ResponseEntity.ok(ApiResponse.success(faculty));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<FacultyResponse>> updateFaculty(
            @PathVariable String id,
            @Valid @RequestBody FacultyRequest request
    ) {
        FacultyResponse response =
                facultyService.updateFaculty(id, request);

        return ResponseEntity.ok(
                ApiResponse.success(response, "Faculty updated successfully")
        );
    }
}