
package com.copo.attainment_engine.academic.repository;

import com.copo.attainment_engine.academic.model.ProgramYear;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProgramYearRepository
        extends MongoRepository<ProgramYear, String> {

    boolean existsBySyllabusIdAndYearNumber(
            String syllabusId, Integer yearNumber);
}
