package com.copo.attainment_engine.auth;

import com.copo.attainment_engine.academic.repository.DepartmentRepository;
import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.common.security.CurrentUser;
import com.copo.attainment_engine.common.security.TokenService;
import com.copo.attainment_engine.common.web.ApiException;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** API_CONTRACT §5: AUTH-1 sign-in, AUTH-3 sign-out, AUTH-4 the signed-in user. */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SessionUser(String userId, String userCode, String fullName, String email, List<User.Role> roles,
                              User.Role primaryRole, String departmentId, String departmentName, String status) {}

    public record LoginResult(String accessToken, Instant expiresAt, SessionUser user) {}

    private static final String BAD_LOGIN = "The username or password is incorrect.";

    private final UserRepository users;
    private final DepartmentRepository departments;
    private final PasswordEncoder passwords;
    private final TokenService tokens;
    /** Compared against when the user doesn't exist, so both cases take the same time. */
    private final String dummyHash;

    public AuthController(UserRepository users, DepartmentRepository departments, PasswordEncoder passwords, TokenService tokens) {
        this.users = users;
        this.departments = departments;
        this.passwords = passwords;
        this.tokens = tokens;
        this.dummyHash = passwords.encode("not-a-real-password");
    }

    /** AUTH-1: a college email or a user code. Wrong user and wrong password get the same answer. */
    @PostMapping("/login")
    public ApiResponse<LoginResult> login(@Valid @RequestBody LoginRequest req) {
        String name = req.username().trim();
        Optional<User> found = name.contains("@") ? users.findByEmail(name.toLowerCase(Locale.ROOT)) : users.findByUserCode(name);
        String hash = found.map(User::getPasswordHash).orElse(null);
        boolean matches = passwords.matches(req.password(), hash != null ? hash : dummyHash) && hash != null;
        if (!matches || found.get().getStatus() == User.Status.INACTIVE) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", BAD_LOGIN);
        }
        User user = found.get();
        if (user.getStatus() != User.Status.ACTIVE) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_LOCKED", "This account is locked. Contact the administrator.");
        }
        user.setLastLoginAt(Instant.now());
        users.save(user);
        TokenService.IssuedToken token = tokens.issue(user);
        return ApiResponse.success(new LoginResult(token.value(), token.expiresAt(), sessionUser(user)));
    }

    /** AUTH-3: tokens are stateless; the client drops its copy. */
    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        return ApiResponse.success(null);
    }

    /** AUTH-4: read fresh from the database, so a role stored in the browser is never trusted. */
    @GetMapping("/me")
    public ApiResponse<SessionUser> me() {
        User user = users.findById(CurrentUser.id())
                .filter(u -> u.getStatus() == User.Status.ACTIVE)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Sign in to continue."));
        return ApiResponse.success(sessionUser(user));
    }

    private SessionUser sessionUser(User u) {
        String departmentName = u.getDepartmentId() == null ? null
                : departments.findById(u.getDepartmentId()).map(d -> d.getDepartmentName()).orElse(null);
        return new SessionUser(u.getId(), u.getUserCode(), u.getFullName(), u.getEmail(), u.getRoles().stream().sorted().toList(),
                u.getPrimaryRole(), u.getDepartmentId(), departmentName, u.getStatus().name());
    }
}
