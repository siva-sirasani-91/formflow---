package com.formflow.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;

public class WorkspaceDtos {

    public record BugReportRequest(
            @NotBlank(message = "Bug report title is required.")
            @Size(min = 3, max = 200, message = "Title must be between 3 and 200 characters.")
            String title,

            @Size(max = 30, message = "Severity must be 30 characters or fewer.")
            String severity,

            @Size(max = 255, message = "Page URL must be 255 characters or fewer.")
            String pageUrl,

            String stepsToReproduce,

            @NotBlank(message = "Bug description is required.")
            @Size(min = 10, max = 5000, message = "Description must be between 10 and 5000 characters.")
            String description
    ) {}

    public record BugReportStatusRequest(
            @NotBlank(message = "Status is required.")
            String status
    ) {}

    public record UserFeedbackRequest(
            @NotNull(message = "Rating is required.")
            @Min(value = 1, message = "Rating must be between 1 and 5.")
            @Max(value = 5, message = "Rating must be between 1 and 5.")
            Integer rating,

            @Size(max = 80, message = "Category must be 80 characters or fewer.")
            String category,

            @NotBlank(message = "Feedback message is required.")
            @Size(min = 5, max = 5000, message = "Feedback message must be between 5 and 5000 characters.")
            String message
    ) {}

    public record FormFieldRequest(
            String fieldName,

            @NotBlank(message = "Field label is required.")
            @Size(min = 1, max = 160, message = "Field label must be between 1 and 160 characters.")
            String label,

            @NotBlank(message = "Field type is required.")
            String type,

            boolean required,
            List<String> options,
            List<Map<String, Object>> columns,
            Integer sortOrder
    ) {}
}
