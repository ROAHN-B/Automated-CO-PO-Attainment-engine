
package com.copo.attainment_engine.academic.repository;

import com.copo.attainment_engine.academic.model.Syllabus;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SyllabusRepository
        extends MongoRepository<Syllabus, String> {

    boolean existsByProgramIdAndSchemeCodeAndSyllabusScope(
            String programId,
            String schemeCode,
            String syllabusScope
    );

    boolean existsByInstitutionIdAndSchemeCodeAndSyllabusScope(
            String institutionId,
            String schemeCode,
            String syllabusScope
    );
}
