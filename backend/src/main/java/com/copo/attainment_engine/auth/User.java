package com.copo.attainment_engine.auth;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

/** A person who can sign in (API_CONTRACT §5). */
@Document(collection = "users")
public class User {

    public enum Role { SUPER_ADMIN, HOD, FACULTY, COORDINATOR }

    public enum Status { ACTIVE, INACTIVE, SUSPENDED, LOCKED }

    @Id
    private String id;
    /** Employee / faculty ID; optional, unique when set. */
    @Indexed(unique = true, sparse = true)
    private String userCode;
    private String fullName;
    /** Lower-case college email; the sign-in name. */
    @Indexed(unique = true)
    private String email;
    /** BCrypt hash; null until the user sets a password. */
    private String passwordHash;
    private Set<Role> roles = EnumSet.noneOf(Role.class);
    private Role primaryRole;
    /** The department the person belongs to; null for Super Admin. */
    private String departmentId;
    private Status status = Status.ACTIVE;
    private Instant lastLoginAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserCode() { return userCode; }
    public void setUserCode(String userCode) { this.userCode = userCode; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Set<Role> getRoles() { return roles; }
    public void setRoles(Set<Role> roles) { this.roles = roles; }
    public Role getPrimaryRole() { return primaryRole; }
    public void setPrimaryRole(Role primaryRole) { this.primaryRole = primaryRole; }
    public String getDepartmentId() { return departmentId; }
    public void setDepartmentId(String departmentId) { this.departmentId = departmentId; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }
}
