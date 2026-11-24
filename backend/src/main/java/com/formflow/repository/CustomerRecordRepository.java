package com.formflow.repository;

import com.formflow.entity.CustomerRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CustomerRecordRepository extends JpaRepository<CustomerRecord, Long> {
    List<CustomerRecord> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long userId);
    List<CustomerRecord> findByUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(Long userId);
    List<CustomerRecord> findByUserIdAndBusinessIdAndDeletedAtIsNull(Long userId, Long businessId);
    List<CustomerRecord> findByUserIdAndBusinessIdAndDeletedAtIsNotNull(Long userId, Long businessId);
    Optional<CustomerRecord> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);
    Optional<CustomerRecord> findByIdAndUserId(Long id, Long userId);
    boolean existsByUserIdAndTransactionIdIgnoreCaseAndDeletedAtIsNull(Long userId, String transactionId);
    boolean existsByUserIdAndTransactionIdIgnoreCaseAndDeletedAtIsNullAndIdNot(Long userId, String transactionId, Long id);
    void deleteByUserIdAndBusinessId(Long userId, Long businessId);

    @Query("""
            SELECT r FROM CustomerRecord r
            WHERE r.userId = :userId
              AND r.deletedAt IS NULL
              AND (:businessId IS NULL OR r.businessId = :businessId)
              AND (:startDate IS NULL
                   OR (r.paidAt IS NOT NULL AND r.paidAt >= :startDate)
                   OR (r.paidAt IS NULL AND r.createdAt >= :startInstant))
              AND (:endDate IS NULL
                   OR (r.paidAt IS NOT NULL AND r.paidAt <= :endDate)
                   OR (r.paidAt IS NULL AND r.createdAt <= :endInstant))
            ORDER BY r.paidAt ASC, r.createdAt ASC, r.id ASC
            """)
    List<CustomerRecord> findForReports(
            @Param("userId") Long userId,
            @Param("businessId") Long businessId,
            @Param("startDate") LocalDate startDate,
            @Param("startInstant") Instant startInstant,
            @Param("endDate") LocalDate endDate,
            @Param("endInstant") Instant endInstant
    );
}

