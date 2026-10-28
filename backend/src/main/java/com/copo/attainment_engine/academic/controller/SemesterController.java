
package com.copo.attainment_engine.academic.controller;

import com.copo.attainment_engine.academic.model.ProgramYear;
import com.copo.attainment_engine.academic.model.Semester;
import com.copo.attainment_engine.academic.repository.ProgramYearRepository;
import com.copo.attainment_engine.academic.repository.SemesterRepository;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/semesters")
public class SemesterController {

    private final SemesterRepository semesterRepository;
    private final ProgramYearRepository programYearRepository;

    public SemesterController(
            SemesterRepository semesterRepository,
            ProgramYearRepository programYearRepository
    ) {
        this.semesterRepository = semesterRepository;
        this.programYearRepository = programYearRepository;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Semester create(@RequestBody Semester request) {

        if (request.getProgramYearId() == null ||
                request.getProgramYearId().isBlank() ||
                request.getSemesterNumber() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Program year and semester number are required"
            );
        }

        ProgramYear year = programYearRepository
                .findById(request.getProgramYearId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Program year not found"
                ));

        int number = request.getSemesterNumber();

        if (number < 1 || number > 8 ||
                number != year.getYearNumber() * 2 - 1 &&
                        number != year.getYearNumber() * 2) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid semester number for this program year"
            );
        }

        if (semesterRepository
                .existsByProgramYearIdAndSemesterNumber(
                        year.getId(), number)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Semester already exists"
            );
        }

        Semester semester = new Semester();
        semester.setProgramYearId(year.getId());
        semester.setSemesterNumber(number);
        semester.setSemesterName("Semester " + number);
        semester.setStatus("ACTIVE");

        return semesterRepository.save(semester);
    }

    @GetMapping
    public List<Semester> list(
            @RequestParam String programYearId
    ) {
        return semesterRepository.findByProgramYearId(programYearId);
    }
}
