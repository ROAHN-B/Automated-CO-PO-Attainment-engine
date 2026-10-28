
package com.copo.attainment_engine.faculty.service;

import com.copo.attainment_engine.academic.model.Department;
import com.copo.attainment_engine.academic.repository.DepartmentRepository;
import com.copo.attainment_engine.faculty.dto.FacultyRequest;
import com.copo.attainment_engine.faculty.dto.FacultyResponse;
import com.copo.attainment_engine.faculty.model.Faculty;
import com.copo.attainment_engine.faculty.repository.FacultyRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
public class FacultyService {

    private final FacultyRepository facultyRepository;
    private final DepartmentRepository departmentRepository;

    public FacultyService(
            FacultyRepository facultyRepository,
            DepartmentRepository departmentRepository
    ) {
        this.facultyRepository = facultyRepository;
        this.departmentRepository = departmentRepository;
    }

    public FacultyResponse createFaculty(FacultyRequest request) {

        String institutionId = request.getInstitutionId().trim();
        String departmentId = request.getDepartmentId().trim();
        String facultyCode = request.getFacultyCode().trim();
        String email = request.getEmail().trim()
                .toLowerCase(Locale.ROOT);

        validateDepartment(departmentId, institutionId);

        if (facultyRepository.existsByInstitutionIdAndFacultyCode(
                institutionId, facultyCode)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Faculty code already exists in this institution"
            );
        }

        if (facultyRepository.findByInstitutionIdAndEmailIgnoreCase(
                institutionId, email).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Faculty email already exists in this institution"
            );
        }

        Faculty faculty = new Faculty();
        faculty.setInstitutionId(institutionId);
        faculty.setDepartmentId(departmentId);
        faculty.setFacultyCode(facultyCode);
        faculty.setFullName(request.getFullName().trim());
        faculty.setEmail(email);
        faculty.setDesignation(request.getDesignation().trim());
        faculty.setStatus("ACTIVE");

        return toResponse(facultyRepository.save(faculty));
    }

    public FacultyResponse getFacultyById(String id) {
        return toResponse(findFaculty(id));
    }

    public List<FacultyResponse> getFacultyByDepartment(
            String departmentId
    ) {
        return facultyRepository.findByDepartmentId(departmentId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<FacultyResponse> getFacultyByInstitution(
            String institutionId
    ) {
        return facultyRepository.findByInstitutionId(institutionId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public FacultyResponse updateFaculty(
            String id,
            FacultyRequest request
    ) {
        Faculty faculty = findFaculty(id);

        String institutionId = request.getInstitutionId().trim();
        String departmentId = request.getDepartmentId().trim();
        String facultyCode = request.getFacultyCode().trim();
        String email = request.getEmail().trim()
                .toLowerCase(Locale.ROOT);

        // Do not silently move a faculty member
        // into another institution.
        if (!faculty.getInstitutionId().equals(institutionId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Institution cannot be changed"
            );
        }

        validateDepartment(departmentId, institutionId);

        facultyRepository
                .findByInstitutionIdAndFacultyCode(
                        institutionId, facultyCode)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Faculty code already exists"
                    );
                });

        facultyRepository
                .findByInstitutionIdAndEmailIgnoreCase(
                        institutionId, email)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Faculty email already exists"
                    );
                });

        faculty.setDepartmentId(departmentId);
        faculty.setFacultyCode(facultyCode);
        faculty.setFullName(request.getFullName().trim());
        faculty.setEmail(email);
        faculty.setDesignation(request.getDesignation().trim());

        return toResponse(facultyRepository.save(faculty));
    }

    private Faculty findFaculty(String id) {
        return facultyRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Faculty not found"
                ));
    }

    private void validateDepartment(
            String departmentId,
            String institutionId
    ) {
        Department department = departmentRepository
                .findById(departmentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Department not found"
                ));

        if (!institutionId.equals(department.getInstitutionId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Department does not belong to this institution"
            );
        }
    }

    private FacultyResponse toResponse(Faculty faculty) {
        FacultyResponse response = new FacultyResponse();

        response.setId(faculty.getId());
        response.setInstitutionId(faculty.getInstitutionId());
        response.setDepartmentId(faculty.getDepartmentId());
        response.setFacultyCode(faculty.getFacultyCode());
        response.setFullName(faculty.getFullName());
        response.setEmail(faculty.getEmail());
        response.setDesignation(faculty.getDesignation());
        response.setStatus(faculty.getStatus());
        response.setCreatedAt(faculty.getCreatedAt());
        response.setUpdatedAt(faculty.getUpdatedAt());

        return response;
    }
}
