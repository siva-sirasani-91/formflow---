# FormFlow Backend (Spring Boot 3.3.5 + JPA/Hibernate + MySQL 8)

Complete layered Java 17 / Spring Boot 3.3.5 REST API serving as the single permanent source of truth for FormFlow. Supports both local MySQL 8 and cloud-hosted MySQL 8 (including Enzonic MySQL with TLS/SSL).

## Architecture
```
backend/src/main/java/com/formflow/
├── FormFlowApplication.java
├── config/
│   └── CorsConfig.java
├── controller/
│   ├── AuthController.java
│   ├── BusinessController.java
│   ├── CustomerRecordController.java
│   ├── HealthController.java
│   ├── ReportController.java
│   └── WorkspaceController.java
├── dto/
│   ├── AuthDtos.java
│   └── WorkspaceDtos.java
├── entity/
│   ├── BugReport.java
│   ├── Business.java
│   ├── CustomerRecord.java
│   ├── CustomerRepeatingRecord.java
│   ├── FormField.java
│   ├── PasswordResetToken.java
│   ├── SupportTicket.java
│   ├── User.java
│   ├── UserFeedback.java
│   └── UserSettings.java
├── exception/
│   └── GlobalExceptionHandler.java
├── repository/
│   ├── BugReportRepository.java
│   ├── BusinessRepository.java
│   ├── CustomerRecordRepository.java
│   ├── CustomerRepeatingRecordRepository.java
│   ├── FormFieldRepository.java
│   ├── PasswordResetTokenRepository.java
│   ├── SupportTicketRepository.java
│   ├── UserFeedbackRepository.java
│   ├── UserRepository.java
│   └── UserSettingsRepository.java
├── security/
│   ├── JwtAuthFilter.java
│   ├── JwtService.java
│   ├── RestAccessDeniedHandler.java
│   ├── RestAuthenticationEntryPoint.java
│   └── SecurityConfig.java
└── service/
    ├── AuthService.java
    ├── BusinessService.java
    ├── CustomerRecordService.java
    ├── ReportExportService.java
    ├── ReportService.java
    ├── UserWorkspaceService.java
    └── WorkspaceDtoMapper.java
```

## Prerequisites
- Java 17+
- Maven 3.9+
- MySQL 8.0+ (local or Enzonic Cloud MySQL)

## Database Setup
Apply `backend/src/main/resources/schema.sql` against your target MySQL 8 database:

```bash
# Local MySQL example:
mysql -u <username> -p -e "CREATE DATABASE IF NOT EXISTS formflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u <username> -p formflow_db < backend/src/main/resources/schema.sql

# Cloud MySQL (e.g., Enzonic with TLS/SSL):
mysql --ssl-mode=REQUIRED -h <host> -P <port> -u <username> -p <database> < backend/src/main/resources/schema.sql
```

Tables created: `users`, `password_reset_tokens`, `businesses`, `form_fields`, `customer_records`, `customer_repeating_records`, `user_settings`, `support_tickets`, `bug_reports`, `user_feedbacks`.

## Environment Variables
Set all credentials and secrets via environment variables (never commit secrets):

```bash
# Cloud MySQL (Enzonic) with TLS/SSL:
export DB_URL="jdbc:mysql://<host>:<port>/<database>?sslMode=REQUIRED&serverTimezone=UTC"
# Or Local MySQL:
# export DB_URL="jdbc:mysql://localhost:3306/formflow_db?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"

export DB_USERNAME="<your_db_username>"
export DB_PASSWORD="<your_db_password>"
export JWT_SECRET="<cryptographically-random-32-plus-char-secret>"
export FRONTEND_ORIGIN="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"
export SERVER_PORT="8080"
export JPA_DDL_AUTO="validate"   # use "update" if Hibernate should create/sync tables automatically
```

## Build & Run Commands
```bash
# Backend
cd backend
mvn clean compile
mvn spring-boot:run

# Verify Health & DB Connectivity
curl http://localhost:8080/api/health
```

```bash
# Frontend (from repository root, proxying /api -> Spring Boot)
npm install
SPRING_BACKEND_URL=http://localhost:8080 npm run dev
```

## REST API Reference

### Health (Public)
- `GET /api/health` — Checks application status and live MySQL connection.

### Authentication
- `POST /api/auth/register` *(Public)* — Registers a new user (BCrypt hash, duplicate email check, seeds default `user_settings`, returns JWT + user).
- `POST /api/auth/login` *(Public)* — Authenticates credentials and returns JWT + user.
- `POST /api/auth/logout` *(Public)* — Clean stateless logout acknowledgment.
- `POST /api/auth/forgot-password` *(Public)* — Generates 30-minute single-use password reset token.
- `POST /api/auth/reset-password` *(Public)* — Validates reset token and updates BCrypt password hash.
- `GET /api/auth/me` *(Protected)* — Returns authenticated user profile.

### Businesses & Dynamic Form Builder *(Protected — User-Scoped)*
- `GET /api/businesses` — List active & archived forms/businesses with configured fields.
- `GET /api/businesses/recycle-bin` — List soft-deleted businesses (30-day retention).
- `GET /api/businesses/{id}` — Retrieve single business & dynamic form configuration.
- `POST /api/businesses` — Create business with optional dynamic `fields[]`.
- `PUT /api/businesses/{id}` — Update business details and/or complete `fields[]` configuration.
- `POST /api/businesses/{id}/archive` — Archive business.
- `POST /api/businesses/{id}/activate` — Activate archived business.
- `POST /api/businesses/{id}/restore` — Restore archived or soft-deleted business.
- `DELETE /api/businesses/{id}` — Soft-delete business and its records into Recycle Bin.
- `DELETE /api/businesses/{id}/permanent` — Permanently delete business, records, and repeating rows.
- `GET /api/businesses/{id}/fields` — List fields for a specific business/form.
- `POST /api/businesses/{id}/fields` — Add a single field (`text`, `number`, `email`, `phone`, `textarea`, `select`/`dropdown`, `date`, `boolean`/`checkbox`, `table`).
- `PUT /api/businesses/{id}/fields/{fieldId}` — Update a specific field.
- `DELETE /api/businesses/{id}/fields/{fieldId}` — Delete a specific field.

### Customer Registrations & Records *(Protected — User-Scoped)*
- `GET /api/records` — List records (supports optional `?businessId=` and `?q=` filters).
- `GET /api/records/recycle-bin` — List soft-deleted records.
- `GET /api/records/{id}` — View record details including normalized repeating rows.
- `GET /api/records/{id}/repeating` — Retrieve normalized rows from `customer_repeating_records` (optional `?sectionFieldName=`).
- `POST /api/records` — Submit customer registration (validates required fields, repeating sections, and unique Online Transaction ID; saves to `customer_records` and `customer_repeating_records`).
- `PUT /api/records/{id}` — Update record and re-sync repeating rows.
- `DELETE /api/records/{id}` — Soft-delete record to Recycle Bin.
- `POST /api/records/{id}/restore` — Restore soft-deleted record.
- `DELETE /api/records/{id}/permanent` — Permanently delete record and repeating rows.

### Reports & Exports *(Protected — User-Scoped)*
- `GET /api/reports/overview` — Complete overview (summary KPIs, form/business summaries, field summaries, payments, customer history, date range, search, pagination).
- `GET /api/reports/table-records` — Repeating table report by `businessId` + `tableField` with date range, search, dynamic column totals, and pagination.
- `GET /api/reports/businesses` — Business-wise and form-wise report summary.
- `GET /api/reports/customers` — Paginated customer registration report with filters.
- `GET /api/reports/export/excel` — Downloads `.xlsx` workbook (Summary, Business Summary, Customer Records).
- `GET /api/reports/export/pdf` — Downloads `.pdf` report document.

### Profile, Settings, Support, Feedback & Search *(Protected — User-Scoped)*
- `GET /api/profile`, `PUT /api/profile`, `POST /api/profile/change-password`
- `GET /api/settings`, `PUT /api/settings`, `POST /api/settings/backup-now`
- `GET /api/tickets`, `POST /api/tickets`, `PATCH /api/tickets/{id}`
- `GET /api/bug-reports`, `POST /api/bug-reports`, `PATCH /api/bug-reports/{id}`
- `GET /api/feedback`, `POST /api/feedback`
- `GET /api/search?q=...`
