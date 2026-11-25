package com.formflow.service;

import com.formflow.dto.WorkspaceDtos.BugReportRequest;
import com.formflow.dto.WorkspaceDtos.BugReportStatusRequest;
import com.formflow.dto.WorkspaceDtos.UserFeedbackRequest;
import com.formflow.entity.BugReport;
import com.formflow.entity.Business;
import com.formflow.entity.SupportTicket;
import com.formflow.entity.User;
import com.formflow.entity.UserFeedback;
import com.formflow.entity.UserSettings;
import com.formflow.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@Service
public class UserWorkspaceService {

    private static final String EMAIL_REGEX = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";
    private static final List<String> ALLOWED_TICKET_STATUSES = List.of("Open", "In Progress", "Resolved");
    private static final List<String> ALLOWED_BUG_SEVERITIES = List.of("Low", "Medium", "High", "Critical");
    private static final List<String> ALLOWED_BUG_STATUSES = List.of("Open", "In Progress", "Resolved", "Closed");

    private final UserRepository userRepository;
    private final UserSettingsRepository settingsRepository;
    private final SupportTicketRepository ticketRepository;
    private final BugReportRepository bugReportRepository;
    private final UserFeedbackRepository feedbackRepository;
    private final BusinessRepository businessRepository;
    private final CustomerRecordRepository recordRepository;
    private final PasswordEncoder passwordEncoder;
    private final WorkspaceDtoMapper mapper;

    public UserWorkspaceService(
            UserRepository userRepository,
            UserSettingsRepository settingsRepository,
            SupportTicketRepository ticketRepository,
            BugReportRepository bugReportRepository,
            UserFeedbackRepository feedbackRepository,
            BusinessRepository businessRepository,
            CustomerRecordRepository recordRepository,
            PasswordEncoder passwordEncoder,
            WorkspaceDtoMapper mapper
    ) {
        this.userRepository = userRepository;
        this.settingsRepository = settingsRepository;
        this.ticketRepository = ticketRepository;
        this.bugReportRepository = bugReportRepository;
        this.feedbackRepository = feedbackRepository;
        this.businessRepository = businessRepository;
        this.recordRepository = recordRepository;
        this.passwordEncoder = passwordEncoder;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getProfile(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User profile not found."));
        return Map.of("profile", mapper.toUserDto(u));
    }

    @Transactional
    public Map<String, Object> updateProfile(Long userId, Map<String, Object> body) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User profile not found."));

        if (body.containsKey("fullName")) {
            String fullName = mapper.safeStr(body.get("fullName"), "");
            if (fullName.length() < 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Owner name must be at least 2 characters.");
            }
            u.setFullName(fullName);
        }
        if (body.containsKey("phone")) {
            u.setPhone(mapper.safeStr(body.get("phone"), ""));
        }
        if (body.containsKey("email")) {
            String nextEmail = mapper.safeStr(body.get("email"), "").toLowerCase();
            if (!nextEmail.matches(EMAIL_REGEX)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid email address is required.");
            }
            userRepository.findByEmailIgnoreCase(nextEmail).ifPresent(existing -> {
                if (!existing.getId().equals(userId)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "This email is already in use by another account.");
                }
            });
            u.setEmail(nextEmail);
        }
        if (body.containsKey("aadhaar")) {
            String aadhaar = String.valueOf(body.get("aadhaar")).replaceAll("\\s+", "");
            if (!aadhaar.isEmpty() && !aadhaar.matches("^\\d{12}$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aadhaar number must be exactly 12 digits.");
            }
            u.setAadhaar(aadhaar);
        }
        if (body.containsKey("photoDataUrl")) {
            u.setPhotoDataUrl(body.get("photoDataUrl") != null ? String.valueOf(body.get("photoDataUrl")) : "");
        }
        u.setUpdatedAt(Instant.now());
        return Map.of("profile", mapper.toUserDto(userRepository.save(u)), "message", "Profile updated.");
    }

    @Transactional
    public Map<String, String> changePassword(Long userId, Map<String, String> body) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User account not found."));
        String currentPassword = body.getOrDefault("currentPassword", "");
        if (!passwordEncoder.matches(currentPassword, u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect.");
        }
        String newPassword = body.getOrDefault("newPassword", "");
        if (newPassword.length() < 8 || !newPassword.matches("^(?=.*[A-Za-z])(?=.*\\d).+$")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "New password must be at least 8 characters and include both letters and numbers."
            );
        }
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        u.setUpdatedAt(Instant.now());
        userRepository.save(u);
        return Map.of("message", "Password updated successfully.");
    }

    @Transactional
    public Map<String, Object> getSettings(Long userId) {
        UserSettings s = settingsRepository.findById(userId).orElseGet(() -> {
            UserSettings def = new UserSettings();
            def.setUserId(userId);
            return settingsRepository.save(def);
        });
        return Map.of("settings", s);
    }

    @Transactional
    public Map<String, Object> updateSettings(Long userId, Map<String, Object> body) {
        UserSettings s = settingsRepository.findById(userId).orElseGet(() -> {
            UserSettings def = new UserSettings();
            def.setUserId(userId);
            return def;
        });
        if (body.containsKey("language")) s.setLanguage(String.valueOf(body.get("language")));
        if (body.containsKey("phoneAlerts")) s.setPhoneAlerts(Boolean.TRUE.equals(body.get("phoneAlerts")));
        if (body.containsKey("emailReceipts")) s.setEmailReceipts(Boolean.TRUE.equals(body.get("emailReceipts")));
        if (body.containsKey("twoFactorOtp")) s.setTwoFactorOtp(Boolean.TRUE.equals(body.get("twoFactorOtp")));
        if (body.containsKey("dailyBackup")) s.setDailyBackup(Boolean.TRUE.equals(body.get("dailyBackup")));
        s.setUpdatedAt(Instant.now());
        return Map.of("settings", settingsRepository.save(s), "message", "Settings saved.");
    }

    @Transactional
    public Map<String, Object> backupNow(Long userId) {
        UserSettings s = settingsRepository.findById(userId).orElseGet(() -> {
            UserSettings def = new UserSettings();
            def.setUserId(userId);
            return def;
        });
        Instant now = Instant.now();
        s.setLastBackupAt(now);
        s.setUpdatedAt(now);
        UserSettings savedSettings = settingsRepository.save(s);

        List<Map<String, Object>> businesses = businessRepository
                .findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream()
                .map(mapper::toBusinessDto)
                .toList();
        List<Map<String, Object>> records = recordRepository
                .findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream()
                .map(mapper::toRecordDto)
                .toList();
        List<SupportTicket> tickets = ticketRepository.findByUserIdOrderByCreatedAtDesc(userId);

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("exportedAt", now.toString());
        snapshot.put("businesses", businesses);
        snapshot.put("records", records);
        snapshot.put("tickets", tickets);
        snapshot.put("settings", savedSettings);

        return Map.of(
                "settings", savedSettings,
                "snapshot", snapshot,
                "message", "Workspace backup created."
        );
    }

    // ---------------- SUPPORT TICKETS ----------------

    @Transactional(readOnly = true)
    public Map<String, Object> listTickets(Long userId) {
        return Map.of("tickets", ticketRepository.findByUserIdOrderByCreatedAtDesc(userId));
    }

    @Transactional
    public Map<String, Object> createTicket(Long userId, Map<String, String> body) {
        String subject = body.getOrDefault("subject", "").trim();
        String description = body.getOrDefault("description", "").trim();
        if (subject.length() < 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket subject must be at least 3 characters.");
        }
        if (description.length() < 10) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Please provide a detailed description (at least 10 characters)."
            );
        }
        SupportTicket t = new SupportTicket();
        t.setUserId(userId);
        t.setSubject(subject);
        t.setCategory(body.getOrDefault("category", "General Support"));
        t.setDescription(description);
        t.setStatus("Open");
        return Map.of("ticket", ticketRepository.save(t));
    }

    @Transactional
    public Map<String, Object> updateTicketStatus(Long userId, Long id, Map<String, String> body) {
        SupportTicket t = ticketRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Support ticket not found."));
        String nextStatus = body.getOrDefault("status", t.getStatus());
        if (!ALLOWED_TICKET_STATUSES.contains(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ticket status.");
        }
        t.setStatus(nextStatus);
        t.setUpdatedAt(Instant.now());
        return Map.of("ticket", ticketRepository.save(t));
    }

    // ---------------- BUG REPORTS ----------------

    @Transactional(readOnly = true)
    public Map<String, Object> listBugReports(Long userId) {
        return Map.of("bugReports", bugReportRepository.findByUserIdOrderByCreatedAtDesc(userId));
    }

    @Transactional
    public Map<String, Object> createBugReport(Long userId, BugReportRequest req) {
        String severity = req.severity() != null && !req.severity().isBlank() ? req.severity().trim() : "Medium";
        if (!ALLOWED_BUG_SEVERITIES.contains(severity)) {
            severity = "Medium";
        }
        BugReport bug = new BugReport();
        bug.setUserId(userId);
        bug.setTitle(req.title().trim());
        bug.setSeverity(severity);
        bug.setPageUrl(req.pageUrl() != null ? req.pageUrl().trim() : "");
        bug.setStepsToReproduce(req.stepsToReproduce() != null ? req.stepsToReproduce().trim() : "");
        bug.setDescription(req.description().trim());
        bug.setStatus("Open");
        return Map.of(
                "bugReport", bugReportRepository.save(bug),
                "message", "Bug report submitted successfully."
        );
    }

    @Transactional
    public Map<String, Object> updateBugReportStatus(Long userId, Long id, BugReportStatusRequest req) {
        BugReport bug = bugReportRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bug report not found."));
        String nextStatus = req.status().trim();
        if (!ALLOWED_BUG_STATUSES.contains(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid bug report status.");
        }
        bug.setStatus(nextStatus);
        bug.setUpdatedAt(Instant.now());
        return Map.of("bugReport", bugReportRepository.save(bug));
    }

    // ---------------- USER FEEDBACK ----------------

    @Transactional(readOnly = true)
    public Map<String, Object> listFeedbacks(Long userId) {
        return Map.of("feedbacks", feedbackRepository.findByUserIdOrderByCreatedAtDesc(userId));
    }

    @Transactional
    public Map<String, Object> submitFeedback(Long userId, UserFeedbackRequest req) {
        UserFeedback fb = new UserFeedback();
        fb.setUserId(userId);
        fb.setRating(req.rating());
        fb.setCategory(req.category() != null && !req.category().isBlank() ? req.category().trim() : "General");
        fb.setMessage(req.message().trim());
        return Map.of(
                "feedback", feedbackRepository.save(fb),
                "message", "Thank you for your feedback."
        );
    }

    // ---------------- GLOBAL SEARCH ----------------

    @Transactional(readOnly = true)
    public Map<String, Object> globalSearch(Long userId, String query) {
        String q = query != null ? query.trim().toLowerCase() : "";
        if (q.isEmpty()) {
            return Map.of("businesses", List.of(), "customers", List.of(), "tickets", List.of());
        }

        List<Business> userBusinesses = businessRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);
        Map<Long, String> businessNames = new HashMap<>();
        userBusinesses.forEach(b -> businessNames.put(b.getId(), b.getName()));

        List<Map<String, Object>> matchingBusinesses = userBusinesses.stream()
                .filter(b -> (b.getName() != null && b.getName().toLowerCase().contains(q))
                        || (b.getCategory() != null && b.getCategory().toLowerCase().contains(q))
                        || (b.getPhone() != null && b.getPhone().toLowerCase().contains(q))
                        || (b.getEmail() != null && b.getEmail().toLowerCase().contains(q))
                        || (b.getAddress() != null && b.getAddress().toLowerCase().contains(q)))
                .limit(8)
                .map(mapper::toBusinessDto)
                .toList();

        List<Map<String, Object>> matchingCustomers = recordRepository
                .findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream()
                .filter(r -> (r.getCustomerName() != null && r.getCustomerName().toLowerCase().contains(q))
                        || (r.getCustomerPhone() != null && r.getCustomerPhone().toLowerCase().contains(q))
                        || (r.getCustomerEmail() != null && r.getCustomerEmail().toLowerCase().contains(q))
                        || (r.getTransactionId() != null && r.getTransactionId().toLowerCase().contains(q))
                        || (r.getAnswersJson() != null && r.getAnswersJson().toLowerCase().contains(q))
                        || (r.getRepeatingTablesJson() != null && r.getRepeatingTablesJson().toLowerCase().contains(q)))
                .limit(10)
                .map(r -> {
                    Map<String, Object> item = new LinkedHashMap<>(mapper.toRecordDto(r));
                    item.put("businessName", businessNames.getOrDefault(r.getBusinessId(), "Business"));
                    return item;
                })
                .toList();

        List<SupportTicket> matchingTickets = ticketRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .filter(t -> (t.getSubject() != null && t.getSubject().toLowerCase().contains(q))
                        || (t.getDescription() != null && t.getDescription().toLowerCase().contains(q))
                        || (t.getCategory() != null && t.getCategory().toLowerCase().contains(q))
                        || (t.getStatus() != null && t.getStatus().toLowerCase().contains(q)))
                .limit(6)
                .toList();

        return Map.of(
                "businesses", matchingBusinesses,
                "customers", matchingCustomers,
                "tickets", matchingTickets
        );
    }
}
