package com.copo.attainment_engine.academic.service;

import com.copo.attainment_engine.academic.model.Program;
import com.copo.attainment_engine.academic.repository.ProgramRepository;
import com.copo.attainment_engine.academic.repository.DepartmentRepository;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProgramService {

    private final ProgramRepository repository;
    private final DepartmentRepository departmentRepository;

    public ProgramService(
            ProgramRepository repository,
            DepartmentRepository departmentRepository) {

        this.repository = repository;
        this.departmentRepository = departmentRepository;
    }

    public Program saveProgram(Program program) {

        if (!departmentRepository.existsById(program.getDepartmentId())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Department not found"
            );
        }

        if (repository.existsByDepartmentIdAndProgramCode(
                program.getDepartmentId(),
                program.getProgramCode())) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Program code already exists in this department"
            );
        }

        program.setStatus("ACTIVE");

        return repository.save(program);
    }

    public List<Program> getAllPrograms() {
        return repository.findAll();
    }
    public Program getProgramById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Program not found"
                ));
    }
    public Program updateProgram(String id, Program updatedProgram) {

        Program existingProgram = getProgramById(id);

        if (!existingProgram.getProgramCode()
                .equals(updatedProgram.getProgramCode())) {

            if (repository.existsByDepartmentIdAndProgramCode(
                    existingProgram.getDepartmentId(),
                    updatedProgram.getProgramCode())) {

                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Program code already exists in this department"
                );
            }
        }

        existingProgram.setProgramCode(updatedProgram.getProgramCode());
        existingProgram.setProgramName(updatedProgram.getProgramName());
        existingProgram.setProgramLevel(updatedProgram.getProgramLevel());

        return repository.save(existingProgram);
    }
    public Program deactivateProgram(String id) {

        Program program = getProgramById(id);

        program.setStatus("INACTIVE");

        return repository.save(program);
    }
    public Program reactivateProgram(String id) {

        Program program = getProgramById(id);

        program.setStatus("ACTIVE");

        return repository.save(program);
    }
}