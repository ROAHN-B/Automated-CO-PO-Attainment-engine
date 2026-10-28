
package com.copo.attainment_engine.faculty.repository;

import com.copo.attainment_engine.faculty.model.FacultyCourseAssignment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface FacultyCourseAssignmentRepository
        extends MongoRepository<FacultyCourseAssignment, String> {

    List<FacultyCourseAssignment> findByFacultyId(
            String facultyId
    );

    List<FacultyCourseAssignment> findByCourseId(
            String courseId
    );

    List<FacultyCourseAssignment> findByFacultyIdAndAcademicYear(
            String facultyId,
            String academicYear
    );

    List<FacultyCourseAssignment> findByFacultyIdAndStatus(
            String facultyId,
            String status
    );

    Optional<FacultyCourseAssignment>
    findByFacultyIdAndCourseIdAndAcademicYear(
            String facultyId,
            String courseId,
            String academicYear
    );

    boolean existsByFacultyIdAndCourseIdAndAcademicYear(
            String facultyId,
            String courseId,
            String academicYear
    );
}
