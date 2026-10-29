
package com.copo.attainment_engine.academic.service;
import com.copo.attainment_engine.academic.model.Institution;
import com.copo.attainment_engine.academic.repository.InstitutionRepository;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service//Spring ko batata hai ki ye service class hai.
public class InstitutionService {

    private final InstitutionRepository institutionRepository;
    //Spring automatically InstitutionRepository ka implementation inject karega.
    //Isko Dependency Injection kehte hain.
    public InstitutionService(InstitutionRepository institutionRepository) {
        this.institutionRepository = institutionRepository;
    }
    //Yahan save() Spring Data MongoDB ka built-in method hai.
    public Institution saveInstitution(Institution institution) {

        if (institutionRepository.existsByInstitutionCode(
                institution.getInstitutionCode())) {


            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Institution code already exists: "
                            + institution.getInstitutionCode()
            );
        }

        return institutionRepository.save(institution);
    }
    public List<Institution> getAllInstitutions() {
        return institutionRepository.findAll();
    }
    public Institution getInstitutionById(String id) {
        return institutionRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Institution not found: " + id));
    }
    public Institution updateInstitution(String id, Institution updated) {
        Institution existing = institutionRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Institution not found: " + id));

        existing.setInstitutionCode(updated.getInstitutionCode());
        existing.setInstitutionName(updated.getInstitutionName());
        existing.setStatus(updated.getStatus());

        return institutionRepository.save(existing);
    }
    public Institution deactivateInstitution(String id) {

        Institution institution = institutionRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Institution not found: " + id));

        institution.setStatus("INACTIVE");

        return institutionRepository.save(institution);
    }
    public Institution reactivateInstitution(String id) {

        Institution institution = institutionRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Institution not found: " + id));

        institution.setStatus("ACTIVE");

        return institutionRepository.save(institution);
    }

}
