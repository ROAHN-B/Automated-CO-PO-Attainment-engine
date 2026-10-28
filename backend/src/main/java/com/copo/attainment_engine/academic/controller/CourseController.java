
package com.copo.attainment_engine.academic.controller;

import com.copo.attainment_engine.academic.dto.CourseRequest;
import com.copo.attainment_engine.academic.model.Course;
import com.copo.attainment_engine.academic.service.CourseService;
import com.copo.attainment_engine.common.response.ApiResponse;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;

    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Course> createCourse(
            @Valid @RequestBody CourseRequest request
    ) {
        Course course = courseService.createCourse(request);

        return ApiResponse.success(
                course,
                "Course created successfully"
        );
    }

    @GetMapping
    public ApiResponse<List<Course>> getCoursesBySemester(
            @RequestParam String semesterId
    ) {
        List<Course> courses =
                courseService.getCoursesBySemester(semesterId);

        return ApiResponse.success(courses);
    }
}
