package com.formflow.controller;

import com.formflow.service.CustomerRecordService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/records")
public class CustomerRecordController {

    private final CustomerRecordService customerRecordService;

    public CustomerRecordController(CustomerRecordService customerRecordService) {
        this.customerRecordService = customerRecordService;
    }

    private Long currentUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        return userId;
    }

    @GetMapping
    public Map<String, Object> listRecords(
            Authentication auth,
            @RequestParam(name = "businessId", required = false) Long businessId,
            @RequestParam(name = "q", required = false, defaultValue = "") String query
    ) {
        return customerRecordService.listRecords(currentUserId(auth), businessId, query);
    }

    @GetMapping("/recycle-bin")
    public Map<String, Object> listRecycleBin(Authentication auth) {
        return customerRecordService.listRecycleBin(currentUserId(auth));
    }

    @GetMapping("/{id}")
    public Map<String, Object> getRecordById(Authentication auth, @PathVariable Long id) {
        return customerRecordService.getRecordById(currentUserId(auth), id);
    }

    @GetMapping("/{id}/repeating")
    public Map<String, Object> getRepeatingRecords(
            Authentication auth,
            @PathVariable Long id,
            @RequestParam(name = "sectionFieldName", required = false, defaultValue = "") String sectionFieldName
    ) {
        return customerRecordService.getRepeatingRecords(currentUserId(auth), id, sectionFieldName);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createRecord(
            Authentication auth,
            @RequestBody Map<String, Object> body
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(customerRecordService.createRecord(currentUserId(auth), body));
    }

    @PutMapping("/{id}")
    public Map<String, Object> updateRecord(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        return customerRecordService.updateRecord(currentUserId(auth), id, body);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> softDeleteRecord(Authentication auth, @PathVariable Long id) {
        return customerRecordService.softDeleteRecord(currentUserId(auth), id);
    }

    @PostMapping("/{id}/restore")
    public Map<String, Object> restoreRecord(Authentication auth, @PathVariable Long id) {
        return customerRecordService.restoreRecord(currentUserId(auth), id);
    }

    @DeleteMapping("/{id}/permanent")
    public Map<String, String> permanentDeleteRecord(Authentication auth, @PathVariable Long id) {
        return customerRecordService.permanentDeleteRecord(currentUserId(auth), id);
    }
}
