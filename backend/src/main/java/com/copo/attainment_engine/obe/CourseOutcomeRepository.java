
package com.copo.attainment_engine.obe;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface CourseOutcomeRepository
        extends MongoRepository<CourseOutcome, String> {

    List<CourseOutcome> findByCourseIdOrderByCoCodeAsc(String courseId);

    Optional<CourseOutcome> findByCourseIdAndCoCode(
            String courseId,
            String coCode
    );

    boolean existsByCourseIdAndCoCode(
            String courseId,
            String coCode
    );
}
