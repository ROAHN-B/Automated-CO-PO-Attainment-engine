
package com.copo.attainment_engine.academic.repository;

import com.copo.attainment_engine.academic.model.Semester;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SemesterRepository
        extends MongoRepository<Semester, String> {

    List<Semester> findByProgramYearId(String programYearId);

    Optional<Semester> findByProgramYearIdAndSemesterNumber(
            String programYearId,
            Integer semesterNumber
    );

    boolean existsByProgramYearIdAndSemesterNumber(
            String programYearId,
            Integer semesterNumber
    );
}
