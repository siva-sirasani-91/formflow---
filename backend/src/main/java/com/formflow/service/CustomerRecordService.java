package com.formflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.formflow.entity.Business;
import com.formflow.entity.CustomerRecord;
import com.formflow.entity.CustomerRepeatingRecord;
import com.formflow.entity.FormField;
import com.formflow.repository.BusinessRepository;
import com.formflow.repository.CustomerRecordRepository;
import com.formflow.repository.CustomerRepeatingRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
public class CustomerRecordService {

    private static final String EMAIL_REGEX = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

    private final BusinessRepository businessRepository;
    private final CustomerRecordRepository recordRepository;
    private final CustomerRepeatingRecordRepository repeatingRecordRepository;
    private final ObjectMapper objectMapper;
    private final WorkspaceDtoMapper mapper;

    public CustomerRecordService(
            BusinessRepository businessRepository,
            CustomerRecordRepository recordRepository,
            CustomerRepeatingRecordRepository repeatingRecordRepository,
            ObjectMapper objectMapper,
            WorkspaceDtoMapper mapper
    ) {
        this.businessRepository = businessRepository;
        this.recordRepository = recordRepository;
        this.repeatingRecordRepository = repeatingRecordRepository;
        this.objectMapper = objectMapper;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> listRecords(Long userId, Long businessId, String query) {
        List<CustomerRecord> records = (businessId != null)
                ? recordRepository.findByUserIdAndBusinessIdAndDeletedAtIsNull(userId, businessId)
                        .stream()
                        .sorted(Comparator.comparing(CustomerRecord::getCreatedAt).reversed())
                        .toList()
                : recordRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);

        String qLower = query != null ? query.trim().toLowerCase() : "";
        List<Map<String, Object>> list = records.stream()
                .filter(r -> {
                    if (qLower.isEmpty()) return true;
                    return containsIgnoreCase(r.getCustomerName(), qLower)
                            || containsIgnoreCase(r.getCustomerPhone(), qLower)
                            || containsIgnoreCase(r.getCustomerEmail(), qLower)
                            || containsIgnoreCase(r.getTransactionId(), qLower)
                            || containsIgnoreCase(r.getPaymentMethod(), qLower)
                            || containsIgnoreCase(r.getAnswersJson(), qLower)
                            || containsIgnoreCase(r.getRepeatingTablesJson(), qLower);
                })
                .map(mapper::toRecordDto)
                .toList();
        return Map.of("records", list);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRecordById(Long userId, Long id) {
        CustomerRecord rec = recordRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found."));
        Map<String, Object> dto = new LinkedHashMap<>(mapper.toRecordDto(rec));
        List<Map<String, Object>> repeatingRows = repeatingRecordRepository
                .findByRecordIdAndUserIdOrderBySectionFieldNameAscRowIndexAsc(rec.getId(), userId)
                .stream()
                .map(mapper::toRepeatingRecordDto)
                .toList();
        dto.put("repeatingRecords", repeatingRows);
        return Map.of("record", dto);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRepeatingRecords(Long userId, Long recordId, String sectionFieldName) {
        CustomerRecord rec = recordRepository.findByIdAndUserIdAndDeletedAtIsNull(recordId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found."));
        List<CustomerRepeatingRecord> rows = (sectionFieldName != null && !sectionFieldName.isBlank())
                ? repeatingRecordRepository.findByRecordIdAndUserIdAndSectionFieldNameOrderByRowIndexAsc(
                        rec.getId(), userId, sectionFieldName.trim()
                )
                : repeatingRecordRepository.findByRecordIdAndUserIdOrderBySectionFieldNameAscRowIndexAsc(
                        rec.getId(), userId
                );
        return Map.of(
                "recordId", rec.getId(),
                "businessId", rec.getBusinessId(),
                "repeatingRecords", rows.stream().map(mapper::toRepeatingRecordDto).toList()
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> listRecycleBin(Long userId) {
        Instant now = Instant.now();
        List<Map<String, Object>> list = recordRepository
                .findByUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(userId)
                .stream()
                .map(rec -> {
                    Map<String, Object> dto = new LinkedHashMap<>(mapper.toRecordDto(rec));
                    long days = Duration.between(rec.getDeletedAt(), now).toDays();
                    dto.put("remainingDays", Math.max(0, 30 - days));
                    dto.put(
                            "businessName",
                            businessRepository.findByIdAndUserId(rec.getBusinessId(), userId)
                                    .map(Business::getName)
                                    .orElse("Deleted Business")
                    );
                    return dto;
                })
                .toList();
        return Map.of("records", list);
    }

    @Transactional
    public Map<String, Object> createRecord(Long userId, Map<String, Object> body) {
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
        CustomerRecord saved = recordRepository.saveAndFlush(rec);
        syncRepeatingRecords(saved);
        return Map.of("record", mapper.toRecordDto(saved));
    }

    @Transactional
    public Map<String, Object> updateRecord(Long userId, Long id, Map<String, Object> body) {
        CustomerRecord rec = recordRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found."));
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(rec.getBusinessId(), userId).orElse(null);
        applyRecordBody(rec, biz, body);
        rec.setUpdatedAt(Instant.now());
        CustomerRecord saved = recordRepository.saveAndFlush(rec);
        if (body.containsKey("repeatingTables")) {
            syncRepeatingRecords(saved);
        }
        return Map.of("record", mapper.toRecordDto(saved));
    }

    @Transactional
    public Map<String, String> softDeleteRecord(Long userId, Long id) {
        CustomerRecord rec = recordRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found."));
        rec.setDeletedAt(Instant.now());
        rec.setUpdatedAt(Instant.now());
        recordRepository.save(rec);
        return Map.of("message", "Record moved to Recycle Bin.");
    }

    @Transactional
    public Map<String, Object> restoreRecord(Long userId, Long id) {
        CustomerRecord rec = recordRepository.findByIdAndUserId(id, userId)
                .filter(r -> r.getDeletedAt() != null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Deleted record not found in Recycle Bin."));
        if (businessRepository.findByIdAndUserIdAndDeletedAtIsNull(rec.getBusinessId(), userId).isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Restore the parent business first before restoring this record."
            );
        }
        rec.setDeletedAt(null);
        rec.setUpdatedAt(Instant.now());
        return Map.of("record", mapper.toRecordDto(recordRepository.save(rec)));
    }

    @Transactional
    public Map<String, String> permanentDeleteRecord(Long userId, Long id) {
        CustomerRecord rec = recordRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found."));
        repeatingRecordRepository.deleteByRecordIdAndUserId(rec.getId(), userId);
        recordRepository.delete(rec);
        return Map.of("message", "Record permanently deleted.");
    }

    @SuppressWarnings("unchecked")
    private void syncRepeatingRecords(CustomerRecord rec) {
        repeatingRecordRepository.deleteByRecordIdAndUserId(rec.getId(), rec.getUserId());
        if (rec.getRepeatingTablesJson() == null || rec.getRepeatingTablesJson().isBlank()) {
            return;
        }
        try {
            Map<String, Object> tables = objectMapper.readValue(rec.getRepeatingTablesJson(), Map.class);
            List<CustomerRepeatingRecord> batch = new ArrayList<>();
            for (Map.Entry<String, Object> entry : tables.entrySet()) {
                String sectionKey = entry.getKey() != null ? entry.getKey().trim() : "";
                if (sectionKey.isEmpty() || !(entry.getValue() instanceof List<?> rows)) continue;
                int rowIndex = 0;
                for (Object rowObj : rows) {
                    if (!(rowObj instanceof Map<?, ?> rowMap)) continue;
                    boolean hasValue = rowMap.values().stream()
                            .anyMatch(v -> v != null && !String.valueOf(v).trim().isEmpty());
                    if (!hasValue) continue;
                    CustomerRepeatingRecord rr = new CustomerRepeatingRecord();
                    rr.setRecordId(rec.getId());
                    rr.setBusinessId(rec.getBusinessId());
                    rr.setUserId(rec.getUserId());
                    rr.setSectionFieldName(sectionKey);
                    rr.setRowIndex(rowIndex++);
                    rr.setRowDataJson(objectMapper.writeValueAsString(rowMap));
                    batch.add(rr);
                }
            }
            if (!batch.isEmpty()) {
                repeatingRecordRepository.saveAll(batch);
            }
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid repeating section records payload.");
        }
    }

    private boolean containsIgnoreCase(String value, String lowerQuery) {
        return value != null && value.toLowerCase().contains(lowerQuery);
    }

    @SuppressWarnings("unchecked")
    private void applyRecordBody(CustomerRecord rec, Business biz, Map<String, Object> body) {
        if (body.containsKey("customerName")) {
            rec.setCustomerName(mapper.safeStr(body.get("customerName"), ""));
        } else if (rec.getCustomerName() == null) {
            rec.setCustomerName("");
        }
        if (body.containsKey("customerPhone")) {
            rec.setCustomerPhone(mapper.safeStr(body.get("customerPhone"), ""));
        }
        if (body.containsKey("customerEmail")) {
            rec.setCustomerEmail(mapper.safeStr(body.get("customerEmail"), ""));
        }

        try {
            if (body.containsKey("answers")) {
                rec.setAnswersJson(objectMapper.writeValueAsString(body.get("answers")));
            }
            if (body.containsKey("repeatingTables")) {
                rec.setRepeatingTablesJson(objectMapper.writeValueAsString(body.get("repeatingTables")));
            }

            if (biz != null && biz.getFields() != null) {
                Map<String, Object> answers = rec.getAnswersJson() != null
                        ? objectMapper.readValue(rec.getAnswersJson(), Map.class) : Map.of();
                Map<String, Object> tables = rec.getRepeatingTablesJson() != null
                        ? objectMapper.readValue(rec.getRepeatingTablesJson(), Map.class) : Map.of();

                for (FormField field : biz.getFields()) {
                    String fName = field.getFieldName();
                    Object answerVal = answers.get(fName);

                    if ("email".equals(field.getType()) && answerVal != null && !String.valueOf(answerVal).trim().isEmpty()) {
                        if (!String.valueOf(answerVal).trim().matches(EMAIL_REGEX)) {
                            throw new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    "Please enter a valid email for " + field.getLabel() + "."
                            );
                        }
                    }

                    if (!field.isRequired()) continue;

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
                            throw new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    field.getLabel() + " requires at least one populated row."
                            );
                        }
                    } else if ("boolean".equals(field.getType()) || "checkbox".equals(field.getType())) {
                        if (answerVal == null) {
                            throw new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    "Please select Yes or No for " + field.getLabel() + "."
                            );
                        }
                    } else {
                        if (answerVal == null || String.valueOf(answerVal).trim().isEmpty()) {
                            throw new ResponseStatusException(
                                    HttpStatus.BAD_REQUEST,
                                    field.getLabel() + " is required."
                            );
                        }
                    }
                }
            }
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid customer form payload.");
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
            String method = pay.get("method") != null && "Online".equals(String.valueOf(pay.get("method")))
                    ? "Online" : "Cash";
            String txnId = pay.get("transactionId") != null ? String.valueOf(pay.get("transactionId")).trim() : "";
            if ("Online".equals(method) && txnId.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transaction ID is required for Online payments.");
            }
            if ("Online".equals(method) && !txnId.isEmpty()) {
                boolean dupTxn = rec.getId() == null
                        ? recordRepository.existsByUserIdAndTransactionIdIgnoreCaseAndDeletedAtIsNull(rec.getUserId(), txnId)
                        : recordRepository.existsByUserIdAndTransactionIdIgnoreCaseAndDeletedAtIsNullAndIdNot(rec.getUserId(), txnId, rec.getId());
                if (dupTxn) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "A customer record with this Transaction ID already exists."
                    );
                }
            }
            rec.setPaymentAmount(amount);
            rec.setPaymentMethod(method);
            rec.setTransactionId("Online".equals(method) ? txnId : "");
            if (pay.get("paidAt") != null && !String.valueOf(pay.get("paidAt")).isBlank()) {
                try {
                    rec.setPaidAt(LocalDate.parse(String.valueOf(pay.get("paidAt")).trim()));
                } catch (DateTimeParseException ex) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment date format. Expected YYYY-MM-DD.");
                }
            }
        }
    }
}
