package com.formflow.service;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

@Service
public class ReportExportService {

    private final ReportService reportService;

    public ReportExportService(ReportService reportService) {
        this.reportService = reportService;
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public byte[] exportOverviewExcel(
            Long userId,
            String businessId,
            String startDate,
            String endDate,
            String paymentMethod,
            String query
    ) {
        Map<String, Object> report = reportService.getReportsOverview(
                userId, businessId, startDate, endDate, paymentMethod, query, 1, 5000
        );
        Map<String, Object> summary = (Map<String, Object>) report.getOrDefault("summary", Map.of());
        List<Map<String, Object>> formSummaries = (List<Map<String, Object>>) report.getOrDefault("formSummaries", List.of());
        List<Map<String, Object>> records = (List<Map<String, Object>>) report.getOrDefault("records", List.of());

        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            CellStyle headerStyle = workbook.createCellStyle();
            org.apache.poi.ss.usermodel.Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            // Sheet 1: Summary
            Sheet summarySheet = workbook.createSheet("Summary");
            writeHeaderRow(summarySheet, headerStyle, List.of("Metric", "Value"));
            Object[][] summaryRows = {
                    {"Total Customer Records", summary.getOrDefault("totalRecords", 0)},
                    {"Total Payments", summary.getOrDefault("totalPayments", 0)},
                    {"Total Revenue", summary.getOrDefault("totalAmount", 0)},
                    {"Cash Payments Count", summary.getOrDefault("cashCount", 0)},
                    {"Cash Payments Total", summary.getOrDefault("cashAmount", 0)},
                    {"Online Payments Count", summary.getOrDefault("onlineCount", 0)},
                    {"Online Payments Total", summary.getOrDefault("onlineAmount", 0)},
                    {"Repeating Entries Count", summary.getOrDefault("totalRepeatingEntries", 0)},
                    {"Matching Forms", summary.getOrDefault("matchingForms", 0)}
            };
            for (int i = 0; i < summaryRows.length; i++) {
                Row row = summarySheet.createRow(i + 1);
                row.createCell(0).setCellValue(safeExcelText(String.valueOf(summaryRows[i][0])));
                row.createCell(1).setCellValue(safeExcelText(String.valueOf(summaryRows[i][1])));
            }
            summarySheet.autoSizeColumn(0);
            summarySheet.autoSizeColumn(1);

            // Sheet 2: Business / Form Summary
            Sheet formsSheet = workbook.createSheet("Business Summary");
            List<String> formHeaders = List.of(
                    "Business / Form", "Category", "Status", "Fields", "Records",
                    "Repeating Rows", "Total Amount", "Cash Amount", "Online Amount"
            );
            writeHeaderRow(formsSheet, headerStyle, formHeaders);
            for (int i = 0; i < formSummaries.size(); i++) {
                Map<String, Object> f = formSummaries.get(i);
                Row row = formsSheet.createRow(i + 1);
                row.createCell(0).setCellValue(safeExcelText(str(f.get("name"))));
                row.createCell(1).setCellValue(safeExcelText(str(f.get("category"))));
                row.createCell(2).setCellValue(Boolean.TRUE.equals(f.get("archived")) ? "Archived" : "Active");
                row.createCell(3).setCellValue(safeExcelText(str(f.get("fieldCount"))));
                row.createCell(4).setCellValue(safeExcelText(str(f.get("recordCount"))));
                row.createCell(5).setCellValue(safeExcelText(str(f.get("repeatingRowCount"))));
                row.createCell(6).setCellValue(safeExcelText(str(f.get("totalAmount"))));
                row.createCell(7).setCellValue(safeExcelText(str(f.get("cashAmount"))));
                row.createCell(8).setCellValue(safeExcelText(str(f.get("onlineAmount"))));
            }
            for (int c = 0; c < formHeaders.size(); c++) formsSheet.autoSizeColumn(c);

            // Sheet 3: Customer Records & Payments
            Sheet recordsSheet = workbook.createSheet("Customer Records");
            List<String> recHeaders = List.of(
                    "Record ID", "Date", "Business / Form", "Customer", "Phone", "Email",
                    "Payment Method", "Amount", "Transaction ID"
            );
            writeHeaderRow(recordsSheet, headerStyle, recHeaders);
            for (int i = 0; i < records.size(); i++) {
                Map<String, Object> r = records.get(i);
                Map<String, Object> pay = (Map<String, Object>) r.getOrDefault("payment", Map.of());
                Row row = recordsSheet.createRow(i + 1);
                row.createCell(0).setCellValue(safeExcelText(str(r.get("id"))));
                row.createCell(1).setCellValue(safeExcelText(str(r.get("date"))));
                row.createCell(2).setCellValue(safeExcelText(str(r.get("businessName"))));
                row.createCell(3).setCellValue(safeExcelText(str(r.get("displayTitle"))));
                row.createCell(4).setCellValue(safeExcelText(str(r.get("customerPhone"))));
                row.createCell(5).setCellValue(safeExcelText(str(r.get("customerEmail"))));
                row.createCell(6).setCellValue(safeExcelText(str(pay.get("method"))));
                row.createCell(7).setCellValue(safeExcelText(str(pay.get("amount"))));
                row.createCell(8).setCellValue(safeExcelText(str(pay.get("transactionId"))));
            }
            for (int c = 0; c < recHeaders.size(); c++) recordsSheet.autoSizeColumn(c);

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to generate Excel report.");
        }
    }

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public byte[] exportOverviewPdf(
            Long userId,
            String businessId,
            String startDate,
            String endDate,
            String paymentMethod,
            String query
    ) {
        Map<String, Object> report = reportService.getReportsOverview(
                userId, businessId, startDate, endDate, paymentMethod, query, 1, 5000
        );
        Map<String, Object> summary = (Map<String, Object>) report.getOrDefault("summary", Map.of());
        List<Map<String, Object>> records = (List<Map<String, Object>>) report.getOrDefault("records", List.of());

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 28, 28, 32, 28);
            PdfWriter.getInstance(doc, out);
            doc.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, new Color(36, 23, 74));
            Font subtitleFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.DARK_GRAY);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 8.5f, Color.BLACK);

            Paragraph title = new Paragraph("FormFlow Report Summary", titleFont);
            title.setSpacingAfter(4);
            doc.add(title);

            String dateRange = (startDate != null && !startDate.isBlank() ? startDate : "All")
                    + " to " + (endDate != null && !endDate.isBlank() ? endDate : "Present");
            Paragraph meta = new Paragraph(
                    "Date Range: " + dateRange
                            + "  |  Total Records: " + summary.getOrDefault("totalRecords", 0)
                            + "  |  Total Amount: " + summary.getOrDefault("totalAmount", 0)
                            + "  |  Cash: " + summary.getOrDefault("cashAmount", 0)
                            + "  |  Online: " + summary.getOrDefault("onlineAmount", 0),
                    subtitleFont
            );
            meta.setSpacingAfter(12);
            doc.add(meta);

            PdfPTable table = new PdfPTable(new float[]{1.0f, 1.4f, 2.2f, 2.4f, 1.5f, 1.3f, 1.4f, 1.8f});
            table.setWidthPercentage(100);

            List<String> headers = List.of("ID", "Date", "Business / Form", "Customer", "Phone", "Method", "Amount", "Transaction ID");
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, headerFont));
                cell.setBackgroundColor(new Color(62, 41, 122));
                cell.setPadding(6);
                cell.setHorizontalAlignment(Element.ALIGN_LEFT);
                table.addCell(cell);
            }

            for (Map<String, Object> r : records) {
                Map<String, Object> pay = (Map<String, Object>) r.getOrDefault("payment", Map.of());
                List<String> vals = List.of(
                        str(r.get("id")),
                        str(r.get("date")),
                        str(r.get("businessName")),
                        str(r.get("displayTitle")),
                        str(r.get("customerPhone")),
                        str(pay.get("method")),
                        str(pay.get("amount")),
                        str(pay.get("transactionId"))
                );
                for (String v : vals) {
                    PdfPCell cell = new PdfPCell(new Phrase(v, bodyFont));
                    cell.setPadding(5);
                    table.addCell(cell);
                }
            }

            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to generate PDF report.");
        }
    }

    private void writeHeaderRow(Sheet sheet, CellStyle style, List<String> headers) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < headers.size(); i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(headers.get(i));
            cell.setCellStyle(style);
        }
    }

    private String str(Object val) {
        return val != null ? String.valueOf(val) : "";
    }

    private String safeExcelText(String value) {
        if (value == null || value.isEmpty()) return "";
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
            return "'" + value;
        }
        return value;
    }
}
