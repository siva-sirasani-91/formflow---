package com.formflow.repository;

import com.formflow.entity.Business;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface BusinessRepository extends JpaRepository<Business, Long> {
    List<Business> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long userId);
    List<Business> findByUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(Long userId);
    Optional<Business> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);
    Optional<Business> findByIdAndUserId(Long id, Long userId);
    boolean existsByUserIdAndNameIgnoreCaseAndDeletedAtIsNull(Long userId, String name);
    boolean existsByUserIdAndNameIgnoreCaseAndDeletedAtIsNullAndIdNot(Long userId, String name, Long id);
}
