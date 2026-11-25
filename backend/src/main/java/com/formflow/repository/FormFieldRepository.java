package com.formflow.repository;

import com.formflow.entity.FormField;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FormFieldRepository extends JpaRepository<FormField, Long> {
    List<FormField> findByBusinessIdOrderBySortOrderAscIdAsc(Long businessId);
    Optional<FormField> findByIdAndBusinessId(Long id, Long businessId);
    boolean existsByBusinessIdAndFieldNameIgnoreCase(Long businessId, String fieldName);
    boolean existsByBusinessIdAndFieldNameIgnoreCaseAndIdNot(Long businessId, String fieldName, Long id);
}
