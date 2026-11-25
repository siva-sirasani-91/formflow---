package com.formflow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.formflow.entity.Business;
import com.formflow.entity.CustomerRecord;
import com.formflow.entity.FormField;
import com.formflow.repository.BusinessRepository;
import com.formflow.repository.CustomerRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class ReportService {

    private static final Pattern MONEY_COLUMN_PATTERN = Pattern.compile(
            "\\b(pay|payment|payments|salary|wage|wages|amount|amt|fee|fees|cost|price|rate|total|bill|charge|charges|rent|bonus|advance|balance|expense|expenses|income|revenue|rs|inr|rupee|rupees|money|cash|paid|due|stipend|commission|discount|tax|subtotal|payable|receivable|deposit)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern NON_SUMMABLE_NUMERIC_PATTERN = Pattern.compile(
            "\\b(age|phone|mobile|contact|year|pin|pincode|zip|code|aadhaar|pan|gst|serial|sr|roll|id|no|number)\\b",
            Pattern.CASE_INSENSITIVE
    );

    private final BusinessRepository businessRepository;
    private final CustomerRecordRepository recordRepository;
    private final ObjectMapper objectMapper;
    private final WorkspaceDtoMapper mapper;

    public ReportService(
            BusinessRepository businessRepository,
            CustomerRecordRepository recordRepository,
            ObjectMapper objectMapper,
            WorkspaceDtoMapper mapper
    ) {
        this.businessRepository = businessRepository;
        this.recordRepository = recordRepository;
        this.objectMapper = objectMapper;
        this.mapper = mapper;
    }

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

    private List<Map<String, Object>> parseFieldColumns(FormField field) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (field.getColumnsJson() == null || field.getColumnsJson().isBlank()) return result;
        try {
            List<Map<String, Object>> rawCols = objectMapper.readValue(
                    field.getColumnsJson(),
                    new TypeReference<List<Map<String, Object>>>() {}
            );
            for (Map<String, Object> col : rawCols) {
                String name = mapper.safeStr(col.get("name"), "");
                String label = mapper.safeStr(col.get("label"), name);
                String rawType = String.valueOf(col.get("type"));
                String type = "number".equals(rawType) ? "number"
                        : "date".equals(rawType) ? "date" : "text";
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
                meta.put("required", Boolean.TRUE.equals(col.get("required")));
                meta.put("isMoney", isMoney);
                meta.put("isSummable", isSummable);
                result.add(meta);
            }
        } catch (Exception ignored) {
            // Skip malformed JSON column specs safely
        }
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

    private String getRecordDisplayTitle(CustomerRecord rec, Business biz, Map<String, Object> answers) {
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

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public Map<String, Object> getTableRecordsReport(
            Long userId,
            Long businessId,
            String tableField,
            String query,
            String startDateRaw,
            String endDateRaw,
            int page,
            int pageSize
    ) {
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
                ? tableFields.stream()
                        .filter(f -> f.getFieldName().equals(tableField.trim()))
                        .findFirst()
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Selected repeating table does not exist on this form."
                        ))
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
                        } catch (NumberFormatException ignored) {
                            // Ignore non-numeric cell content safely
                        }
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

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public Map<String, Object> getReportsOverview(
            Long userId,
            String businessIdRaw,
            String startDateRaw,
            String endDateRaw,
            String paymentMethod,
            String query,
            int page,
            int pageSize
    ) {
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

        List<CustomerRecord> reversed = new ArrayList<>(dbRecords);
        Collections.reverse(reversed);

        List<CustomerRecord> filteredRecords = new ArrayList<>();
        Map<Long, Map<String, Object>> answersCache = new HashMap<>();
        Map<Long, Map<String, Object>> tablesCache = new HashMap<>();
        Set<Long> seenIds = new HashSet<>();

        for (CustomerRecord rec : reversed) {
            if (!bizMap.containsKey(rec.getBusinessId())) continue;
            if (!seenIds.add(rec.getId())) continue;
            String recMethod = "Online".equals(rec.getPaymentMethod()) ? "Online" : "Cash";
            if ("Cash".equals(methodFilter) && !"Cash".equals(recMethod)) continue;
            if ("Online".equals(methodFilter) && !"Online".equals(recMethod)) continue;

            Map<String, Object> answers = Map.of();
            Map<String, Object> tables = Map.of();
            try {
                if (rec.getAnswersJson() != null) answers = objectMapper.readValue(rec.getAnswersJson(), Map.class);
                if (rec.getRepeatingTablesJson() != null) tables = objectMapper.readValue(rec.getRepeatingTablesJson(), Map.class);
            } catch (Exception ignored) {
                // Keep empty maps for malformed JSON
            }

            if (!qLower.isEmpty()) {
                Business b = bizMap.get(rec.getBusinessId());
                String title = getRecordDisplayTitle(rec, b, answers);
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
            recDto.put("displayTitle", getRecordDisplayTitle(r, biz, answers));
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
}
