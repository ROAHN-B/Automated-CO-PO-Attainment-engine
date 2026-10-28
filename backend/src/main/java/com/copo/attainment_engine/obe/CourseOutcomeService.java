
package com.copo.attainment_engine.obe;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;

@Service
public class CourseOutcomeService {

    private final CourseOutcomeRepository repository;

    public CourseOutcomeService(CourseOutcomeRepository repository) {
        this.repository = repository;
    }

    public List<CourseOutcome> getByCourseId(String courseId) {
        return repository.findByCourseIdOrderByCoCodeAsc(courseId);
    }

    public CourseOutcome getById(String id) {
        return repository.findById(id)
                .orElseThrow(() ->
                        new NoSuchElementException("Course Outcome not found: " + id));
    }

    public CourseOutcome create(CourseOutcome outcome) {
        validate(outcome);

        if (repository.existsByCourseIdAndCoCode(
                outcome.getCourseId(), outcome.getCoCode())) {
            throw new IllegalArgumentException(
                    "CO code already exists for this course");
        }

        outcome.setId(null);
        outcome.setCreatedAt(Instant.now());
        outcome.setUpdatedAt(Instant.now());

        return repository.save(outcome);
    }

    public CourseOutcome update(String id, CourseOutcome changes) {
        CourseOutcome existing = getById(id);

        if (changes.getDescription() != null) {
            existing.setDescription(changes.getDescription());
        }

        if (changes.getBloomLevel() != null) {
            existing.setBloomLevel(changes.getBloomLevel());
        }

        validate(existing);

        existing.setUpdatedAt(Instant.now());

        return repository.save(existing);
    }

    public void delete(String id) {
        CourseOutcome existing = getById(id);
        repository.delete(existing);
    }

    private void validate(CourseOutcome outcome) {
        if (outcome.getCourseId() == null ||
                outcome.getCourseId().isBlank()) {
            throw new IllegalArgumentException("Course ID is required");
        }

        if (outcome.getCoCode() == null ||
                !outcome.getCoCode().matches("CO[1-9][0-9]*")) {
            throw new IllegalArgumentException(
                    "CO code must be CO1, CO2, CO3, etc.");
        }

        if (outcome.getDescription() == null ||
                outcome.getDescription().isBlank()) {
            throw new IllegalArgumentException(
                    "CO description is required");
        }

        if (outcome.getBloomLevel() == null ||
                outcome.getBloomLevel() < 1 ||
                outcome.getBloomLevel() > 6) {
            throw new IllegalArgumentException(
                    "Bloom level must be between 1 and 6");
        }
    }
}
