
package com.copo.attainment_engine.academic.service;

import com.copo.attainment_engine.academic.model.ProgramYear;
import com.copo.attainment_engine.academic.model.Syllabus;
import com.copo.attainment_engine.academic.repository.ProgramYearRepository;
import com.copo.attainment_engine.academic.repository.SyllabusRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ProgramYearService {

    private final ProgramYearRepository repository;
    private final SyllabusRepository syllabusRepository;

    public ProgramYearService(
            ProgramYearRepository repository,
            SyllabusRepository syllabusRepository) {
        this.repository = repository;
        this.syllabusRepository = syllabusRepository;
    }

    public ProgramYear saveProgramYear(ProgramYear request) {
        if (request.getSyllabusId() == null ||
                request.getSyllabusId().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Syllabus ID is required");
        }

        Syllabus syllabus = syllabusRepository
                .findById(request.getSyllabusId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Syllabus not found"));

        if (!"ACTIVE".equalsIgnoreCase(syllabus.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Syllabus is inactive");
        }

        Integer number = request.getYearNumber();

        if (number == null || number < 1 || number > 4) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Year must be between 1 and 4");
        }

        if ("FIRST_YEAR".equalsIgnoreCase(syllabus.getSyllabusScope())
                && number != 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "FIRST_YEAR syllabus only supports year 1");
        }

        if ("PROGRAM".equalsIgnoreCase(syllabus.getSyllabusScope())
                && number == 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "PROGRAM syllabus supports years 2 to 4");
        }

        if (repository.existsBySyllabusIdAndYearNumber(
                request.getSyllabusId(), number)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Program year already exists");
        }

        ProgramYear year = new ProgramYear();
        year.setSyllabusId(request.getSyllabusId());
        year.setYearNumber(number);
        year.setYearName(getYearName(number));
        year.setStatus("ACTIVE");

        try {
            return repository.save(year);
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Program year already exists");
        }
    }

    public List<ProgramYear> getAllProgramYears() {
        return repository.findAll();
    }

    public ProgramYear getProgramYearById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Program year not found"));
    }

    public ProgramYear updateProgramYear(
            String id, ProgramYear request) {
        ProgramYear year = getProgramYearById(id);

        if (request.getYearName() == null ||
                request.getYearName().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Year name is required");
        }

        year.setYearName(request.getYearName().trim());
        return repository.save(year);
    }

    public ProgramYear deactivateProgramYear(String id) {
        ProgramYear year = getProgramYearById(id);
        year.setStatus("INACTIVE");
        return repository.save(year);
    }

    public ProgramYear reactivateProgramYear(String id) {
        ProgramYear year = getProgramYearById(id);
        year.setStatus("ACTIVE");
        return repository.save(year);
    }

    private String getYearName(int number) {
        return switch (number) {
            case 1 -> "First Year";
            case 2 -> "Second Year";
            case 3 -> "Third Year";
            case 4 -> "Fourth Year";
            default -> throw new IllegalArgumentException("Invalid year");
        };
    }
}
