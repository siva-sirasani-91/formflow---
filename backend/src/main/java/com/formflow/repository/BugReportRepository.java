package com.formflow.repository;

import com.formflow.entity.BugReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BugReportRepository extends JpaRepository<BugReport, Long> {
    List<BugReport> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<BugReport> findByIdAndUserId(Long id, Long userId);
}
