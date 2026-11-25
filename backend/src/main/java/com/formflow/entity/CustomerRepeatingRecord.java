package com.formflow.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "customer_repeating_records")
public class CustomerRepeatingRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    @Column(name = "business_id", nullable = false)
    private Long businessId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "section_field_name", nullable = false, length = 100)
    private String sectionFieldName;

    @Column(name = "row_index", nullable = false)
    private int rowIndex = 0;

    @Lob
    @Column(name = "row_data_json", nullable = false, columnDefinition = "LONGTEXT")
    private String rowDataJson = "{}";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() { return id; }
    public Long getRecordId() { return recordId; }
    public void setRecordId(Long recordId) { this.recordId = recordId; }
    public Long getBusinessId() { return businessId; }
    public void setBusinessId(Long businessId) { this.businessId = businessId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getSectionFieldName() { return sectionFieldName; }
    public void setSectionFieldName(String sectionFieldName) { this.sectionFieldName = sectionFieldName; }
    public int getRowIndex() { return rowIndex; }
    public void setRowIndex(int rowIndex) { this.rowIndex = rowIndex; }
    public String getRowDataJson() { return rowDataJson; }
    public void setRowDataJson(String rowDataJson) { this.rowDataJson = rowDataJson; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
