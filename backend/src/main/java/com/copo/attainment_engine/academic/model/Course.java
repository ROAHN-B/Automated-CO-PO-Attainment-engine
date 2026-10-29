
package com.copo.attainment_engine.academic.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;

import java.time.Instant;

@Document(collection = "courses")
@CompoundIndex(
        name = "semester_course_code_unique",
        def = "{'semesterId': 1, 'courseCode': 1}",
        unique = true
)
public class Course {

    @Id
    private String id;

    private String semesterId;
    private String courseCode;
    private String courseName;
    private String courseType;
    private Integer credits;
    private String status = "ACTIVE";

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public Course() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSemesterId() { return semesterId; }
    public void setSemesterId(String semesterId) {
        this.semesterId = semesterId;
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

    public Integer getCredits() { return credits; }
    public void setCredits(Integer credits) {
        this.credits = credits;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
