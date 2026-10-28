
package com.copo.attainment_engine.faculty.service;

import com.copo.attainment_engine.academic.repository.CourseRepository;
import com.copo.attainment_engine.faculty.dto.FacultyCourseAssignmentRequest;
import com.copo.attainment_engine.faculty.dto.FacultyCourseAssignmentResponse;
import com.copo.attainment_engine.faculty.model.FacultyCourseAssignment;
import com.copo.attainment_engine.faculty.repository.FacultyCourseAssignmentRepository;
import com.copo.attainment_engine.faculty.repository.FacultyRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class FacultyCourseAssignmentService {

    private final FacultyCourseAssignmentRepository assignmentRepository;
    private final FacultyRepository facultyRepository;
    private final CourseRepository courseRepository;

    public FacultyCourseAssignmentService(
            FacultyCourseAssignmentRepository assignmentRepository,
            FacultyRepository facultyRepository,
            CourseRepository courseRepository
    ) {
        this.assignmentRepository = assignmentRepository;
        this.facultyRepository = facultyRepository;
        this.courseRepository = courseRepository;
    }

    public FacultyCourseAssignmentResponse assignCourse(
            FacultyCourseAssignmentRequest request
    ) {
        String facultyId = request.getFacultyId().trim();
        String courseId = request.getCourseId().trim();
        String academicYear = request.getAcademicYear().trim();

        var faculty = facultyRepository.findById(facultyId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Faculty not found"
                ));

        var course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Course not found"
                ));

        if (!"ACTIVE".equalsIgnoreCase(faculty.getStatus())
                || !"ACTIVE".equalsIgnoreCase(course.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Faculty and Course must be ACTIVE"
            );
        }

        if (assignmentRepository
                .existsByFacultyIdAndCourseIdAndAcademicYear(
                        facultyId, courseId, academicYear)) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Course already assigned to this faculty for this academic year"
            );
        }

        FacultyCourseAssignment assignment =
                new FacultyCourseAssignment();

        assignment.setFacultyId(facultyId);
        assignment.setCourseId(courseId);
        assignment.setAcademicYear(academicYear);
        assignment.setStatus("ACTIVE");

        return toResponse(assignmentRepository.save(assignment));
    }

    public List<FacultyCourseAssignmentResponse> getByFaculty(
            String facultyId
    ) {
        if (!facultyRepository.existsById(facultyId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Faculty not found"
            );
        }

        return assignmentRepository.findByFacultyId(facultyId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<FacultyCourseAssignmentResponse> getByFacultyAndYear(
            String facultyId,
            String academicYear
    ) {
        if (!facultyRepository.existsById(facultyId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Faculty not found"
            );
        }

        return assignmentRepository
                .findByFacultyIdAndAcademicYear(facultyId, academicYear)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private FacultyCourseAssignmentResponse toResponse(
            FacultyCourseAssignment assignment
    ) {
        FacultyCourseAssignmentResponse response =
                new FacultyCourseAssignmentResponse();

        response.setId(assignment.getId());
        response.setFacultyId(assignment.getFacultyId());
        response.setCourseId(assignment.getCourseId());
        response.setAcademicYear(assignment.getAcademicYear());
        response.setStatus(assignment.getStatus());
        response.setCreatedAt(assignment.getCreatedAt());
        response.setUpdatedAt(assignment.getUpdatedAt());

        return response;
    }
}
