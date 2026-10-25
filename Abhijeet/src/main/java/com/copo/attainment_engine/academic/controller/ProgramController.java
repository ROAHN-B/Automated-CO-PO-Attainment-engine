
package com.copo.attainment_engine.academic.controller;

import com.copo.attainment_engine.academic.model.Program;
import com.copo.attainment_engine.academic.service.ProgramService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/programs")
public class ProgramController {

    private final ProgramService programService;

    public ProgramController(ProgramService programService) {
        this.programService = programService;
    }

    // CREATE PROGRAM
    @PostMapping
    public ResponseEntity<Program> createProgram(
            @RequestBody Program program
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(programService.saveProgram(program));
    }

    // GET ALL PROGRAMS
    @GetMapping
    public ResponseEntity<List<Program>> getAllPrograms() {
        return ResponseEntity.ok(
                programService.getAllPrograms()
        );
    }

    // GET PROGRAM BY ID
    @GetMapping("/{id}")
    public ResponseEntity<Program> getProgramById(
            @PathVariable String id
    ) {
        return ResponseEntity.ok(
                programService.getProgramById(id)
        );
    }

    // UPDATE PROGRAM
    @PutMapping("/{id}")
    public ResponseEntity<Program> updateProgram(
            @PathVariable String id,
            @RequestBody Program program
    ) {
        return ResponseEntity.ok(
                programService.updateProgram(id, program)
        );
    }

    // DEACTIVATE PROGRAM
    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<Program> deactivateProgram(
            @PathVariable String id
    ) {
        return ResponseEntity.ok(
                programService.deactivateProgram(id)
        );
    }

    // REACTIVATE PROGRAM
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<Program> reactivateProgram(
            @PathVariable String id
    ) {
        return ResponseEntity.ok(
                programService.reactivateProgram(id)
        );
    }
}
