package com.formflow.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.formflow.dto.WorkspaceDtos.FormFieldRequest;
import com.formflow.entity.Business;
import com.formflow.entity.CustomerRecord;
import com.formflow.entity.FormField;
import com.formflow.repository.BusinessRepository;
import com.formflow.repository.CustomerRecordRepository;
import com.formflow.repository.CustomerRepeatingRecordRepository;
import com.formflow.repository.FormFieldRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class BusinessService {

    private static final Set<String> ALLOWED_FIELD_TYPES = Set.of(
            "text", "number", "email", "phone", "textarea",
            "select", "dropdown", "date", "boolean", "checkbox", "table"
    );
    private static final String EMAIL_REGEX = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

    private final BusinessRepository businessRepository;
    private final FormFieldRepository formFieldRepository;
    private final CustomerRecordRepository recordRepository;
    private final CustomerRepeatingRecordRepository repeatingRecordRepository;
    private final ObjectMapper objectMapper;
    private final WorkspaceDtoMapper mapper;

    public BusinessService(
            BusinessRepository businessRepository,
            FormFieldRepository formFieldRepository,
            CustomerRecordRepository recordRepository,
            CustomerRepeatingRecordRepository repeatingRecordRepository,
            ObjectMapper objectMapper,
            WorkspaceDtoMapper mapper
    ) {
        this.businessRepository = businessRepository;
        this.formFieldRepository = formFieldRepository;
        this.recordRepository = recordRepository;
        this.repeatingRecordRepository = repeatingRecordRepository;
        this.objectMapper = objectMapper;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> listBusinesses(Long userId) {
        List<Map<String, Object>> list = businessRepository
                .findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream()
                .map(mapper::toBusinessDto)
                .toList();
        return Map.of("businesses", list);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> listDeletedBusinesses(Long userId) {
        Instant now = Instant.now();
        List<Map<String, Object>> list = businessRepository
                .findByUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(userId)
                .stream()
                .map(biz -> {
                    Map<String, Object> dto = new LinkedHashMap<>(mapper.toBusinessDto(biz));
                    long days = Duration.between(biz.getDeletedAt(), now).toDays();
                    dto.put("remainingDays", Math.max(0, 30 - days));
                    dto.put(
                            "recordCount",
                            recordRepository.findByUserIdAndBusinessIdAndDeletedAtIsNotNull(userId, biz.getId()).size()
                    );
                    return dto;
                })
                .toList();
        return Map.of("businesses", list);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getBusinessById(Long userId, Long id) {
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        return Map.of("business", mapper.toBusinessDto(biz));
    }

    @Transactional
    public Map<String, Object> createBusiness(Long userId, Map<String, Object> body) {
        String name = mapper.safeStr(body.get("name"), "");
        if (name.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Business name must be at least 2 characters.");
        }
        if (businessRepository.existsByUserIdAndNameIgnoreCaseAndDeletedAtIsNull(userId, name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A business with this name already exists.");
        }
        String bizEmail = mapper.safeStr(body.get("email"), "");
        if (!bizEmail.isEmpty() && !bizEmail.matches(EMAIL_REGEX)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter a valid business email address.");
        }

        Business biz = new Business();
        biz.setUserId(userId);
        biz.setName(name);
        biz.setCategory(mapper.safeStr(body.get("category"), "General Services"));
        biz.setPhone(mapper.safeStr(body.get("phone"), ""));
        biz.setEmail(bizEmail);
        biz.setAddress(mapper.safeStr(body.get("address"), ""));
        biz.setDescription(mapper.safeStr(body.get("description"), ""));
        applyFields(biz, body.get("fields"), false);

        Business saved = businessRepository.saveAndFlush(biz);
        return Map.of("business", mapper.toBusinessDto(saved), "message", "Business created successfully.");
    }

    @Transactional
    public Map<String, Object> updateBusiness(Long userId, Long id, Map<String, Object> body) {
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));

        if (body.containsKey("name")) {
            String nextName = mapper.safeStr(body.get("name"), "");
            if (nextName.length() < 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Business name must be at least 2 characters.");
            }
            if (businessRepository.existsByUserIdAndNameIgnoreCaseAndDeletedAtIsNullAndIdNot(userId, nextName, id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A business with this name already exists.");
            }
            biz.setName(nextName);
        }
        if (body.containsKey("category")) {
            biz.setCategory(mapper.safeStr(body.get("category"), "General Services"));
        }
        if (body.containsKey("phone")) {
            biz.setPhone(mapper.safeStr(body.get("phone"), ""));
        }
        if (body.containsKey("email")) {
            String bizEmail = mapper.safeStr(body.get("email"), "");
            if (!bizEmail.isEmpty() && !bizEmail.matches(EMAIL_REGEX)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter a valid business email address.");
            }
            biz.setEmail(bizEmail);
        }
        if (body.containsKey("address")) {
            biz.setAddress(mapper.safeStr(body.get("address"), ""));
        }
        if (body.containsKey("description")) {
            biz.setDescription(mapper.safeStr(body.get("description"), ""));
        }
        if (body.containsKey("archived")) {
            biz.setArchived(Boolean.TRUE.equals(body.get("archived")));
        }
        if (body.containsKey("fields")) {
            applyFields(biz, body.get("fields"), true);
        }

        biz.setUpdatedAt(Instant.now());
        Business saved = businessRepository.saveAndFlush(biz);
        return Map.of("business", mapper.toBusinessDto(saved), "message", "Business updated.");
    }

    @Transactional
    public Map<String, Object> archiveBusiness(Long userId, Long id) {
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        biz.setArchived(true);
        biz.setUpdatedAt(Instant.now());
        return Map.of("business", mapper.toBusinessDto(businessRepository.save(biz)), "message", "Business archived.");
    }

    @Transactional
    public Map<String, Object> activateBusiness(Long userId, Long id) {
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        biz.setArchived(false);
        biz.setUpdatedAt(Instant.now());
        return Map.of("business", mapper.toBusinessDto(businessRepository.save(biz)), "message", "Business activated.");
    }

    @Transactional
    public Map<String, Object> restoreBusiness(Long userId, Long id) {
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
            return Map.of(
                    "business", mapper.toBusinessDto(businessRepository.save(biz)),
                    "message", "Business restored from Recycle Bin."
            );
        }

        biz.setArchived(false);
        biz.setUpdatedAt(now);
        return Map.of("business", mapper.toBusinessDto(businessRepository.save(biz)), "message", "Business restored to Active.");
    }

    @Transactional
    public Map<String, Object> softDeleteBusiness(Long userId, Long id) {
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

    @Transactional
    public Map<String, String> permanentDeleteBusiness(Long userId, Long id) {
        Business biz = businessRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        repeatingRecordRepository.deleteByBusinessIdAndUserId(id, userId);
        recordRepository.deleteByUserIdAndBusinessId(userId, id);
        businessRepository.delete(biz);
        return Map.of("message", "Business permanently deleted.");
    }

    // ---------------- GRANULAR DYNAMIC FORM BUILDER CRUD ----------------

    @Transactional(readOnly = true)
    public Map<String, Object> listFormFields(Long userId, Long businessId) {
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(businessId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        List<Map<String, Object>> fields = formFieldRepository.findByBusinessIdOrderBySortOrderAscIdAsc(biz.getId())
                .stream()
                .map(mapper::toFieldDto)
                .toList();
        return Map.of("businessId", biz.getId(), "fields", fields);
    }

    @Transactional
    public Map<String, Object> addFormField(Long userId, Long businessId, FormFieldRequest req) {
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(businessId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));

        String label = req.label().trim();
        String baseName = slugify(req.fieldName() != null && !req.fieldName().isBlank() ? req.fieldName() : label, "field");
        String uniqueFieldName = baseName;
        int suffix = 2;
        while (formFieldRepository.existsByBusinessIdAndFieldNameIgnoreCase(biz.getId(), uniqueFieldName)) {
            uniqueFieldName = baseName + "_" + suffix++;
        }

        String normalizedType = normalizeFieldType(req.type());
        List<FormField> existing = formFieldRepository.findByBusinessIdOrderBySortOrderAscIdAsc(biz.getId());
        int nextSort = req.sortOrder() != null ? req.sortOrder() : existing.size();

        FormField ff = new FormField();
        ff.setBusiness(biz);
        ff.setFieldName(uniqueFieldName);
        ff.setLabel(label);
        ff.setType(normalizedType);
        ff.setRequired(req.required());
        ff.setSortOrder(nextSort);
        writeFieldJsonConfig(ff, normalizedType, req.options(), req.columns());

        FormField saved = formFieldRepository.saveAndFlush(ff);
        biz.setUpdatedAt(Instant.now());
        businessRepository.save(biz);

        return Map.of("field", mapper.toFieldDto(saved), "message", "Form field added.");
    }

    @Transactional
    public Map<String, Object> updateFormField(Long userId, Long businessId, Long fieldId, FormFieldRequest req) {
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(businessId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        FormField ff = formFieldRepository.findByIdAndBusinessId(fieldId, biz.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Form field not found."));

        String label = req.label().trim();
        if (req.fieldName() != null && !req.fieldName().isBlank()) {
            String candidate = slugify(req.fieldName(), ff.getFieldName());
            if (formFieldRepository.existsByBusinessIdAndFieldNameIgnoreCaseAndIdNot(biz.getId(), candidate, fieldId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A field with this key already exists on this form.");
            }
            ff.setFieldName(candidate);
        }

        String normalizedType = normalizeFieldType(req.type());
        ff.setLabel(label);
        ff.setType(normalizedType);
        ff.setRequired(req.required());
        if (req.sortOrder() != null) {
            ff.setSortOrder(req.sortOrder());
        }
        writeFieldJsonConfig(ff, normalizedType, req.options(), req.columns());
        ff.setUpdatedAt(Instant.now());

        FormField saved = formFieldRepository.saveAndFlush(ff);
        biz.setUpdatedAt(Instant.now());
        businessRepository.save(biz);

        return Map.of("field", mapper.toFieldDto(saved), "message", "Form field updated.");
    }

    @Transactional
    public Map<String, String> deleteFormField(Long userId, Long businessId, Long fieldId) {
        Business biz = businessRepository.findByIdAndUserIdAndDeletedAtIsNull(businessId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Business not found."));
        FormField ff = formFieldRepository.findByIdAndBusinessId(fieldId, biz.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Form field not found."));

        biz.getFields().removeIf(f -> Objects.equals(f.getId(), fieldId));
        formFieldRepository.delete(ff);
        biz.setUpdatedAt(Instant.now());
        businessRepository.save(biz);
        return Map.of("message", "Form field deleted.");
    }

    // ---------------- INTERNAL HELPERS ----------------

    private String normalizeFieldType(String rawType) {
        if (rawType == null || rawType.isBlank()) return "text";
        String lower = rawType.trim().toLowerCase();
        if ("dropdown".equals(lower)) return "select";
        if ("checkbox".equals(lower)) return "boolean";
        if (ALLOWED_FIELD_TYPES.contains(lower)) return lower;
        return "text";
    }

    private String slugify(String raw, String fallback) {
        String base = raw != null ? raw.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "") : "";
        return base.isEmpty() ? fallback : base;
    }

    private void writeFieldJsonConfig(FormField ff, String type, List<?> rawOptions, List<?> rawColumns) {
        try {
            List<String> normalizedOptions = new ArrayList<>();
            if ("select".equals(type) && rawOptions != null) {
                for (Object opt : rawOptions) {
                    String trimmed = opt != null ? String.valueOf(opt).trim() : "";
                    if (!trimmed.isEmpty()) normalizedOptions.add(trimmed);
                }
            }

            List<Map<String, Object>> normalizedColumns = new ArrayList<>();
            if ("table".equals(type) && rawColumns != null) {
                Set<String> usedColNames = new HashSet<>();
                int colIdx = 0;
                for (Object colItem : rawColumns) {
                    if (!(colItem instanceof Map<?, ?> colMap)) continue;
                    colIdx++;
                    String colLabel = mapper.safeStr(colMap.get("label"), "Column " + colIdx);
                    if (colLabel.isEmpty()) colLabel = "Column " + colIdx;
                    String rawColKey = colMap.get("name") != null ? String.valueOf(colMap.get("name")) : colLabel;
                    String colBase = slugify(rawColKey, "col_" + colIdx);
                    String colName = colBase;
                    int colSuffix = 2;
                    while (usedColNames.contains(colName)) {
                        colName = colBase + "_" + colSuffix++;
                    }
                    usedColNames.add(colName);

                    String rawColType = colMap.get("type") != null ? String.valueOf(colMap.get("type")).trim().toLowerCase() : "text";
                    String colType = "number".equals(rawColType) ? "number"
                            : "date".equals(rawColType) ? "date"
                            : "email".equals(rawColType) ? "email" : "text";

                    Map<String, Object> cleanCol = new LinkedHashMap<>();
                    cleanCol.put("id", colMap.get("id") != null ? String.valueOf(colMap.get("id")) : "col_" + colIdx + "_" + colName);
                    cleanCol.put("name", colName);
                    cleanCol.put("label", colLabel);
                    cleanCol.put("type", colType);
                    cleanCol.put("required", Boolean.TRUE.equals(colMap.get("required")));
                    normalizedColumns.add(cleanCol);
                }
            }

            ff.setOptionsJson(objectMapper.writeValueAsString(normalizedOptions));
            ff.setColumnsJson(objectMapper.writeValueAsString(normalizedColumns));
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid form field configuration.");
        }
    }

    private void applyFields(Business biz, Object rawFields, boolean flushOrphans) {
        if (!biz.getFields().isEmpty()) {
            biz.getFields().clear();
            if (flushOrphans && biz.getId() != null) {
                businessRepository.flush();
            }
        }
        if (!(rawFields instanceof List<?> list)) return;

        Set<String> usedFieldNames = new HashSet<>();
        int i = 0;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) continue;
            int idx = i + 1;
            String label = mapper.safeStr(map.get("label"), "Field " + idx);
            if (label.isEmpty()) label = "Field " + idx;

            String rawKey = map.get("fieldName") != null ? String.valueOf(map.get("fieldName")) : label;
            String baseName = slugify(rawKey, "field_" + idx);
            String fieldName = baseName;
            int suffix = 2;
            while (usedFieldNames.contains(fieldName)) {
                fieldName = baseName + "_" + suffix++;
            }
            usedFieldNames.add(fieldName);

            String rawType = map.get("type") != null ? String.valueOf(map.get("type")).trim() : "text";
            String type = normalizeFieldType(rawType);

            FormField ff = new FormField();
            ff.setBusiness(biz);
            ff.setFieldName(fieldName);
            ff.setLabel(label);
            ff.setType(type);
            ff.setRequired(Boolean.TRUE.equals(map.get("required")));
            ff.setSortOrder(i++);

            List<?> rawOpts = map.get("options") instanceof List<?> o ? o : null;
            List<?> rawCols = map.get("columns") instanceof List<?> c ? c : null;
            writeFieldJsonConfig(ff, type, rawOpts, rawCols);
            biz.getFields().add(ff);
        }
    }
}
