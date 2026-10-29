
package com.copo.attainment_engine.academic.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;

import java.time.Instant;

@Document(collection = "program_years")
@CompoundIndex(
        name = "syllabusId_1_yearNumber_1",
        def = "{'syllabusId': 1, 'yearNumber': 1}",
        unique = true
)
public class ProgramYear {

    @Id
    private String id;
    private String syllabusId;
    private Integer yearNumber;
    private String yearName;
    private String status;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSyllabusId() { return syllabusId; }
    public void setSyllabusId(String syllabusId) {
        this.syllabusId = syllabusId;
    }

    public Integer getYearNumber() { return yearNumber; }
    public void setYearNumber(Integer yearNumber) {
        this.yearNumber = yearNumber;
    }

    public String getYearName() { return yearName; }
    public void setYearName(String yearName) {
        this.yearName = yearName;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
