
package com.copo.attainment_engine.faculty.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class FacultyCourseAssignmentRequest {

    @NotBlank(message = "Faculty ID is required")
    private String facultyId;

    @NotBlank(message = "Course ID is required")
    private String courseId;

    @NotBlank(message = "Academic year is required")
    @Pattern(
            regexp = "^\\d{4}-\\d{2}$",
            message = "Academic year must be in YYYY-YY format"
    )
    private String academicYear;

    public FacultyCourseAssignmentRequest() {
    }

    public String getFacultyId() {
        return facultyId;
    }

    public void setFacultyId(String facultyId) {
        this.facultyId = facultyId;
    }

    public String getCourseId() {
        return courseId;
    }

    public void setCourseId(String courseId) {
        this.courseId = courseId;
    }

    public String getAcademicYear() {
        return academicYear;
    }

    public void setAcademicYear(String academicYear) {
        this.academicYear = academicYear;
    }
}
