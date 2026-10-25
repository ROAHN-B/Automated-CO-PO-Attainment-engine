
package com.copo.attainment_engine.academic.repository;

import com.copo.attainment_engine.academic.model.Institution;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface InstitutionRepository
        extends MongoRepository<Institution, String> {
    boolean existsByInstitutionCode(String institutionCode);

}
