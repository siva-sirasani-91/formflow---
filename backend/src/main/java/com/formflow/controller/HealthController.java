package com.formflow.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final DataSource dataSource;

    public HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        try (Connection conn = dataSource.getConnection()) {
            boolean valid = conn.isValid(2);
            body.put("database", valid ? "CONNECTED" : "DEGRADED");
            if (!valid) {
                return ResponseEntity.status(503).body(body);
            }
        } catch (Exception ex) {
            body.put("status", "DOWN");
            body.put("database", "DISCONNECTED");
            return ResponseEntity.status(503).body(body);
        }
        return ResponseEntity.ok(body);
    }
}
