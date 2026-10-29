
package com.copo.attainment_engine.obe;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "course_outcomes")
@CompoundIndex(
        name = "course_co_code_unique",
        def = "{'courseId': 1, 'coCode': 1}",
        unique = true
)
public class CourseOutcome {

    @Id
    private String id;

    private String courseId;
    private String coCode;
    private String description;
    private Integer bloomLevel;

    private Instant createdAt;
    private Instant updatedAt;

    public CourseOutcome() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCourseId() {
        return courseId;
    }

    public void setCourseId(String courseId) {
        this.courseId = courseId;
    }

    public String getCoCode() {
        return coCode;
    }

    public void setCoCode(String coCode) {
        this.coCode = coCode;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getBloomLevel() {
        return bloomLevel;
    }

    public void setBloomLevel(Integer bloomLevel) {
        this.bloomLevel = bloomLevel;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
