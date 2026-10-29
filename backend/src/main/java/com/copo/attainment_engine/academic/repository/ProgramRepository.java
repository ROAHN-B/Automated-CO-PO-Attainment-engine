package com.copo.attainment_engine.academic.repository;

import com.copo.attainment_engine.academic.model.Program;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProgramRepository extends MongoRepository<Program, String> {

    boolean existsByDepartmentIdAndProgramCode(
            String departmentId,
            String programCode
    );
}