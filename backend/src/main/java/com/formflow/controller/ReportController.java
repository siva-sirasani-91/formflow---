package com.formflow.controller;

import com.formflow.service.ReportExportService;
import com.formflow.service.ReportService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private static final MediaType XLSX_MEDIA_TYPE = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    private final ReportService reportService;
    private final ReportExportService reportExportService;

    public ReportController(ReportService reportService, ReportExportService reportExportService) {
        this.reportService = reportService;
        this.reportExportService = reportExportService;
    }

    private Long currentUserId(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        return userId;
    }

    @GetMapping("/table-records")
    public Map<String, Object> getTableRecordsReport(
            Authentication auth,
            @RequestParam(name = "businessId") Long businessId,
            @RequestParam(name = "tableField", required = false, defaultValue = "") String tableField,
            @RequestParam(name = "q", required = false, defaultValue = "") String query,
            @RequestParam(name = "startDate", required = false, defaultValue = "") String startDate,
            @RequestParam(name = "endDate", required = false, defaultValue = "") String endDate,
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            @RequestParam(name = "pageSize", required = false, defaultValue = "25") int pageSize
    ) {
        return reportService.getTableRecordsReport(
                currentUserId(auth), businessId, tableField, query, startDate, endDate, page, pageSize
        );
    }

    @GetMapping("/overview")
    public Map<String, Object> getReportsOverview(
            Authentication auth,
            @RequestParam(name = "businessId", required = false, defaultValue = "all") String businessId,
            @RequestParam(name = "startDate", required = false, defaultValue = "") String startDate,
            @RequestParam(name = "endDate", required = false, defaultValue = "") String endDate,
            @RequestParam(name = "paymentMethod", required = false, defaultValue = "all") String paymentMethod,
            @RequestParam(name = "q", required = false, defaultValue = "") String query,
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            @RequestParam(name = "pageSize", required = false, defaultValue = "25") int pageSize
    ) {
        return reportService.getReportsOverview(
                currentUserId(auth), businessId, startDate, endDate, paymentMethod, query, page, pageSize
        );
    }

    @GetMapping("/businesses")
    public Map<String, Object> getBusinessWiseReport(
            Authentication auth,
            @RequestParam(name = "businessId", required = false, defaultValue = "all") String businessId,
            @RequestParam(name = "startDate", required = false, defaultValue = "") String startDate,
            @RequestParam(name = "endDate", required = false, defaultValue = "") String endDate
    ) {
        Map<String, Object> overview = reportService.getReportsOverview(
                currentUserId(auth), businessId, startDate, endDate, "all", "", 1, 25
        );
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("filters", overview.get("filters"));
        res.put("summary", overview.get("summary"));
        res.put("businesses", overview.get("formSummaries"));
        res.put("fieldSummaries", overview.get("fieldSummaries"));
        return res;
    }

    @GetMapping("/customers")
    public Map<String, Object> getCustomerRegistrationReport(
            Authentication auth,
            @RequestParam(name = "businessId", required = false, defaultValue = "all") String businessId,
            @RequestParam(name = "startDate", required = false, defaultValue = "") String startDate,
            @RequestParam(name = "endDate", required = false, defaultValue = "") String endDate,
            @RequestParam(name = "paymentMethod", required = false, defaultValue = "all") String paymentMethod,
            @RequestParam(name = "q", required = false, defaultValue = "") String query,
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            @RequestParam(name = "pageSize", required = false, defaultValue = "25") int pageSize
    ) {
        Map<String, Object> overview = reportService.getReportsOverview(
                currentUserId(auth), businessId, startDate, endDate, paymentMethod, query, page, pageSize
        );
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("filters", overview.get("filters"));
        res.put("summary", overview.get("summary"));
        res.put("records", overview.get("records"));
        res.put("pagination", overview.get("pagination"));
        return res;
    }

    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> exportExcel(
            Authentication auth,
            @RequestParam(name = "businessId", required = false, defaultValue = "all") String businessId,
            @RequestParam(name = "startDate", required = false, defaultValue = "") String startDate,
            @RequestParam(name = "endDate", required = false, defaultValue = "") String endDate,
            @RequestParam(name = "paymentMethod", required = false, defaultValue = "all") String paymentMethod,
            @RequestParam(name = "q", required = false, defaultValue = "") String query
    ) {
        byte[] bytes = reportExportService.exportOverviewExcel(
                currentUserId(auth), businessId, startDate, endDate, paymentMethod, query
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(XLSX_MEDIA_TYPE);
        headers.setContentDisposition(ContentDisposition.attachment().filename("formflow-report.xlsx").build());
        return new ResponseEntity<>(bytes, headers, HttpStatus.OK);
    }

    @GetMapping("/export/pdf")
    public ResponseEntity<byte[]> exportPdf(
            Authentication auth,
            @RequestParam(name = "businessId", required = false, defaultValue = "all") String businessId,
            @RequestParam(name = "startDate", required = false, defaultValue = "") String startDate,
            @RequestParam(name = "endDate", required = false, defaultValue = "") String endDate,
            @RequestParam(name = "paymentMethod", required = false, defaultValue = "all") String paymentMethod,
            @RequestParam(name = "q", required = false, defaultValue = "") String query
    ) {
        byte[] bytes = reportExportService.exportOverviewPdf(
                currentUserId(auth), businessId, startDate, endDate, paymentMethod, query
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename("formflow-report.pdf").build());
        return new ResponseEntity<>(bytes, headers, HttpStatus.OK);
    }
}
