package com.copo.attainment_engine.academic.service;

import com.copo.attainment_engine.academic.model.Department;
import com.copo.attainment_engine.academic.repository.DepartmentRepository;
import com.copo.attainment_engine.academic.repository.InstitutionRepository;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
@Service
public class DepartmentService {

    private final DepartmentRepository repository;
    private final InstitutionRepository institutionRepository;

    public DepartmentService(
            DepartmentRepository repository,
            InstitutionRepository institutionRepository) {

        this.repository = repository;
        this.institutionRepository = institutionRepository;
    }

    public Department saveDepartment(Department department) {

        // Check whether institution exists
        if (!institutionRepository.existsById(department.getInstitutionId())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Institution not found"
            );
        }

        // Check duplicate department code within institution
        if (repository.existsByInstitutionIdAndDepartmentCode(
                department.getInstitutionId(),
                department.getDepartmentCode())) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Department code already exists in this institution"
            );
        }

        department.setStatus("ACTIVE");

        return repository.save(department);
    }
    public List<Department> getAllDepartments() {
        return repository.findAll();
    }

    public Department getDepartmentById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Department not found: " + id
                ));
    }
    public Department updateDepartment(String id, Department updated) {

        Department existing = getDepartmentById(id);

        if (!existing.getDepartmentCode().equals(updated.getDepartmentCode())
                && repository.existsByInstitutionIdAndDepartmentCode(
                existing.getInstitutionId(),
                updated.getDepartmentCode())) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Department code already exists in this institution"
            );
        }

        existing.setDepartmentCode(updated.getDepartmentCode());
        existing.setDepartmentName(updated.getDepartmentName());

        return repository.save(existing);
    }
    public Department deactivateDepartment(String id) {

        Department department = getDepartmentById(id);

        department.setStatus("INACTIVE");

        return repository.save(department);
    }
    public Department reactivateDepartment(String id) {

        Department department = getDepartmentById(id);

        department.setStatus("ACTIVE");

        return repository.save(department);
    }

}