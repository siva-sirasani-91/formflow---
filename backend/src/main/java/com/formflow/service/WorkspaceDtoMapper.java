package com.formflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.formflow.entity.Business;
import com.formflow.entity.CustomerRecord;
import com.formflow.entity.CustomerRepeatingRecord;
import com.formflow.entity.FormField;
import com.formflow.entity.User;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class WorkspaceDtoMapper {

    private final ObjectMapper objectMapper;

    public WorkspaceDtoMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String safeStr(Object value, String fallback) {
        if (value == null) return fallback;
        String text = String.valueOf(value).trim();
        return text.isEmpty() && fallback != null && !fallback.isEmpty() ? fallback : text;
    }

    public Map<String, Object> toFieldDto(FormField f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", f.getId());
        m.put("fieldName", f.getFieldName());
        m.put("label", f.getLabel());
        m.put("type", f.getType());
        m.put("required", f.isRequired());
        m.put("sortOrder", f.getSortOrder());
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
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> toRepeatingRecordDto(CustomerRepeatingRecord rr) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", rr.getId());
        dto.put("recordId", rr.getRecordId());
        dto.put("businessId", rr.getBusinessId());
        dto.put("sectionFieldName", rr.getSectionFieldName());
        dto.put("rowIndex", rr.getRowIndex());
        try {
            dto.put("rowData", rr.getRowDataJson() != null
                    ? objectMapper.readValue(rr.getRowDataJson(), Map.class) : Map.of());
        } catch (Exception e) {
            dto.put("rowData", Map.of());
        }
        dto.put("createdAt", rr.getCreatedAt());
        dto.put("updatedAt", rr.getUpdatedAt());
        return dto;
    }

    public Map<String, Object> toBusinessDto(Business biz) {
        List<Map<String, Object>> fieldDtos = biz.getFields().stream()
                .map(this::toFieldDto)
                .toList();

        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", biz.getId());
        dto.put("userId", biz.getUserId());
        dto.put("name", biz.getName());
        dto.put("category", biz.getCategory());
        dto.put("phone", biz.getPhone() != null ? biz.getPhone() : "");
        dto.put("email", biz.getEmail() != null ? biz.getEmail() : "");
        dto.put("address", biz.getAddress() != null ? biz.getAddress() : "");
        dto.put("description", biz.getDescription() != null ? biz.getDescription() : "");
        dto.put("archived", biz.isArchived());
        dto.put("deletedAt", biz.getDeletedAt());
        dto.put("fields", fieldDtos);
        dto.put("createdAt", biz.getCreatedAt());
        dto.put("updatedAt", biz.getUpdatedAt());
        return dto;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> toRecordDto(CustomerRecord rec) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", rec.getId());
        dto.put("userId", rec.getUserId());
        dto.put("businessId", rec.getBusinessId());
        dto.put("customerName", rec.getCustomerName() != null ? rec.getCustomerName() : "");
        dto.put("customerPhone", rec.getCustomerPhone() != null ? rec.getCustomerPhone() : "");
        dto.put("customerEmail", rec.getCustomerEmail() != null ? rec.getCustomerEmail() : "");
        try {
            dto.put("answers", rec.getAnswersJson() != null
                    ? objectMapper.readValue(rec.getAnswersJson(), Map.class) : Map.of());
            dto.put("repeatingTables", rec.getRepeatingTablesJson() != null
                    ? objectMapper.readValue(rec.getRepeatingTablesJson(), Map.class) : Map.of());
        } catch (Exception e) {
            dto.put("answers", Map.of());
            dto.put("repeatingTables", Map.of());
        }
        Map<String, Object> payment = new LinkedHashMap<>();
        payment.put("amount", rec.getPaymentAmount() != null ? rec.getPaymentAmount() : BigDecimal.ZERO);
        payment.put("method", rec.getPaymentMethod() != null ? rec.getPaymentMethod() : "Cash");
        payment.put("transactionId", rec.getTransactionId() != null ? rec.getTransactionId() : "");
        payment.put("paidAt", rec.getPaidAt() != null ? rec.getPaidAt().toString() : "");
        dto.put("payment", payment);
        dto.put("createdAt", rec.getCreatedAt());
        dto.put("updatedAt", rec.getUpdatedAt());
        dto.put("deletedAt", rec.getDeletedAt());
        return dto;
    }

    public Map<String, Object> toUserDto(User u) {
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
