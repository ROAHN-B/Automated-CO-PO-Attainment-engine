package com.copo.attainment_engine.academic.controller;
import java.util.List;
import com.copo.attainment_engine.academic.model.Department;
import com.copo.attainment_engine.academic.service.DepartmentService;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final DepartmentService service;

    public DepartmentController(DepartmentService service) {
        this.service = service;
    }

    @PostMapping
    public Department createDepartment(@RequestBody Department department) {
        return service.saveDepartment(department);
    }

    @GetMapping
    public List<Department> getAllDepartments() {
        return service.getAllDepartments();
    }
    @GetMapping("/{id}")
    public Department getDepartmentById(@PathVariable String id) {
        System.out.print("GET BY ID CALLED: " + id);
        return service.getDepartmentById(id);
    }
    @PutMapping("/{id}")
    public Department updateDepartment(
            @PathVariable String id,
            @RequestBody Department department) {

        return service.updateDepartment(id, department);
    }
    @PatchMapping("/{id}/deactivate")
    public Department deactivateDepartment(@PathVariable String id) {
        return service.deactivateDepartment(id);
    }
    @PatchMapping("/{id}/reactivate")
    public Department reactivateDepartment(@PathVariable String id) {
        return service.reactivateDepartment(id);
    }
}