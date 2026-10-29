
package com.copo.attainment_engine.academic.service;

import com.copo.attainment_engine.academic.dto.CourseRequest;
import com.copo.attainment_engine.academic.model.Course;
import com.copo.attainment_engine.academic.model.Semester;
import com.copo.attainment_engine.academic.repository.CourseRepository;
import com.copo.attainment_engine.academic.repository.SemesterRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class CourseService {

    private final CourseRepository courseRepository;
    private final SemesterRepository semesterRepository;

    public CourseService(
            CourseRepository courseRepository,
            SemesterRepository semesterRepository
    ) {
        this.courseRepository = courseRepository;
        this.semesterRepository = semesterRepository;
    }

    public Course createCourse(CourseRequest request) {

        String semesterId = request.getSemesterId().trim();
        String courseCode = request.getCourseCode().trim().toUpperCase();
        String courseName = request.getCourseName().trim();
        String courseType = request.getCourseType().trim();

        Semester semester = semesterRepository.findById(semesterId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Semester not found"
                ));

        if (!"ACTIVE".equalsIgnoreCase(semester.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Semester is not active"
            );
        }

        if (courseRepository.existsBySemesterIdAndCourseCode(
                semesterId, courseCode)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Course code already exists in this semester"
            );
        }

        Course course = new Course();
        course.setSemesterId(semesterId);
        course.setCourseCode(courseCode);
        course.setCourseName(courseName);
        course.setCourseType(courseType);
        course.setCredits(request.getCredits());
        course.setStatus("ACTIVE");

        return courseRepository.save(course);
    }

    public List<Course> getCoursesBySemester(String semesterId) {

        if (!semesterRepository.existsById(semesterId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Semester not found"
            );
        }

        return courseRepository.findBySemesterId(semesterId);
    }
}
