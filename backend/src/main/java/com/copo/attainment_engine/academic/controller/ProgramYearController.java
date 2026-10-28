
package com.copo.attainment_engine.academic.controller;

import com.copo.attainment_engine.academic.model.ProgramYear;
import com.copo.attainment_engine.academic.service.ProgramYearService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/program-years")
public class ProgramYearController {

    private final ProgramYearService service;

    public ProgramYearController(ProgramYearService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<ProgramYear> create(
            @RequestBody ProgramYear request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.saveProgramYear(request));
    }

    @GetMapping
    public ResponseEntity<List<ProgramYear>> getAll() {
        return ResponseEntity.ok(service.getAllProgramYears());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProgramYear> getById(
            @PathVariable String id) {
        return ResponseEntity.ok(service.getProgramYearById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProgramYear> update(
            @PathVariable String id,
            @RequestBody ProgramYear request) {
        return ResponseEntity.ok(
                service.updateProgramYear(id, request));
    }

    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<ProgramYear> deactivate(
            @PathVariable String id) {
        return ResponseEntity.ok(
                service.deactivateProgramYear(id));
    }

    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<ProgramYear> reactivate(
            @PathVariable String id) {
        return ResponseEntity.ok(
                service.reactivateProgramYear(id));
    }
}
