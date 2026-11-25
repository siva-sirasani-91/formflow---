package com.formflow.controller;

import com.formflow.dto.WorkspaceDtos.BugReportRequest;
import com.formflow.dto.WorkspaceDtos.BugReportStatusRequest;
import com.formflow.dto.WorkspaceDtos.UserFeedbackRequest;
import com.formflow.service.UserWorkspaceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class WorkspaceController {

    private final UserWorkspaceService userWorkspaceService;

    public WorkspaceController(UserWorkspaceService userWorkspaceService) {
        this.userWorkspaceService = userWorkspaceService;
    }

    private Long currentUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        return userId;
    }

    // ---------------- PROFILE ----------------

    @GetMapping("/profile")
    public Map<String, Object> getProfile(Authentication auth) {
        return userWorkspaceService.getProfile(currentUserId(auth));
    }

    @PutMapping("/profile")
    public Map<String, Object> updateProfile(Authentication auth, @RequestBody Map<String, Object> body) {
        return userWorkspaceService.updateProfile(currentUserId(auth), body);
    }

    @PostMapping("/profile/change-password")
    public Map<String, String> changePassword(Authentication auth, @RequestBody Map<String, String> body) {
        return userWorkspaceService.changePassword(currentUserId(auth), body);
    }

    // ---------------- SETTINGS ----------------

    @GetMapping("/settings")
    public Map<String, Object> getSettings(Authentication auth) {
        return userWorkspaceService.getSettings(currentUserId(auth));
    }

    @PutMapping("/settings")
    public Map<String, Object> updateSettings(Authentication auth, @RequestBody Map<String, Object> body) {
        return userWorkspaceService.updateSettings(currentUserId(auth), body);
    }

    @PostMapping("/settings/backup-now")
    public Map<String, Object> backupNow(Authentication auth) {
        return userWorkspaceService.backupNow(currentUserId(auth));
    }

    // ---------------- SUPPORT TICKETS ----------------

    @GetMapping("/tickets")
    public Map<String, Object> listTickets(Authentication auth) {
        return userWorkspaceService.listTickets(currentUserId(auth));
    }

    @PostMapping("/tickets")
    public ResponseEntity<Map<String, Object>> createTicket(
            Authentication auth,
            @RequestBody Map<String, String> body
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userWorkspaceService.createTicket(currentUserId(auth), body));
    }

    @PatchMapping("/tickets/{id}")
    public Map<String, Object> updateTicketStatus(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        return userWorkspaceService.updateTicketStatus(currentUserId(auth), id, body);
    }

    // ---------------- BUG REPORTS ----------------

    @GetMapping("/bug-reports")
    public Map<String, Object> listBugReports(Authentication auth) {
        return userWorkspaceService.listBugReports(currentUserId(auth));
    }

    @PostMapping("/bug-reports")
    public ResponseEntity<Map<String, Object>> createBugReport(
            Authentication auth,
            @Valid @RequestBody BugReportRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userWorkspaceService.createBugReport(currentUserId(auth), request));
    }

    @PatchMapping("/bug-reports/{id}")
    public Map<String, Object> updateBugReportStatus(
            Authentication auth,
            @PathVariable Long id,
            @Valid @RequestBody BugReportStatusRequest request
    ) {
        return userWorkspaceService.updateBugReportStatus(currentUserId(auth), id, request);
    }

    // ---------------- USER FEEDBACK ----------------

    @GetMapping("/feedback")
    public Map<String, Object> listFeedbacks(Authentication auth) {
        return userWorkspaceService.listFeedbacks(currentUserId(auth));
    }

    @PostMapping("/feedback")
    public ResponseEntity<Map<String, Object>> submitFeedback(
            Authentication auth,
            @Valid @RequestBody UserFeedbackRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userWorkspaceService.submitFeedback(currentUserId(auth), request));
    }

    // ---------------- GLOBAL SEARCH ----------------

    @GetMapping("/search")
    public Map<String, Object> globalSearch(
            Authentication auth,
            @RequestParam(name = "q", defaultValue = "") String query
    ) {
        return userWorkspaceService.globalSearch(currentUserId(auth), query);
    }
}
