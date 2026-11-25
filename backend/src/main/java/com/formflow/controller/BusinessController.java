package com.formflow.controller;

import com.formflow.dto.WorkspaceDtos.FormFieldRequest;
import com.formflow.service.BusinessService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/businesses")
public class BusinessController {

    private final BusinessService businessService;

    public BusinessController(BusinessService businessService) {
        this.businessService = businessService;
    }

    private Long currentUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        return userId;
    }

    @GetMapping
    public Map<String, Object> listBusinesses(Authentication auth) {
        return businessService.listBusinesses(currentUserId(auth));
    }

    @GetMapping("/recycle-bin")
    public Map<String, Object> listDeletedBusinesses(Authentication auth) {
        return businessService.listDeletedBusinesses(currentUserId(auth));
    }

    @GetMapping("/{id}")
    public Map<String, Object> getBusinessById(Authentication auth, @PathVariable Long id) {
        return businessService.getBusinessById(currentUserId(auth), id);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createBusiness(
            Authentication auth,
            @RequestBody Map<String, Object> body
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(businessService.createBusiness(currentUserId(auth), body));
    }

    @PutMapping("/{id}")
    public Map<String, Object> updateBusiness(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        return businessService.updateBusiness(currentUserId(auth), id, body);
    }

    @PostMapping("/{id}/archive")
    public Map<String, Object> archiveBusiness(Authentication auth, @PathVariable Long id) {
        return businessService.archiveBusiness(currentUserId(auth), id);
    }

    @PostMapping("/{id}/activate")
    public Map<String, Object> activateBusiness(Authentication auth, @PathVariable Long id) {
        return businessService.activateBusiness(currentUserId(auth), id);
    }

    @PostMapping("/{id}/restore")
    public Map<String, Object> restoreBusiness(Authentication auth, @PathVariable Long id) {
        return businessService.restoreBusiness(currentUserId(auth), id);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> deleteBusiness(Authentication auth, @PathVariable Long id) {
        return businessService.softDeleteBusiness(currentUserId(auth), id);
    }

    @DeleteMapping("/{id}/permanent")
    public Map<String, String> permanentDeleteBusiness(Authentication auth, @PathVariable Long id) {
        return businessService.permanentDeleteBusiness(currentUserId(auth), id);
    }

    // ---------------- DYNAMIC FORM BUILDER FIELDS ----------------

    @GetMapping("/{id}/fields")
    public Map<String, Object> listFields(Authentication auth, @PathVariable Long id) {
        return businessService.listFormFields(currentUserId(auth), id);
    }

    @PostMapping("/{id}/fields")
    public ResponseEntity<Map<String, Object>> addField(
            Authentication auth,
            @PathVariable Long id,
            @Valid @RequestBody FormFieldRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(businessService.addFormField(currentUserId(auth), id, request));
    }

    @PutMapping("/{id}/fields/{fieldId}")
    public Map<String, Object> updateField(
            Authentication auth,
            @PathVariable Long id,
            @PathVariable Long fieldId,
            @Valid @RequestBody FormFieldRequest request
    ) {
        return businessService.updateFormField(currentUserId(auth), id, fieldId, request);
    }

    @DeleteMapping("/{id}/fields/{fieldId}")
    public Map<String, String> deleteField(
            Authentication auth,
            @PathVariable Long id,
            @PathVariable Long fieldId
    ) {
        return businessService.deleteFormField(currentUserId(auth), id, fieldId);
    }
}
