package com.copo.attainment_engine.academic.repository;

import com.copo.attainment_engine.academic.model.Department;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface DepartmentRepository
        extends MongoRepository<Department, String> {

    boolean existsByInstitutionIdAndDepartmentCode(
            String institutionId,
            String departmentCode
    );
}