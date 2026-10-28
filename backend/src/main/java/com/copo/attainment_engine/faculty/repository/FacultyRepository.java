
package com.copo.attainment_engine.faculty.repository;

import com.copo.attainment_engine.faculty.model.Faculty;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface FacultyRepository extends MongoRepository<Faculty, String> {

    Optional<Faculty> findByInstitutionIdAndFacultyCode(
            String institutionId,
            String facultyCode
    );

    boolean existsByInstitutionIdAndFacultyCode(
            String institutionId,
            String facultyCode
    );

    List<Faculty> findByInstitutionId(String institutionId);

    List<Faculty> findByDepartmentId(String departmentId);

    List<Faculty> findByDepartmentIdAndStatus(
            String departmentId,
            String status
    );

    Optional<Faculty> findByInstitutionIdAndEmailIgnoreCase(
            String institutionId,
            String email
    );
}
