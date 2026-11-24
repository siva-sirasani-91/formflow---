package com.formflow.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "user_settings")
public class UserSettings {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 10)
    private String language = "en";

    @Column(name = "phone_alerts", nullable = false)
    private boolean phoneAlerts = true;

    @Column(name = "email_receipts", nullable = false)
    private boolean emailReceipts = true;

    @Column(name = "two_factor_otp", nullable = false)
    private boolean twoFactorOtp = false;

    @Column(name = "daily_backup", nullable = false)
    private boolean dailyBackup = true;

    @Column(name = "last_backup_at")
    private Instant lastBackupAt;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public boolean isPhoneAlerts() { return phoneAlerts; }
    public void setPhoneAlerts(boolean phoneAlerts) { this.phoneAlerts = phoneAlerts; }
    public boolean isEmailReceipts() { return emailReceipts; }
    public void setEmailReceipts(boolean emailReceipts) { this.emailReceipts = emailReceipts; }
    public boolean isTwoFactorOtp() { return twoFactorOtp; }
    public void setTwoFactorOtp(boolean twoFactorOtp) { this.twoFactorOtp = twoFactorOtp; }
    public boolean isDailyBackup() { return dailyBackup; }
    public void setDailyBackup(boolean dailyBackup) { this.dailyBackup = dailyBackup; }
    public Instant getLastBackupAt() { return lastBackupAt; }
    public void setLastBackupAt(Instant lastBackupAt) { this.lastBackupAt = lastBackupAt; }
}
