// package com.formflow.config;

// import org.springframework.beans.factory.annotation.Value;
// import org.springframework.context.annotation.Bean;
// import org.springframework.context.annotation.Configuration;
// import org.springframework.web.cors.CorsConfiguration;
// import org.springframework.web.cors.CorsConfigurationSource;
// import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

// import java.util.Arrays;
// import java.util.List;

// @Configuration
// public class CorsConfig {

//     @Value("${app.cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173}")
//     private String allowedOriginsRaw;

//     @Bean
//     public CorsConfigurationSource corsConfigurationSource() {
//         List<String> origins = Arrays.stream(allowedOriginsRaw.split(","))
//                 .map(String::trim)
//                 .filter(s -> !s.isEmpty() && !"*".equals(s))
//                 .toList();

//         CorsConfiguration config = new CorsConfiguration();
//         config.setAllowedOrigins(origins.isEmpty() ? List.of("http://localhost:3000") : origins);
//         config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
//         config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
//         config.setExposedHeaders(List.of("Content-Disposition"));
//         config.setAllowCredentials(true);
//         config.setMaxAge(3600L);

//         UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
//         source.registerCorsConfiguration("/**", config);
//         return source;
//     }
// }

















package com.formflow.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

    @Value("${app.cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://192.168.137.1:3002}")
    private String allowedOriginsRaw;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> origins = Arrays.stream(allowedOriginsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty() && !"*".equals(s))
                .toList();

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origins.isEmpty()
                ? List.of("http://localhost:3000")
                : origins);

        config.setAllowedMethods(
                List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        );

        config.setAllowedHeaders(
                List.of("Authorization", "Content-Type", "Accept", "X-Requested-With")
        );

        config.setExposedHeaders(List.of("Content-Disposition"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", config);

        return source;
    }
}

