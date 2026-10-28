
package com.copo.attainment_engine.faculty.dto;

import java.util.List;

public class FacultyDashboardResponse {

    private String facultyId;
    private String academicYear;

    private int totalAssignedCourses;
    private int theoryCourses;
    private int practicalCourses;

    private List<FacultyOfferingResponse> offerings;

    public FacultyDashboardResponse() {}

    public String getFacultyId() {
        return facultyId;
    }

    public void setFacultyId(String facultyId) {
        this.facultyId = facultyId;
    }

    public String getAcademicYear() {
        return academicYear;
    }

    public void setAcademicYear(String academicYear) {
        this.academicYear = academicYear;
    }

    public int getTotalAssignedCourses() {
        return totalAssignedCourses;
    }

    public void setTotalAssignedCourses(int totalAssignedCourses) {
        this.totalAssignedCourses = totalAssignedCourses;
    }

    public int getTheoryCourses() {
        return theoryCourses;
    }

    public void setTheoryCourses(int theoryCourses) {
        this.theoryCourses = theoryCourses;
    }

    public int getPracticalCourses() {
        return practicalCourses;
    }

    public void setPracticalCourses(int practicalCourses) {
        this.practicalCourses = practicalCourses;
    }

    public List<FacultyOfferingResponse> getOfferings() {
        return offerings;
    }

    public void setOfferings(List<FacultyOfferingResponse> offerings) {
        this.offerings = offerings;
    }
}
