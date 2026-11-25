package com.formflow.service;

import com.formflow.dto.AuthDtos.*;
import com.formflow.entity.PasswordResetToken;
import com.formflow.entity.User;
import com.formflow.entity.UserSettings;
import com.formflow.repository.PasswordResetTokenRepository;
import com.formflow.repository.UserRepository;
import com.formflow.repository.UserSettingsRepository;
import com.formflow.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final UserSettingsRepository settingsRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final SecureRandom random = new SecureRandom();

    public AuthService(
            UserRepository userRepository,
            UserSettingsRepository settingsRepository,
            PasswordResetTokenRepository tokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.settingsRepository = settingsRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (req.password() == null || req.password().length() < 8 || !req.password().matches("^(?=.*[A-Za-z])(?=.*\\d).+$")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password must be at least 8 characters and include both letters and numbers."
            );
        }
        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists.");
        }

        User user = new User();
        user.setFullName(req.fullName().trim());
        user.setEmail(email);
        user.setPhone("");
        user.setAadhaar("");
        user.setPhotoDataUrl("");
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole("OWNER");

        User saved = userRepository.save(user);

        UserSettings defaults = new UserSettings();
        defaults.setUserId(saved.getId());
        settingsRepository.save(defaults);

        String jwt = jwtService.generateToken(saved.getId(), saved.getEmail(), 60L * 60 * 24 * 7);
        return new AuthResponse("Account created successfully.", jwt, toResponse(saved));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmailIgnoreCase(req.email().trim())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid email or password. Please check your credentials."
                ));

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid email or password. Please check your credentials."
            );
        }

        long ttl = req.rememberMe() ? 60L * 60 * 24 * 30 : 60L * 60 * 24;
        String jwt = jwtService.generateToken(user.getId(), user.getEmail(), ttl);
        return new AuthResponse("Signed in successfully.", jwt, toResponse(user));
    }

    public Map<String, String> logout() {
        return Map.of("message", "Signed out successfully.");
    }

    @Transactional
    public MessageResponse forgotPassword(ForgotPasswordRequest req) {
        User user = userRepository.findByEmailIgnoreCase(req.email().trim()).orElse(null);
        String generatedToken = null;

        if (user != null) {
            tokenRepository.deleteByUserId(user.getId());
            byte[] bytes = new byte[24];
            random.nextBytes(bytes);
            generatedToken = HexFormat.of().formatHex(bytes);

            PasswordResetToken resetToken = new PasswordResetToken();
            resetToken.setToken(generatedToken);
            resetToken.setUser(user);
            resetToken.setExpiresAt(Instant.now().plusSeconds(1800));
            resetToken.setUsed(false);
            tokenRepository.save(resetToken);
        }

        return new MessageResponse(
                "If an account matches this email, recovery instructions have been generated.",
                generatedToken
        );
    }

    @Transactional
    public MessageResponse resetPassword(ResetPasswordRequest req) {
        PasswordResetToken resetToken = tokenRepository.findByToken(req.token().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "This password reset link is invalid or has expired."));

        if (resetToken.isUsed() || resetToken.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This password reset link is invalid or has expired.");
        }

        if (req.newPassword() == null || req.newPassword().length() < 8 || !req.newPassword().matches("^(?=.*[A-Za-z])(?=.*\\d).+$")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "New password must be at least 8 characters and include both letters and numbers."
            );
        }
        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        resetToken.setUsed(true);
        tokenRepository.save(resetToken);

        return new MessageResponse("Your password has been updated. You can now sign in.", null);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized session."));
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(String bearerToken) {
        if (bearerToken == null || !bearerToken.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized session.");
        }
        try {
            Long userId = jwtService.extractUserId(bearerToken.substring(7).trim());
            return getCurrentUserById(userId);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token.");
        }
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone() != null ? user.getPhone() : "",
                user.getAadhaar() != null ? user.getAadhaar() : "",
                user.getPhotoDataUrl() != null ? user.getPhotoDataUrl() : "",
                user.getRole(),
                user.getCreatedAt()
        );
    }
}
