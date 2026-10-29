package com.copo.attainment_engine.academic.controller;

import com.copo.attainment_engine.academic.model.Syllabus;
import com.copo.attainment_engine.academic.service.SyllabusService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/syllabi")
public class SyllabusController {

    private final SyllabusService syllabusService;

    public SyllabusController(SyllabusService syllabusService) {
        this.syllabusService = syllabusService;
    }

    @PostMapping
    public ResponseEntity<Syllabus> createSyllabus(
            @RequestBody Syllabus syllabus) {

        Syllabus savedSyllabus =
                syllabusService.saveSyllabus(syllabus);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(savedSyllabus);
    }
    @GetMapping
    public ResponseEntity<List<Syllabus>> getAllSyllabi() {

        List<Syllabus> syllabi = syllabusService.getAllSyllabi();

        return ResponseEntity.ok(syllabi);
    }
    @GetMapping("/{id}")
    public ResponseEntity<Syllabus> getSyllabusById(
            @PathVariable String id) {

        Syllabus syllabus = syllabusService.getSyllabusById(id);

        return ResponseEntity.ok(syllabus);
    }
    @PutMapping("/{id}")
    public ResponseEntity<Syllabus> updateSyllabus(
            @PathVariable String id,
            @RequestBody Syllabus request) {

        Syllabus updatedSyllabus =
                syllabusService.updateSyllabus(id, request);

        return ResponseEntity.ok(updatedSyllabus);
    }
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Syllabus> deactivateSyllabus(
            @PathVariable String id) {

        Syllabus syllabus = syllabusService.deactivateSyllabus(id);

        return ResponseEntity.ok(syllabus);
    }

    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<Syllabus> reactivateSyllabus(
            @PathVariable String id) {

        Syllabus syllabus = syllabusService.reactivateSyllabus(id);

        return ResponseEntity.ok(syllabus);
    }

}