package com.formflow.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.formflow.entity.*;
import com.formflow.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api")
public class WorkspaceController {

    private final BusinessRepository businessRepository;
    private final CustomerRecordRepository recordRepository;
    private final UserRepository userRepository;
    private final UserSettingsRepository settingsRepository;
    private final SupportTicketRepository ticketRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    public WorkspaceController(
            BusinessRepository businessRepository,
            CustomerRecordRepository recordRepository,
            UserRepository userRepository,
            UserSettingsRepository settingsRepository,
            SupportTicketRepository ticketRepository,
            PasswordEncoder passwordEncoder,
            ObjectMapper objectMapper
    ) {
        this.businessRepository = businessRepository;
        this.recordRepository = recordRepository;
        this.userRepository = userRepository;
        this.settingsRepository = settingsRepository;
        this.ticketRepository = ticketRepository;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
    }

    private Long currentUserId(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        return (Long) auth.getPrincipal();
    }

    private String safeStr(Object value, String fallback) {
        if (value == null) return fallback;
        String text = String.valueOf(value).trim();
        return text.isEmpty() && fallback != null && !fallback.isEmpty() ? fallback : text;
    }

    // ---------------- BUSINESSES & FORM BUILDER ----------------

    @GetMapping("/businesses")
    public Map<String, Object> listBusinesses(Authentication auth) {
        Long userId = currentUserId(auth);
        List<Map<String, Object>> list = businessRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream().map(this::toBusinessDto).toList();
        return Map.of("businesses", list);
    }

    @GetMapping("/businesses/recycle-bin")
    public Map<String, Object> listDeletedBusinesses(Authentication auth) {
        Long userId = currentUserId(auth);
        Instant now = Instant.now();
        List<Map<String, Object>> list = businessRepository
                .findByUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(userId)
                .stream().map(biz -> {
                    Map<String, Object> dto = new LinkedHashMap<>(toBusinessDto(biz));
                    long days = Duration.between(biz.getDeletedAt(), now).toDays();
                    dto.put("remainingDays", Math.max(0, 30 - days));
                    dto.put("recordCount", recordRepository.findByUserIdAndBusinessIdAndDeletedAtIsNotNull(userId, biz.getId()).size());
                    return dto;
                }).toList();
        return Map.of("businesses", list);
    }

    @GetMapping("/businesses/{id}")
    public Map<String, Object> getBusinessById(Authentication auth, @PathVariable Long id) {
        Long userId = currentUserId(auth);
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        return Map.of("business", toBusinessDto(biz));
    }

    @PostMapping("/businesses")
    @Transactional
    public ResponseEntity<Map<String, Object>> createBusiness(
            Authentication auth,
            @RequestBody Map<String, Object> body
    ) {
        Long userId = currentUserId(auth);
        String name = safeStr(body.get("name"), "");
        if (name.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Business name is required.");
        }
        if (businessRepository.existsByUserIdAndNameIgnoreCaseAndDeletedAtIsNull(userId, name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A business with this name already exists.");
        }
        String bizEmail = safeStr(body.get("email"), "");
        if (!bizEmail.isEmpty() && !bizEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter a valid business email address.");
        }
        Business biz = new Business();
        biz.setUserId(userId);
        biz.setName(name);
        biz.setCategory(safeStr(body.get("category"), "General Services"));
        biz.setPhone(safeStr(body.get("phone"), ""));
        biz.setEmail(bizEmail);
        biz.setAddress(safeStr(body.get("address"), ""));
        biz.setDescription(safeStr(body.get("description"), ""));
        applyFields(biz, body.get("fields"), false);
        Business saved = businessRepository.saveAndFlush(biz);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("business", toBusinessDto(saved), "message", "Business created successfully."));
    }

    @PutMapping("/businesses/{id}")
    @Transactional
    public Map<String, Object> updateBusiness(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        Long userId = currentUserId(auth);
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        if (body.containsKey("name")) {
            String nextName = safeStr(body.get("name"), "");
            if (nextName.length() < 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Business name must be at least 2 characters.");
            }
            if (businessRepository.existsByUserIdAndNameIgnoreCaseAndDeletedAtIsNullAndIdNot(userId, nextName, id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A business with this name already exists.");
            }
            biz.setName(nextName);
        }
        if (body.containsKey("category")) biz.setCategory(safeStr(body.get("category"), "General Services"));
        if (body.containsKey("phone")) biz.setPhone(safeStr(body.get("phone"), ""));
        if (body.containsKey("email")) {
            String bizEmail = safeStr(body.get("email"), "");
            if (!bizEmail.isEmpty() && !bizEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter a valid business email address.");
            }
            biz.setEmail(bizEmail);
        }
        if (body.containsKey("address")) biz.setAddress(safeStr(body.get("address"), ""));
        if (body.containsKey("description")) biz.setDescription(safeStr(body.get("description"), ""));
        if (body.containsKey("archived")) biz.setArchived(Boolean.TRUE.equals(body.get("archived")));
        if (body.containsKey("fields")) applyFields(biz, body.get("fields"), true);
        biz.setUpdatedAt(Instant.now());
        return Map.of("business", toBusinessDto(businessRepository.saveAndFlush(biz)), "message", "Business updated.");
    }

    @PostMapping("/businesses/{id}/archive")
    @Transactional
    public Map<String, Object> archiveBusiness(Authentication auth, @PathVariable Long id) {
        Long userId = currentUserId(auth);
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        biz.setArchived(true);
        biz.setUpdatedAt(Instant.now());
        return Map.of("business", toBusinessDto(businessRepository.save(biz)), "message", "Business archived.");
    }

    @PostMapping("/businesses/{id}/restore")
    @Transactional
    public Map<String, Object> restoreBusiness(Authentication auth, @PathVariable Long id) {
        Long userId = currentUserId(auth);
        Business biz = businessRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        Instant now = Instant.now();
        if (biz.getDeletedAt() != null) {
            if (businessRepository.existsByUserIdAndNameIgnoreCaseAndDeletedAtIsNullAndIdNot(userId, biz.getName(), id)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "A business with this name already exists. Rename the active business before restoring."
                );
            }
            Instant bizDeletedAt = biz.getDeletedAt();
            biz.setDeletedAt(null);
            biz.setUpdatedAt(now);
            List<CustomerRecord> deletedRecs = recordRepository.findByUserIdAndBusinessIdAndDeletedAtIsNotNull(userId, id);
            for (CustomerRecord rec : deletedRecs) {
                if (rec.getDeletedAt() != null && Math.abs(Duration.between(bizDeletedAt, rec.getDeletedAt()).toMillis()) <= 5000) {
                    rec.setDeletedAt(null);
                    rec.setUpdatedAt(now);
                    recordRepository.save(rec);
                }
            }
            return Map.of("business", toBusinessDto(businessRepository.save(biz)), "message", "Business restored from Recycle Bin.");
        }
        biz.setArchived(false);
        biz.setUpdatedAt(now);
        return Map.of("business", toBusinessDto(businessRepository.save(biz)), "message", "Business restored to Active.");
    }

    @DeleteMapping("/businesses/{id}")
    @Transactional
    public Map<String, Object> deleteBusiness(Authentication auth, @PathVariable Long id) {
        Long userId = currentUserId(auth);
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        Instant now = Instant.now();
        biz.setDeletedAt(now);
        biz.setUpdatedAt(now);
        businessRepository.save(biz);

        List<CustomerRecord> activeRecords = recordRepository.findByUserIdAndBusinessIdAndDeletedAtIsNull(userId, id);
        for (CustomerRecord rec : activeRecords) {
            rec.setDeletedAt(now);
            rec.setUpdatedAt(now);
            recordRepository.save(rec);
        }
        return Map.of(
                "message", "Business moved to Recycle Bin (retained for 30 days).",
                "movedRecordCount", activeRecords.size()
        );
    }

    @DeleteMapping("/businesses/{id}/permanent")
    @Transactional
    public Map<String, String> permanentDeleteBusiness(Authentication auth, @PathVariable Long id) {
        Long userId = currentUserId(auth);
        Business biz = businessRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        recordRepository.deleteByUserIdAndBusinessId(userId, id);
        businessRepository.delete(biz);
        return Map.of("message", "Business permanently deleted.");
    }

    // ---------------- CUSTOMER RECORDS & RECYCLE BIN ----------------

    @GetMapping("/records")
    public Map<String, Object> listRecords(Authentication auth) {
        Long userId = currentUserId(auth);
        List<Map<String, Object>> list = recordRepository
                .findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream().map(this::toRecordDto).toList();
        return Map.of("records", list);
    }

    @GetMapping("/records/recycle-bin")
    public Map<String, Object> listRecycleBin(Authentication auth) {
        Long userId = currentUserId(auth);
        Instant now = Instant.now();
        List<Map<String, Object>> list = recordRepository
                .findByUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(userId)
                .stream().map(rec -> {
                    Map<String, Object> dto = new HashMap<>(toRecordDto(rec));
                    long days = Duration.between(rec.getDeletedAt(), now).toDays();
                    dto.put("remainingDays", Math.max(0, 30 - days));
                    dto.put("businessName", businessRepository.findByIdAndUserId(rec.getBusinessId(), userId)
                            .map(Business::getName).orElse("Deleted Business"));
                    return dto;
                }).toList();
        return Map.of("records", list);
    }

    @PostMapping("/records")
    @Transactional
    public ResponseEntity<Map<String, Object>> createRecord(
            Authentication auth,
            @RequestBody Map<String, Object> body
    ) throws Exception {
        Long userId = currentUserId(auth);
        if (body.get("businessId") == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid business.");
        }
        Long businessId;
        try {
            businessId = Long.valueOf(String.valueOf(body.get("businessId")));
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid business.");
        }
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(businessId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid business."));

        CustomerRecord rec = new CustomerRecord();
        rec.setUserId(userId);
        rec.setBusinessId(businessId);
        applyRecordBody(rec, biz, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("record", toRecordDto(recordRepository.saveAndFlush(rec))));
    }

    @PutMapping("/records/{id}")
    @Transactional
    public Map<String, Object> updateRecord(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) throws Exception {
        Long userId = currentUserId(auth);
        CustomerRecord rec = recordRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found."));
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(rec.getBusinessId(), userId).orElse(null);
        applyRecordBody(rec, biz, body);
        rec.setUpdatedAt(Instant.now());
        return Map.of("record", toRecordDto(recordRepository.saveAndFlush(rec)));
    }

    @DeleteMapping("/records/{id}")
    public Map<String, String> softDeleteRecord(Authentication auth, @PathVariable Long id) {
        Long userId = currentUserId(auth);
        CustomerRecord rec = recordRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found."));
        rec.setDeletedAt(Instant.now());
        rec.setUpdatedAt(Instant.now());
        recordRepository.save(rec);
        return Map.of("message", "Record moved to Recycle Bin.");
    }

    @PostMapping("/records/{id}/restore")
    public Map<String, Object> restoreRecord(Authentication auth, @PathVariable Long id) {
        Long userId = currentUserId(auth);
        CustomerRecord rec = recordRepository.findByIdAndUserId(id, userId)
                .filter(r -> r.getDeletedAt() != null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Deleted record not found in Recycle Bin."));
        if (businessRepository.findByIdAndUserIdAndDeletedAtIsNull(rec.getBusinessId(), userId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Restore the parent business first before restoring this record.");
        }
        rec.setDeletedAt(null);
        rec.setUpdatedAt(Instant.now());
        return Map.of("record", toRecordDto(recordRepository.save(rec)));
    }

    @DeleteMapping("/records/{id}/permanent")
    public Map<String, String> permanentDelete(Authentication auth, @PathVariable Long id) {
        Long userId = currentUserId(auth);
        CustomerRecord rec = recordRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found."));
        recordRepository.delete(rec);
        return Map.of("message", "Record permanently deleted.");
    }

    // ---------------- PROFILE, SETTINGS, TICKETS, SEARCH ----------------

    @GetMapping("/profile")
    public Map<String, Object> getProfile(Authentication auth) {
        User u = userRepository.findById(currentUserId(auth))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return Map.of("profile", toUserDto(u));
    }

    @PutMapping("/profile")
    public Map<String, Object> updateProfile(Authentication auth, @RequestBody Map<String, Object> body) {
        Long userId = currentUserId(auth);
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (body.containsKey("fullName")) {
            String fullName = String.valueOf(body.get("fullName")).trim();
            if (fullName.length() < 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Owner name must be at least 2 characters.");
            }
            u.setFullName(fullName);
        }
        if (body.containsKey("phone")) u.setPhone(safeStr(body.get("phone"), ""));
        if (body.containsKey("email")) {
            String nextEmail = safeStr(body.get("email"), "").toLowerCase();
            if (!nextEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
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
        return Map.of("profile", toUserDto(userRepository.save(u)), "message", "Profile updated.");
    }

    @PostMapping("/profile/change-password")
    public Map<String, String> changePassword(Authentication auth, @RequestBody Map<String, String> body) {
        User u = userRepository.findById(currentUserId(auth))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!passwordEncoder.matches(body.getOrDefault("currentPassword", ""), u.getPasswordHash())) {
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
        userRepository.save(u);
        return Map.of("message", "Password updated successfully.");
    }

    @GetMapping("/settings")
    public Map<String, Object> getSettings(Authentication auth) {
        Long userId = currentUserId(auth);
        UserSettings s = settingsRepository.findById(userId).orElseGet(() -> {
            UserSettings def = new UserSettings();
            def.setUserId(userId);
            return settingsRepository.save(def);
        });
        return Map.of("settings", s);
    }

    @PutMapping("/settings")
    public Map<String, Object> updateSettings(Authentication auth, @RequestBody Map<String, Object> body) {
        Long userId = currentUserId(auth);
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
        return Map.of("settings", settingsRepository.save(s), "message", "Settings saved.");
    }

    @PostMapping("/settings/backup-now")
    public Map<String, Object> backupNow(Authentication auth) {
        Long userId = currentUserId(auth);
        UserSettings s = settingsRepository.findById(userId).orElseGet(() -> {
            UserSettings def = new UserSettings();
            def.setUserId(userId);
            return def;
        });
        Instant now = Instant.now();
        s.setLastBackupAt(now);
        UserSettings savedSettings = settingsRepository.save(s);

        List<Map<String, Object>> businesses = businessRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream().map(this::toBusinessDto).toList();
        List<Map<String, Object>> records = recordRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream().map(this::toRecordDto).toList();
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

    @GetMapping("/tickets")
    public Map<String, Object> listTickets(Authentication auth) {
        return Map.of("tickets", ticketRepository.findByUserIdOrderByCreatedAtDesc(currentUserId(auth)));
    }

    @PostMapping("/tickets")
    public ResponseEntity<Map<String, Object>> createTicket(
            Authentication auth,
            @RequestBody Map<String, String> body
    ) {
        String subject = body.getOrDefault("subject", "").trim();
        String description = body.getOrDefault("description", "").trim();
        if (subject.length() < 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket subject must be at least 3 characters.");
        }
        if (description.length() < 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please provide a detailed description (at least 10 characters).");
        }
        SupportTicket t = new SupportTicket();
        t.setUserId(currentUserId(auth));
        t.setSubject(subject);
        t.setCategory(body.getOrDefault("category", "General Support"));
        t.setDescription(description);
        t.setStatus("Open");
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("ticket", ticketRepository.save(t)));
    }

    @PatchMapping("/tickets/{id}")
    public Map<String, Object> updateTicket(
            Authentication auth,
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        SupportTicket t = ticketRepository.findByIdAndUserId(id, currentUserId(auth))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        String nextStatus = body.getOrDefault("status", t.getStatus());
        if (!List.of("Open", "In Progress", "Resolved").contains(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ticket status.");
        }
        t.setStatus(nextStatus);
        t.setUpdatedAt(Instant.now());
        return Map.of("ticket", ticketRepository.save(t));
    }

    @GetMapping("/search")
    public Map<String, Object> globalSearch(
            Authentication auth,
            @RequestParam(name = "q", defaultValue = "") String query
    ) {
        Long userId = currentUserId(auth);
        String q = query.trim().toLowerCase();
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
                .map(this::toBusinessDto)
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
                    Map<String, Object> item = new LinkedHashMap<>(toRecordDto(r));
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

    // ---------------- REPORTS ----------------

    private static final Pattern MONEY_COLUMN_PATTERN = Pattern.compile(
            "\\b(pay|payment|payments|salary|wage|wages|amount|amt|fee|fees|cost|price|rate|total|bill|charge|charges|rent|bonus|advance|balance|expense|expenses|income|revenue|rs|inr|rupee|rupees|money|cash|paid|due|stipend|commission|discount|tax|subtotal|payable|receivable|deposit)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern NON_SUMMABLE_NUMERIC_PATTERN = Pattern.compile(
            "\\b(age|phone|mobile|contact|year|pin|pincode|zip|code|aadhaar|pan|gst|serial|sr|roll|id|no|number)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private LocalDate parseOptionalIsoDate(String raw, String fieldLabel) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid " + fieldLabel + " format.");
        }
    }

    private String getEffectiveRecordDate(CustomerRecord rec) {
        if (rec.getPaidAt() != null) return rec.getPaidAt().toString();
        if (rec.getCreatedAt() != null) {
            return rec.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate().toString();
        }
        return "";
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseFieldColumns(FormField field) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (field.getColumnsJson() == null || field.getColumnsJson().isBlank()) return result;
        try {
            List<Map<String, Object>> rawCols = objectMapper.readValue(
                    field.getColumnsJson(),
                    new TypeReference<List<Map<String, Object>>>() {}
            );
            for (Map<String, Object> col : rawCols) {
                String name = safeStr(col.get("name"), "");
                String label = safeStr(col.get("label"), name);
                String type = "number".equals(String.valueOf(col.get("type"))) ? "number" : "text";
                String combined = (label + " " + name.replace("_", " ")).trim();
                boolean isNumber = "number".equals(type);
                boolean isMoney = isNumber && MONEY_COLUMN_PATTERN.matcher(combined).find();
                boolean isNonSummable = isNumber && !isMoney && NON_SUMMABLE_NUMERIC_PATTERN.matcher(combined).find();
                boolean isSummable = isNumber && (isMoney || !isNonSummable);

                Map<String, Object> meta = new LinkedHashMap<>();
                meta.put("id", col.get("id") != null ? col.get("id") : name);
                meta.put("name", name);
                meta.put("label", label);
                meta.put("type", type);
                meta.put("isMoney", isMoney);
                meta.put("isSummable", isSummable);
                result.add(meta);
            }
        } catch (Exception ignored) {}
        return result;
    }

    private boolean isRepeatingRowPopulated(Map<?, ?> rowObj, List<Map<String, Object>> columns) {
        if (rowObj == null || rowObj.isEmpty()) return false;
        if (!columns.isEmpty()) {
            for (Map<String, Object> col : columns) {
                Object val = rowObj.get(col.get("name"));
                if (val != null && !String.valueOf(val).trim().isEmpty()) return true;
            }
            return false;
        }
        for (Object val : rowObj.values()) {
            if (val != null && !String.valueOf(val).trim().isEmpty()) return true;
        }
        return false;
    }

    private String getRecordDisplayTitleServer(CustomerRecord rec, Business biz, Map<String, Object> answers) {
        if (rec.getCustomerName() != null && !rec.getCustomerName().trim().isEmpty()) {
            return rec.getCustomerName().trim();
        }
        if (biz != null && biz.getFields() != null) {
            for (FormField f : biz.getFields()) {
                if ("table".equals(f.getType()) || "boolean".equals(f.getType())) continue;
                Object val = answers.get(f.getFieldName());
                if (val != null && !String.valueOf(val).trim().isEmpty()) {
                    return f.getLabel() + ": " + String.valueOf(val).trim();
                }
            }
        }
        for (Map.Entry<String, Object> entry : answers.entrySet()) {
            Object val = entry.getValue();
            if (val != null && !String.valueOf(val).trim().isEmpty()) {
                return entry.getKey() + ": " + String.valueOf(val).trim();
            }
        }
        return "Registration #" + rec.getId();
    }

    @GetMapping("/reports/table-records")
    @SuppressWarnings("unchecked")
    public Map<String, Object> getTableRecordsReport(
            Authentication auth,
            @RequestParam(name = "businessId") Long businessId,
            @RequestParam(name = "tableField", required = false, defaultValue = "") String tableField,
            @RequestParam(name = "q", required = false, defaultValue = "") String query,
            @RequestParam(name = "startDate", required = false, defaultValue = "") String startDateRaw,
            @RequestParam(name = "endDate", required = false, defaultValue = "") String endDateRaw,
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            @RequestParam(name = "pageSize", required = false, defaultValue = "25") int pageSize
    ) {
        Long userId = currentUserId(auth);
        LocalDate startDate = parseOptionalIsoDate(startDateRaw, "start date");
        LocalDate endDate = parseOptionalIsoDate(endDateRaw, "end date");
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date cannot be after end date.");
        }

        int safePage = Math.max(1, page);
        int safePageSize = Math.min(5000, Math.max(1, pageSize));
        String searchQuery = query != null ? query.trim() : "";
        String qLower = searchQuery.toLowerCase();

        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(businessId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Selected form was not found."));

        List<FormField> tableFields = biz.getFields().stream()
                .filter(f -> "table".equals(f.getType()))
                .toList();

        Map<String, Object> bizMeta = new LinkedHashMap<>();
        bizMeta.put("id", biz.getId());
        bizMeta.put("name", biz.getName());
        bizMeta.put("archived", biz.isArchived());

        Map<String, Object> filterMeta = new LinkedHashMap<>();
        filterMeta.put("startDate", startDate != null ? startDate.toString() : "");
        filterMeta.put("endDate", endDate != null ? endDate.toString() : "");
        filterMeta.put("q", searchQuery);

        if (tableFields.isEmpty()) {
            Map<String, Object> emptyRes = new LinkedHashMap<>();
            emptyRes.put("business", bizMeta);
            emptyRes.put("table", null);
            emptyRes.put("filters", filterMeta);
            emptyRes.put("rows", List.of());
            emptyRes.put("totals", Map.of());
            emptyRes.put("moneyTotal", BigDecimal.ZERO);
            emptyRes.put("hasMoneyColumns", false);
            emptyRes.put("pagination", Map.of("page", 1, "pageSize", safePageSize, "totalRows", 0, "totalPages", 1));
            return emptyRes;
        }

        FormField targetField = (tableField != null && !tableField.isBlank())
                ? tableFields.stream().filter(f -> f.getFieldName().equals(tableField.trim())).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Selected repeating table does not exist on this form."))
                : tableFields.get(0);

        List<Map<String, Object>> columns = parseFieldColumns(targetField);

        Instant startInstant = startDate != null ? startDate.atStartOfDay().toInstant(ZoneOffset.UTC) : null;
        Instant endInstant = endDate != null ? endDate.atTime(LocalTime.MAX).toInstant(ZoneOffset.UTC) : null;
        List<CustomerRecord> scopedRecords = recordRepository.findForReports(
                userId, biz.getId(), startDate, startInstant, endDate, endInstant
        );

        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        for (Map<String, Object> col : columns) {
            if (Boolean.TRUE.equals(col.get("isSummable"))) {
                totals.put(String.valueOf(col.get("name")), BigDecimal.ZERO);
            }
        }

        Set<String> seenKeys = new HashSet<>();
        List<Map<String, Object>> matchedRows = new ArrayList<>();

        for (CustomerRecord rec : scopedRecords) {
            if (rec.getRepeatingTablesJson() == null || rec.getRepeatingTablesJson().isBlank()) continue;
            Map<String, Object> repeatingTables;
            try {
                repeatingTables = objectMapper.readValue(rec.getRepeatingTablesJson(), Map.class);
            } catch (Exception ex) {
                continue;
            }
            Object rawList = repeatingTables.get(targetField.getFieldName());
            if (!(rawList instanceof List<?> rawTableRows)) continue;

            String rowDate = getEffectiveRecordDate(rec);
            for (int rowIdx = 0; rowIdx < rawTableRows.size(); rowIdx++) {
                Object rowItem = rawTableRows.get(rowIdx);
                if (!(rowItem instanceof Map<?, ?> rowObj)) continue;
                if (!isRepeatingRowPopulated(rowObj, columns)) continue;

                if (!qLower.isEmpty()) {
                    boolean matchesRow = false;
                    for (Map<String, Object> col : columns) {
                        Object val = rowObj.get(col.get("name"));
                        if (val != null && String.valueOf(val).toLowerCase().contains(qLower)) {
                            matchesRow = true;
                            break;
                        }
                    }
                    if (!matchesRow) continue;
                }

                String uniqueKey = rec.getId() + ":" + targetField.getFieldName() + ":" + rowIdx;
                if (!seenKeys.add(uniqueKey)) continue;

                Map<String, Object> cells = new LinkedHashMap<>();
                for (Map<String, Object> col : columns) {
                    String colName = String.valueOf(col.get("name"));
                    Object rawVal = rowObj.get(colName);
                    cells.put(colName, rawVal != null ? rawVal : "");
                    if (Boolean.TRUE.equals(col.get("isSummable")) && rawVal != null && !String.valueOf(rawVal).trim().isEmpty()) {
                        try {
                            BigDecimal num = new BigDecimal(String.valueOf(rawVal).trim());
                            totals.put(colName, totals.get(colName).add(num).setScale(2, RoundingMode.HALF_UP));
                        } catch (NumberFormatException ignored) {}
                    }
                }

                Map<String, Object> rowDto = new LinkedHashMap<>();
                rowDto.put("id", uniqueKey);
                rowDto.put("recordId", rec.getId());
                rowDto.put("date", rowDate);
                rowDto.put("cells", cells);
                matchedRows.add(rowDto);
            }
        }

        boolean hasMoneyColumns = columns.stream().anyMatch(c -> Boolean.TRUE.equals(c.get("isMoney")));
        BigDecimal moneyTotal = BigDecimal.ZERO;
        for (Map<String, Object> col : columns) {
            if (Boolean.TRUE.equals(col.get("isMoney"))) {
                BigDecimal colSum = totals.getOrDefault(String.valueOf(col.get("name")), BigDecimal.ZERO);
                moneyTotal = moneyTotal.add(colSum);
            }
        }

        int totalRows = matchedRows.size();
        int totalPages = Math.max(1, (int) Math.ceil((double) totalRows / safePageSize));
        int clampedPage = Math.min(safePage, totalPages);
        int fromIdx = Math.min((clampedPage - 1) * safePageSize, totalRows);
        int toIdx = Math.min(fromIdx + safePageSize, totalRows);

        Map<String, Object> tableMeta = new LinkedHashMap<>();
        tableMeta.put("fieldName", targetField.getFieldName());
        tableMeta.put("label", targetField.getLabel());
        tableMeta.put("columns", columns);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("business", bizMeta);
        response.put("table", tableMeta);
        response.put("filters", filterMeta);
        response.put("rows", matchedRows.subList(fromIdx, toIdx));
        response.put("totals", totals);
        response.put("moneyTotal", moneyTotal.setScale(2, RoundingMode.HALF_UP));
        response.put("hasMoneyColumns", hasMoneyColumns);
        response.put("pagination", Map.of(
                "page", clampedPage,
                "pageSize", safePageSize,
                "totalRows", totalRows,
                "totalPages", totalPages
        ));
        return response;
    }

    @GetMapping("/reports/overview")
    @SuppressWarnings("unchecked")
    public Map<String, Object> getReportsOverview(
            Authentication auth,
            @RequestParam(name = "businessId", required = false, defaultValue = "all") String businessIdRaw,
            @RequestParam(name = "startDate", required = false, defaultValue = "") String startDateRaw,
            @RequestParam(name = "endDate", required = false, defaultValue = "") String endDateRaw,
            @RequestParam(name = "paymentMethod", required = false, defaultValue = "all") String paymentMethod,
            @RequestParam(name = "q", required = false, defaultValue = "") String query,
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            @RequestParam(name = "pageSize", required = false, defaultValue = "25") int pageSize
    ) {
        Long userId = currentUserId(auth);
        LocalDate startDate = parseOptionalIsoDate(startDateRaw, "start date");
        LocalDate endDate = parseOptionalIsoDate(endDateRaw, "end date");
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date cannot be after end date.");
        }

        Long selectedBizId = null;
        if (businessIdRaw != null && !businessIdRaw.isBlank() && !"all".equalsIgnoreCase(businessIdRaw.trim())) {
            try {
                selectedBizId = Long.valueOf(businessIdRaw.trim());
            } catch (NumberFormatException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid business filter.");
            }
        }

        int safePage = Math.max(1, page);
        int safePageSize = Math.min(5000, Math.max(1, pageSize));
        String searchQuery = query != null ? query.trim() : "";
        String qLower = searchQuery.toLowerCase();
        String methodFilter = paymentMethod != null ? paymentMethod.trim() : "all";

        List<Business> userBusinesses = businessRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);
        Map<Long, Business> bizMap = new LinkedHashMap<>();
        for (Business b : userBusinesses) bizMap.put(b.getId(), b);

        Business selectedBiz = selectedBizId != null ? bizMap.get(selectedBizId) : null;
        if (selectedBizId != null && selectedBiz == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Selected form was not found.");
        }

        Instant startInstant = startDate != null ? startDate.atStartOfDay().toInstant(ZoneOffset.UTC) : null;
        Instant endInstant = endDate != null ? endDate.atTime(LocalTime.MAX).toInstant(ZoneOffset.UTC) : null;
        List<CustomerRecord> dbRecords = recordRepository.findForReports(
                userId, selectedBizId, startDate, startInstant, endDate, endInstant
        );

        // Reverse to newest-first for overview / payments / customer history
        List<CustomerRecord> reversed = new ArrayList<>(dbRecords);
        Collections.reverse(reversed);

        List<CustomerRecord> filteredRecords = new ArrayList<>();
        Map<Long, Map<String, Object>> answersCache = new HashMap<>();
        Map<Long, Map<String, Object>> tablesCache = new HashMap<>();
        Set<Long> seenIds = new HashSet<>();

        for (CustomerRecord rec : reversed) {
            if (!seenIds.add(rec.getId())) continue;
            String recMethod = "Online".equals(rec.getPaymentMethod()) ? "Online" : "Cash";
            if ("Cash".equals(methodFilter) && !"Cash".equals(recMethod)) continue;
            if ("Online".equals(methodFilter) && !"Online".equals(recMethod)) continue;

            Map<String, Object> answers = Map.of();
            Map<String, Object> tables = Map.of();
            try {
                if (rec.getAnswersJson() != null) answers = objectMapper.readValue(rec.getAnswersJson(), Map.class);
                if (rec.getRepeatingTablesJson() != null) tables = objectMapper.readValue(rec.getRepeatingTablesJson(), Map.class);
            } catch (Exception ignored) {}

            if (!qLower.isEmpty()) {
                Business b = bizMap.get(rec.getBusinessId());
                String title = getRecordDisplayTitleServer(rec, b, answers);
                StringBuilder sb = new StringBuilder();
                sb.append(title).append(' ');
                if (rec.getCustomerName() != null) sb.append(rec.getCustomerName()).append(' ');
                if (rec.getCustomerPhone() != null) sb.append(rec.getCustomerPhone()).append(' ');
                if (rec.getCustomerEmail() != null) sb.append(rec.getCustomerEmail()).append(' ');
                if (b != null && b.getName() != null) sb.append(b.getName()).append(' ');
                if (rec.getTransactionId() != null) sb.append(rec.getTransactionId()).append(' ');
                sb.append(recMethod).append(' ');
                answers.values().forEach(v -> {
                    if (v != null) sb.append(v).append(' ');
                });
                if (!sb.toString().toLowerCase().contains(qLower)) continue;
            }

            answersCache.put(rec.getId(), answers);
            tablesCache.put(rec.getId(), tables);
            filteredRecords.add(rec);
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal cashAmount = BigDecimal.ZERO;
        BigDecimal onlineAmount = BigDecimal.ZERO;
        int cashCount = 0;
        int onlineCount = 0;
        int totalRepeatingEntries = 0;

        for (CustomerRecord rec : filteredRecords) {
            BigDecimal amt = rec.getPaymentAmount() != null ? rec.getPaymentAmount() : BigDecimal.ZERO;
            totalAmount = totalAmount.add(amt);
            if ("Online".equals(rec.getPaymentMethod())) {
                onlineCount++;
                onlineAmount = onlineAmount.add(amt);
            } else {
                cashCount++;
                cashAmount = cashAmount.add(amt);
            }
            Business b = bizMap.get(rec.getBusinessId());
            Map<String, Object> recTables = tablesCache.getOrDefault(rec.getId(), Map.of());
            if (b != null) {
                for (FormField f : b.getFields()) {
                    if (!"table".equals(f.getType())) continue;
                    List<Map<String, Object>> cols = parseFieldColumns(f);
                    Object rawRows = recTables.get(f.getFieldName());
                    if (rawRows instanceof List<?> rowsList) {
                        for (Object rowItem : rowsList) {
                            if (rowItem instanceof Map<?, ?> rowMap && isRepeatingRowPopulated(rowMap, cols)) {
                                totalRepeatingEntries++;
                            }
                        }
                    }
                }
            }
        }

        List<Business> scopeBusinesses = selectedBiz != null ? List.of(selectedBiz) : userBusinesses;
        List<Map<String, Object>> formSummaries = new ArrayList<>();
        List<Map<String, Object>> fieldSummaries = new ArrayList<>();

        for (Business biz : scopeBusinesses) {
            List<CustomerRecord> bizRecs = filteredRecords.stream()
                    .filter(r -> r.getBusinessId().equals(biz.getId()))
                    .toList();
            BigDecimal bizAmount = BigDecimal.ZERO;
            BigDecimal bizCash = BigDecimal.ZERO;
            BigDecimal bizOnline = BigDecimal.ZERO;
            int bizRepeatingRows = 0;
            List<FormField> rtFields = biz.getFields().stream().filter(f -> "table".equals(f.getType())).toList();

            for (CustomerRecord rec : bizRecs) {
                BigDecimal amt = rec.getPaymentAmount() != null ? rec.getPaymentAmount() : BigDecimal.ZERO;
                bizAmount = bizAmount.add(amt);
                if ("Online".equals(rec.getPaymentMethod())) bizOnline = bizOnline.add(amt);
                else bizCash = bizCash.add(amt);

                Map<String, Object> recTables = tablesCache.getOrDefault(rec.getId(), Map.of());
                for (FormField tf : rtFields) {
                    List<Map<String, Object>> cols = parseFieldColumns(tf);
                    Object rawRows = recTables.get(tf.getFieldName());
                    if (rawRows instanceof List<?> rowsList) {
                        for (Object rowItem : rowsList) {
                            if (rowItem instanceof Map<?, ?> rowMap && isRepeatingRowPopulated(rowMap, cols)) {
                                bizRepeatingRows++;
                            }
                        }
                    }
                }
            }

            Map<String, Object> formSum = new LinkedHashMap<>();
            formSum.put("businessId", biz.getId());
            formSum.put("name", biz.getName());
            formSum.put("category", biz.getCategory() != null ? biz.getCategory() : "");
            formSum.put("archived", biz.isArchived());
            formSum.put("fieldCount", biz.getFields().size());
            formSum.put("repeatingTableCount", rtFields.size());
            formSum.put("recordCount", bizRecs.size());
            formSum.put("repeatingRowCount", bizRepeatingRows);
            formSum.put("totalAmount", bizAmount.setScale(2, RoundingMode.HALF_UP));
            formSum.put("cashAmount", bizCash.setScale(2, RoundingMode.HALF_UP));
            formSum.put("onlineAmount", bizOnline.setScale(2, RoundingMode.HALF_UP));
            formSummaries.add(formSum);

            if (bizRecs.isEmpty()) continue;

            for (FormField field : biz.getFields()) {
                if ("table".equals(field.getType())) continue;
                String label = selectedBiz != null ? field.getLabel() : biz.getName() + " · " + field.getLabel();
                if ("number".equals(field.getType())) {
                    BigDecimal sum = BigDecimal.ZERO;
                    int count = 0;
                    for (CustomerRecord r : bizRecs) {
                        Object raw = answersCache.getOrDefault(r.getId(), Map.of()).get(field.getFieldName());
                        if (raw != null && !String.valueOf(raw).trim().isEmpty()) {
                            try {
                                sum = sum.add(new BigDecimal(String.valueOf(raw).trim()));
                                count++;
                            } catch (NumberFormatException ignored) {}
                        }
                    }
                    if (count > 0) {
                        BigDecimal avg = sum.divide(BigDecimal.valueOf(count), 1, RoundingMode.HALF_UP);
                        Map<String, Object> fs = new LinkedHashMap<>();
                        fs.put("key", biz.getId() + "-" + field.getFieldName());
                        fs.put("businessName", biz.getName());
                        fs.put("label", label);
                        fs.put("type", "number");
                        fs.put("summaryText", "Total: " + sum.stripTrailingZeros().toPlainString() + " · Avg: " + avg + " (" + count + (count == 1 ? " entry)" : " entries)"));
                        fieldSummaries.add(fs);
                    }
                } else if ("boolean".equals(field.getType())) {
                    int yes = 0;
                    int no = 0;
                    for (CustomerRecord r : bizRecs) {
                        Object raw = answersCache.getOrDefault(r.getId(), Map.of()).get(field.getFieldName());
                        if (Boolean.TRUE.equals(raw)) yes++;
                        else if (Boolean.FALSE.equals(raw)) no++;
                    }
                    if (yes + no > 0) {
                        Map<String, Object> fs = new LinkedHashMap<>();
                        fs.put("key", biz.getId() + "-" + field.getFieldName());
                        fs.put("businessName", biz.getName());
                        fs.put("label", label);
                        fs.put("type", "boolean");
                        fs.put("summaryText", "Yes: " + yes + " · No: " + no);
                        fieldSummaries.add(fs);
                    }
                } else if ("select".equals(field.getType())) {
                    Map<String, Integer> counts = new LinkedHashMap<>();
                    for (CustomerRecord r : bizRecs) {
                        Object raw = answersCache.getOrDefault(r.getId(), Map.of()).get(field.getFieldName());
                        if (raw != null && !String.valueOf(raw).isBlank()) {
                            String key = String.valueOf(raw);
                            counts.put(key, counts.getOrDefault(key, 0) + 1);
                        }
                    }
                    if (!counts.isEmpty()) {
                        List<String> parts = counts.entrySet().stream().map(e -> e.getKey() + ": " + e.getValue()).toList();
                        Map<String, Object> fs = new LinkedHashMap<>();
                        fs.put("key", biz.getId() + "-" + field.getFieldName());
                        fs.put("businessName", biz.getName());
                        fs.put("label", label);
                        fs.put("type", "select");
                        fs.put("summaryText", String.join(" · ", parts));
                        fieldSummaries.add(fs);
                    }
                }
            }
        }

        int totalRecords = filteredRecords.size();
        int totalPages = Math.max(1, (int) Math.ceil((double) totalRecords / safePageSize));
        int clampedPage = Math.min(safePage, totalPages);
        int fromIdx = Math.min((clampedPage - 1) * safePageSize, totalRecords);
        int toIdx = Math.min(fromIdx + safePageSize, totalRecords);

        List<Map<String, Object>> pagedRecords = new ArrayList<>();
        for (CustomerRecord r : filteredRecords.subList(fromIdx, toIdx)) {
            Business biz = bizMap.get(r.getBusinessId());
            Map<String, Object> answers = answersCache.getOrDefault(r.getId(), Map.of());
            Map<String, Object> tables = tablesCache.getOrDefault(r.getId(), Map.of());
            List<Map<String, Object>> details = new ArrayList<>();
            if (biz != null) {
                for (FormField f : biz.getFields()) {
                    if ("table".equals(f.getType())) {
                        List<Map<String, Object>> cols = parseFieldColumns(f);
                        Object rawRows = tables.get(f.getFieldName());
                        int populatedCount = 0;
                        if (rawRows instanceof List<?> rowsList) {
                            for (Object rowItem : rowsList) {
                                if (rowItem instanceof Map<?, ?> rowMap && isRepeatingRowPopulated(rowMap, cols)) {
                                    populatedCount++;
                                }
                            }
                        }
                        if (populatedCount > 0) {
                            details.add(Map.of(
                                    "label", f.getLabel(),
                                    "value", populatedCount + (populatedCount == 1 ? " entry" : " entries"),
                                    "isTable", true
                            ));
                        }
                    } else {
                        Object val = answers.get(f.getFieldName());
                        if (val != null && !String.valueOf(val).trim().isEmpty()) {
                            String displayVal = "boolean".equals(f.getType())
                                    ? (Boolean.TRUE.equals(val) ? "Yes" : "No")
                                    : String.valueOf(val);
                            details.add(Map.of("label", f.getLabel(), "value", displayVal, "isTable", false));
                        }
                    }
                }
            }

            String dateStr = getEffectiveRecordDate(r);
            Map<String, Object> recDto = new LinkedHashMap<>();
            recDto.put("id", r.getId());
            recDto.put("businessId", r.getBusinessId());
            recDto.put("businessName", biz != null ? biz.getName() : "—");
            recDto.put("displayTitle", getRecordDisplayTitleServer(r, biz, answers));
            recDto.put("customerName", r.getCustomerName() != null ? r.getCustomerName() : "");
            recDto.put("customerPhone", r.getCustomerPhone() != null ? r.getCustomerPhone() : "");
            recDto.put("customerEmail", r.getCustomerEmail() != null ? r.getCustomerEmail() : "");
            recDto.put("date", dateStr);
            recDto.put("payment", Map.of(
                    "amount", r.getPaymentAmount() != null ? r.getPaymentAmount() : BigDecimal.ZERO,
                    "method", "Online".equals(r.getPaymentMethod()) ? "Online" : "Cash",
                    "transactionId", r.getTransactionId() != null ? r.getTransactionId() : "",
                    "paidAt", r.getPaidAt() != null ? r.getPaidAt().toString() : dateStr
            ));
            recDto.put("details", details);
            recDto.put("answers", answers);
            recDto.put("repeatingTables", tables);
            recDto.put("createdAt", r.getCreatedAt());
            pagedRecords.add(recDto);
        }

        final Long finalSelectedBizId = selectedBizId;
        long matchingForms = formSummaries.stream()
                .filter(f -> ((Number) f.get("recordCount")).intValue() > 0 || finalSelectedBizId != null)
                .count();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalRecords", totalRecords);
        summary.put("totalPayments", cashCount + onlineCount);
        summary.put("totalAmount", totalAmount.setScale(2, RoundingMode.HALF_UP));
        summary.put("cashCount", cashCount);
        summary.put("cashAmount", cashAmount.setScale(2, RoundingMode.HALF_UP));
        summary.put("onlineCount", onlineCount);
        summary.put("onlineAmount", onlineAmount.setScale(2, RoundingMode.HALF_UP));
        summary.put("totalRepeatingEntries", totalRepeatingEntries);
        summary.put("matchingForms", matchingForms);

        Map<String, Object> filters = new LinkedHashMap<>();
        filters.put("businessId", businessIdRaw != null ? businessIdRaw : "all");
        filters.put("startDate", startDate != null ? startDate.toString() : "");
        filters.put("endDate", endDate != null ? endDate.toString() : "");
        filters.put("paymentMethod", methodFilter);
        filters.put("q", searchQuery);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("filters", filters);
        response.put("summary", summary);
        response.put("formSummaries", formSummaries);
        response.put("fieldSummaries", fieldSummaries);
        response.put("records", pagedRecords);
        response.put("pagination", Map.of(
                "page", clampedPage,
                "pageSize", safePageSize,
                "totalRecords", totalRecords,
                "totalPages", totalPages
        ));
        return response;
    }

    // ---------------- DTO HELPERS ----------------

    @SuppressWarnings("unchecked")
    private void applyFields(Business biz, Object rawFields, boolean flushOrphans) {
        if (!biz.getFields().isEmpty()) {
            biz.getFields().clear();
            if (flushOrphans && biz.getId() != null) {
                businessRepository.flush();
            }
        }
        if (!(rawFields instanceof List<?> list)) return;
        Set<String> allowedTypes = Set.of("text", "number", "select", "date", "boolean", "table");
        Set<String> usedFieldNames = new HashSet<>();
        int i = 0;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) continue;
            int idx = i + 1;
            String label = safeStr(map.get("label"), "Field " + idx);
            if (label.isEmpty()) label = "Field " + idx;
            String rawKey = map.get("fieldName") != null ? String.valueOf(map.get("fieldName")) : label;
            String baseName = rawKey.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
            if (baseName.isEmpty()) baseName = "field_" + idx;
            String fieldName = baseName;
            int suffix = 2;
            while (usedFieldNames.contains(fieldName)) {
                fieldName = baseName + "_" + suffix++;
            }
            usedFieldNames.add(fieldName);

            String rawType = map.get("type") != null ? String.valueOf(map.get("type")) : "text";
            String type = allowedTypes.contains(rawType) ? rawType : "text";

            FormField ff = new FormField();
            ff.setBusiness(biz);
            ff.setFieldName(fieldName);
            ff.setLabel(label);
            ff.setType(type);
            ff.setRequired(Boolean.TRUE.equals(map.get("required")));
            ff.setSortOrder(i++);
            try {
                Object opts = "select".equals(type) && map.get("options") instanceof List<?> ? map.get("options") : List.of();
                Object cols = "table".equals(type) && map.get("columns") instanceof List<?> ? map.get("columns") : List.of();
                ff.setOptionsJson(objectMapper.writeValueAsString(opts));
                ff.setColumnsJson(objectMapper.writeValueAsString(cols));
            } catch (Exception ignored) {}
            biz.getFields().add(ff);
        }
    }

    @SuppressWarnings("unchecked")
    private void applyRecordBody(CustomerRecord rec, Business biz, Map<String, Object> body) throws Exception {
        if (body.containsKey("customerName")) {
            rec.setCustomerName(safeStr(body.get("customerName"), ""));
        } else if (rec.getCustomerName() == null) {
            rec.setCustomerName("");
        }
        if (body.containsKey("customerPhone")) rec.setCustomerPhone(safeStr(body.get("customerPhone"), ""));
        if (body.containsKey("customerEmail")) rec.setCustomerEmail(safeStr(body.get("customerEmail"), ""));
        if (body.containsKey("answers")) rec.setAnswersJson(objectMapper.writeValueAsString(body.get("answers")));
        if (body.containsKey("repeatingTables")) {
            rec.setRepeatingTablesJson(objectMapper.writeValueAsString(body.get("repeatingTables")));
        }

        if (biz != null && biz.getFields() != null) {
            Map<String, Object> answers = rec.getAnswersJson() != null
                    ? objectMapper.readValue(rec.getAnswersJson(), Map.class) : Map.of();
            Map<String, Object> tables = rec.getRepeatingTablesJson() != null
                    ? objectMapper.readValue(rec.getRepeatingTablesJson(), Map.class) : Map.of();

            for (FormField field : biz.getFields()) {
                if (!field.isRequired()) continue;
                String fName = field.getFieldName();
                if ("table".equals(field.getType())) {
                    Object rawRows = tables.get(fName);
                    boolean hasValidRow = false;
                    if (rawRows instanceof List<?> rows) {
                        for (Object rowObj : rows) {
                            if (rowObj instanceof Map<?, ?> rowMap) {
                                for (Object val : rowMap.values()) {
                                    if (val != null && !String.valueOf(val).trim().isEmpty()) {
                                        hasValidRow = true;
                                        break;
                                    }
                                }
                            }
                            if (hasValidRow) break;
                        }
                    }
                    if (!hasValidRow) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field.getLabel() + " requires at least one populated row.");
                    }
                } else if ("boolean".equals(field.getType())) {
                    if (answers.get(fName) == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please select Yes or No for " + field.getLabel() + ".");
                    }
                } else {
                    Object val = answers.get(fName);
                    if (val == null || String.valueOf(val).trim().isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field.getLabel() + " is required.");
                    }
                }
            }
        }

        if (body.get("payment") instanceof Map<?, ?> pay) {
            BigDecimal amount;
            try {
                amount = new BigDecimal(String.valueOf(pay.get("amount") != null ? pay.get("amount") : "0"));
            } catch (NumberFormatException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid payment amount is required.");
            }
            if (amount.compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid payment amount is required.");
            }
            String method = pay.get("method") != null && String.valueOf(pay.get("method")).equals("Online") ? "Online" : "Cash";
            String txnId = pay.get("transactionId") != null ? String.valueOf(pay.get("transactionId")).trim() : "";
            if ("Online".equals(method) && txnId.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transaction ID is required for Online payments.");
            }
            if ("Online".equals(method) && !txnId.isEmpty()) {
                boolean dupTxn = rec.getId() == null
                        ? recordRepository.existsByUserIdAndTransactionIdIgnoreCaseAndDeletedAtIsNull(rec.getUserId(), txnId)
                        : recordRepository.existsByUserIdAndTransactionIdIgnoreCaseAndDeletedAtIsNullAndIdNot(rec.getUserId(), txnId, rec.getId());
                if (dupTxn) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "A customer record with this Transaction ID already exists.");
                }
            }
            rec.setPaymentAmount(amount);
            rec.setPaymentMethod(method);
            rec.setTransactionId("Online".equals(method) ? txnId : "");
            if (pay.get("paidAt") != null && !String.valueOf(pay.get("paidAt")).isBlank()) {
                rec.setPaidAt(LocalDate.parse(String.valueOf(pay.get("paidAt"))));
            }
        }
    }

    private Map<String, Object> toBusinessDto(Business biz) {
        List<Map<String, Object>> fieldDtos = biz.getFields().stream().map(f -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", f.getId());
            m.put("fieldName", f.getFieldName());
            m.put("label", f.getLabel());
            m.put("type", f.getType());
            m.put("required", f.isRequired());
            try {
                m.put("options", f.getOptionsJson() != null
                        ? objectMapper.readValue(f.getOptionsJson(), new TypeReference<List<Object>>() {})
                        : List.of());
                m.put("columns", f.getColumnsJson() != null
                        ? objectMapper.readValue(f.getColumnsJson(), new TypeReference<List<Object>>() {})
                        : List.of());
            } catch (Exception e) {
                m.put("options", List.of());
                m.put("columns", List.of());
            }
            return m;
        }).toList();

        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", biz.getId());
        dto.put("userId", biz.getUserId());
        dto.put("name", biz.getName());
        dto.put("category", biz.getCategory());
        dto.put("phone", biz.getPhone());
        dto.put("email", biz.getEmail());
        dto.put("address", biz.getAddress());
        dto.put("description", biz.getDescription());
        dto.put("archived", biz.isArchived());
        dto.put("deletedAt", biz.getDeletedAt());
        dto.put("fields", fieldDtos);
        dto.put("createdAt", biz.getCreatedAt());
        dto.put("updatedAt", biz.getUpdatedAt());
        return dto;
    }

    private Map<String, Object> toRecordDto(CustomerRecord rec) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", rec.getId());
        dto.put("userId", rec.getUserId());
        dto.put("businessId", rec.getBusinessId());
        dto.put("customerName", rec.getCustomerName());
        dto.put("customerPhone", rec.getCustomerPhone());
        dto.put("customerEmail", rec.getCustomerEmail());
        try {
            dto.put("answers", rec.getAnswersJson() != null
                    ? objectMapper.readValue(rec.getAnswersJson(), Map.class) : Map.of());
            dto.put("repeatingTables", rec.getRepeatingTablesJson() != null
                    ? objectMapper.readValue(rec.getRepeatingTablesJson(), Map.class) : Map.of());
        } catch (Exception e) {
            dto.put("answers", Map.of());
            dto.put("repeatingTables", Map.of());
        }
        dto.put("payment", Map.of(
                "amount", rec.getPaymentAmount(),
                "method", rec.getPaymentMethod(),
                "transactionId", rec.getTransactionId() != null ? rec.getTransactionId() : "",
                "paidAt", rec.getPaidAt() != null ? rec.getPaidAt().toString() : ""
        ));
        dto.put("createdAt", rec.getCreatedAt());
        dto.put("updatedAt", rec.getUpdatedAt());
        dto.put("deletedAt", rec.getDeletedAt());
        return dto;
    }

    private Map<String, Object> toUserDto(User u) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", u.getId());
        dto.put("fullName", u.getFullName());
        dto.put("email", u.getEmail());
        dto.put("phone", u.getPhone() != null ? u.getPhone() : "");
        dto.put("aadhaar", u.getAadhaar() != null ? u.getAadhaar() : "");
        dto.put("photoDataUrl", u.getPhotoDataUrl() != null ? u.getPhotoDataUrl() : "");
        dto.put("role", u.getRole());
        dto.put("createdAt", u.getCreatedAt());
        return dto;
    }
}
