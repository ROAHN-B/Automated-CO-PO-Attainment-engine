
package com.copo.attainment_engine.faculty.dto;

public class FacultyOfferingResponse {

    private String offeringId;
    private String facultyId;
    private String courseId;
    private String courseCode;
    private String courseName;
    private String courseType;
    private String semesterId;
    private Integer credits;
    private String academicYear;
    private String status;

    public FacultyOfferingResponse() {}

    public String getOfferingId() { return offeringId; }
    public void setOfferingId(String offeringId) {
        this.offeringId = offeringId;
    }

    public String getFacultyId() { return facultyId; }
    public void setFacultyId(String facultyId) {
        this.facultyId = facultyId;
    }

    public String getCourseId() { return courseId; }
    public void setCourseId(String courseId) {
        this.courseId = courseId;
    }

    public String getCourseCode() { return courseCode; }
    public void setCourseCode(String courseCode) {
        this.courseCode = courseCode;
    }

    public String getCourseName() { return courseName; }
    public void setCourseName(String courseName) {
        this.courseName = courseName;
    }

    public String getCourseType() { return courseType; }
    public void setCourseType(String courseType) {
        this.courseType = courseType;
    }

    public String getSemesterId() { return semesterId; }
    public void setSemesterId(String semesterId) {
        this.semesterId = semesterId;
    }

    public Integer getCredits() { return credits; }
    public void setCredits(Integer credits) {
        this.credits = credits;
    }

    public String getAcademicYear() { return academicYear; }
    public void setAcademicYear(String academicYear) {
        this.academicYear = academicYear;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) {
        this.status = status;
    }
}
