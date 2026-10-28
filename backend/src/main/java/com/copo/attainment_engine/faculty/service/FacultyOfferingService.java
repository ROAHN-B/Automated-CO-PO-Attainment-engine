
package com.copo.attainment_engine.faculty.service;

import com.copo.attainment_engine.academic.model.Course;
import com.copo.attainment_engine.academic.repository.CourseRepository;
import com.copo.attainment_engine.faculty.dto.FacultyOfferingResponse;
import com.copo.attainment_engine.faculty.repository.FacultyRepository;
import com.copo.attainment_engine.faculty.repository.FacultyCourseAssignmentRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class FacultyOfferingService {

    private final FacultyCourseAssignmentRepository assignmentRepository;
    private final FacultyRepository facultyRepository;
    private final CourseRepository courseRepository;

    public FacultyOfferingService(
            FacultyCourseAssignmentRepository assignmentRepository,
            FacultyRepository facultyRepository,
            CourseRepository courseRepository
    ) {
        this.assignmentRepository = assignmentRepository;
        this.facultyRepository = facultyRepository;
        this.courseRepository = courseRepository;
    }

    public List<FacultyOfferingResponse> getFacultyOfferings(
            String facultyId,
            String academicYear
    ) {
        if (!facultyRepository.existsById(facultyId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Faculty not found"
            );
        }

        var assignments = academicYear != null && !academicYear.isBlank()
                ? assignmentRepository.findByFacultyIdAndAcademicYear(
                facultyId, academicYear
        )
                : assignmentRepository.findByFacultyId(facultyId);

        return assignments.stream()
                .filter(a -> "ACTIVE".equalsIgnoreCase(a.getStatus()))
                .map(assignment -> {
                    Course course = courseRepository
                            .findById(assignment.getCourseId())
                            .orElseThrow(() -> new ResponseStatusException(
                                    HttpStatus.NOT_FOUND,
                                    "Assigned course not found"
                            ));

                    FacultyOfferingResponse response =
                            new FacultyOfferingResponse();

                    response.setOfferingId(assignment.getId());
                    response.setFacultyId(assignment.getFacultyId());
                    response.setCourseId(course.getId());
                    response.setCourseCode(course.getCourseCode());
                    response.setCourseName(course.getCourseName());
                    response.setCourseType(course.getCourseType());
                    response.setSemesterId(course.getSemesterId());
                    response.setCredits(course.getCredits());
                    response.setAcademicYear(assignment.getAcademicYear());
                    response.setStatus(assignment.getStatus());

                    return response;
                })
                .toList();
    }

    public FacultyOfferingResponse getOfferingById(String offeringId) {

        var assignment = assignmentRepository.findById(offeringId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Offering not found"
                ));

        Course course = courseRepository
                .findById(assignment.getCourseId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Assigned course not found"
                ));

        FacultyOfferingResponse response = new FacultyOfferingResponse();

        response.setOfferingId(assignment.getId());
        response.setFacultyId(assignment.getFacultyId());
        response.setCourseId(course.getId());
        response.setCourseCode(course.getCourseCode());
        response.setCourseName(course.getCourseName());
        response.setCourseType(course.getCourseType());
        response.setSemesterId(course.getSemesterId());
        response.setCredits(course.getCredits());
        response.setAcademicYear(assignment.getAcademicYear());
        response.setStatus(assignment.getStatus());

        return response;
    }

}
