
package com.copo.attainment_engine.academic.repository;

import com.copo.attainment_engine.academic.model.Course;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CourseRepository extends MongoRepository<Course, String> {

    List<Course> findBySemesterId(String semesterId);

    List<Course> findBySemesterIdAndStatus(
            String semesterId,
            String status
    );

    Optional<Course> findBySemesterIdAndCourseCode(
            String semesterId,
            String courseCode
    );

    boolean existsBySemesterIdAndCourseCode(
            String semesterId,
            String courseCode
    );
}
