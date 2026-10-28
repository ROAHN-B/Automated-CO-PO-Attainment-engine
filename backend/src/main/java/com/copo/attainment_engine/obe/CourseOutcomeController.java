
package com.copo.attainment_engine.obe;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/v1/course-outcomes")
public class CourseOutcomeController {

    private final CourseOutcomeService service;

    public CourseOutcomeController(CourseOutcomeService service) {
        this.service = service;
    }

    // Fetch all COs for a course
    @GetMapping
    public Map<String, Object> getByCourseId(
            @RequestParam String courseId) {

        List<CourseOutcome> outcomes = service.getByCourseId(courseId);

        return Map.of(
                "success", true,
                "data", outcomes
        );
    }

    // Fetch a single CO
    @GetMapping("/{id}")
    public Map<String, Object> getById(@PathVariable String id) {
        return Map.of(
                "success", true,
                "data", service.getById(id)
        );
    }

    // Create CO
    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @RequestBody CourseOutcome outcome) {

        CourseOutcome saved = service.create(outcome);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of(
                        "success", true,
                        "data", saved
                ));
    }

    // Update CO description and Bloom level
    @PutMapping("/{id}")
    public Map<String, Object> update(
            @PathVariable String id,
            @RequestBody CourseOutcome changes) {

        return Map.of(
                "success", true,
                "data", service.update(id, changes)
        );
    }

    // Delete CO
    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable String id) {
        service.delete(id);

        return Map.of(
                "success", true,
                "message", "Course Outcome deleted successfully"
        );
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(
            NoSuchElementException ex) {

        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of(
                        "success", false,
                        "message", ex.getMessage()
                ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(
            IllegalArgumentException ex) {

        return ResponseEntity.badRequest()
                .body(Map.of(
                        "success", false,
                        "message", ex.getMessage()
                ));
    }
}
