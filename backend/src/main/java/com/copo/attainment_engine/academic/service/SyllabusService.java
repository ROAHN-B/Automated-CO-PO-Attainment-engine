
package com.copo.attainment_engine.academic.service;

import com.copo.attainment_engine.academic.model.Syllabus;
import com.copo.attainment_engine.academic.model.Institution;
import com.copo.attainment_engine.academic.model.Department;
import com.copo.attainment_engine.academic.model.Program;

import com.copo.attainment_engine.academic.repository.SyllabusRepository;
import com.copo.attainment_engine.academic.repository.InstitutionRepository;
import com.copo.attainment_engine.academic.repository.DepartmentRepository;
import com.copo.attainment_engine.academic.repository.ProgramRepository;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.DuplicateKeyException;

import java.util.List;

@Service
public class SyllabusService {

    private final SyllabusRepository syllabusRepository;
    private final InstitutionRepository institutionRepository;
    private final DepartmentRepository departmentRepository;
    private final ProgramRepository programRepository;

    public SyllabusService(
            SyllabusRepository syllabusRepository,
            InstitutionRepository institutionRepository,
            DepartmentRepository departmentRepository,
            ProgramRepository programRepository) {

        this.syllabusRepository = syllabusRepository;
        this.institutionRepository = institutionRepository;
        this.departmentRepository = departmentRepository;
        this.programRepository = programRepository;
    }

    public Syllabus saveSyllabus(Syllabus syllabus) {

        // 1. Validate institution
        if (syllabus.getInstitutionId() == null ||
                syllabus.getInstitutionId().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "institutionId is required"
            );
        }

        Institution institution = institutionRepository
                .findById(syllabus.getInstitutionId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Institution not found"
                ));

        // 2. Validate syllabus scope
        String scope = syllabus.getSyllabusScope();

        if ("PROGRAM".equals(scope)) {

            if (syllabus.getProgramId() == null ||
                    syllabus.getProgramId().isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "PROGRAM syllabus requires programId"
                );
            }

            Program program = programRepository
                    .findById(syllabus.getProgramId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Program not found"
                    ));

            Department department = departmentRepository
                    .findById(program.getDepartmentId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Program's department not found"
                    ));

            if (!department.getInstitutionId()
                    .equals(institution.getId())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Program does not belong to this institution"
                );
            }

        } else if ("FIRST_YEAR".equals(scope)) {

            if (syllabus.getProgramId() != null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "FIRST_YEAR syllabus must not have a programId"
                );
            }

        } else {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "syllabusScope must be PROGRAM or FIRST_YEAR"
            );
        }

        // 3. Validate scheme code
        if (syllabus.getSchemeCode() == null ||
                syllabus.getSchemeCode().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "schemeCode is required"
            );
        }

        // 4. Check duplicate syllabus
        if ("PROGRAM".equals(scope)) {

            boolean exists = syllabusRepository
                    .existsByProgramIdAndSchemeCodeAndSyllabusScope(
                            syllabus.getProgramId(),
                            syllabus.getSchemeCode(),
                            "PROGRAM"
                    );

            if (exists) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Syllabus scheme already exists for this program"
                );
            }

        } else if ("FIRST_YEAR".equals(scope)) {

            boolean exists = syllabusRepository
                    .existsByInstitutionIdAndSchemeCodeAndSyllabusScope(
                            syllabus.getInstitutionId(),
                            syllabus.getSchemeCode(),
                            "FIRST_YEAR"
                    );

            if (exists) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "First year syllabus scheme already exists for this institution"
                );
            }
        }

        // 5. Set initial status
        syllabus.setStatus("ACTIVE");

        // 6. Save syllabus
        try {
            return syllabusRepository.save(syllabus);
        } catch (DuplicateKeyException ex) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Syllabus scheme already exists",
                    ex
            );
        }
    }

    public List<Syllabus> getAllSyllabi() {
        return syllabusRepository.findAll();
    }

    public Syllabus getSyllabusById(String id) {
        return syllabusRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Syllabus not found"
                ));
    }

    public Syllabus updateSyllabus(String id, Syllabus request) {

        Syllabus existing = getSyllabusById(id);

        if (request.getSyllabusName() == null ||
                request.getSyllabusName().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Syllabus name is required"
            );
        }

        existing.setSyllabusName(request.getSyllabusName());

        return syllabusRepository.save(existing);
    }

    public Syllabus deactivateSyllabus(String id) {

        Syllabus syllabus = getSyllabusById(id);
        syllabus.setStatus("INACTIVE");

        return syllabusRepository.save(syllabus);
    }

    public Syllabus reactivateSyllabus(String id) {

        Syllabus syllabus = getSyllabusById(id);
        syllabus.setStatus("ACTIVE");

        return syllabusRepository.save(syllabus);
    }
}
