# FormFlow Backend (Spring Boot 3 + JPA/Hibernate + MySQL)

This directory contains the Java 17 / Spring Boot REST API matching the frontend `/api/auth/*` endpoints.

## Prerequisites
- Java 17+
- Maven 3.9+
- MySQL 8.0+

## Setup & Run Locally
1. Update MySQL credentials in `src/main/resources/application.properties` (`spring.datasource.username` and `spring.datasource.password`).
2. Start MySQL (Hibernate creates `formflow_db` and tables automatically, or run `src/main/resources/schema.sql`).
3. Run the Spring Boot API:
   ```bash
   cd backend
   mvn spring-boot:run
   ```
4. To point the Vite React frontend directly to Spring Boot (`http://localhost:8080`), set `VITE_API_BASE_URL=http://localhost:8080` in `.env`.
