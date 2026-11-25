package com.formflow.repository;

import com.formflow.entity.CustomerRepeatingRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerRepeatingRecordRepository extends JpaRepository<CustomerRepeatingRecord, Long> {
    List<CustomerRepeatingRecord> findByRecordIdAndUserIdOrderBySectionFieldNameAscRowIndexAsc(Long recordId, Long userId);
    List<CustomerRepeatingRecord> findByRecordIdAndUserIdAndSectionFieldNameOrderByRowIndexAsc(
            Long recordId,
            Long userId,
            String sectionFieldName
    );
    List<CustomerRepeatingRecord> findByUserIdAndBusinessIdAndSectionFieldNameOrderByRecordIdAscRowIndexAsc(
            Long userId,
            Long businessId,
            String sectionFieldName
    );
    void deleteByRecordIdAndUserId(Long recordId, Long userId);
    void deleteByBusinessIdAndUserId(Long businessId, Long userId);
}
