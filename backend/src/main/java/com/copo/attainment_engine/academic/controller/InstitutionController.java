
package com.copo.attainment_engine.academic.controller;

import com.copo.attainment_engine.academic.model.Institution;
import com.copo.attainment_engine.academic.service.InstitutionService;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController //Class ko REST API controller banata hai
@RequestMapping("/api/institutions")//API ka base URL define karta hai
public class InstitutionController {

    private final InstitutionService institutionService;

    public InstitutionController(InstitutionService institutionService) {
        this.institutionService = institutionService;
    }

    @PostMapping//HTTP POST request handle karta hai
    //@RequestBody:-	JSON request ko Java Institution object mein convert karta hai
    public Institution createInstitution(@RequestBody Institution institution) {
        return institutionService.saveInstitution(institution);
    }
    @GetMapping
    public List<Institution> getAllInstitutions() {
        return institutionService.getAllInstitutions();
    }
    @GetMapping("/{id}")
    public Institution getInstitutionById(@PathVariable String id) {
        return institutionService.getInstitutionById(id);
    }
    @PutMapping("/{id}")
    public Institution updateInstitution(
            @PathVariable String id,
            @RequestBody Institution institution) {

        return institutionService.updateInstitution(id, institution);
    }
    @PatchMapping("/{id}/deactivate")
    public Institution deactivateInstitution(@PathVariable String id) {
        return institutionService.deactivateInstitution(id);
    }
    @PatchMapping("/{id}/reactivate")
    public Institution reactivateInstitution(@PathVariable String id) {
        return institutionService.reactivateInstitution(id);
    }
}
