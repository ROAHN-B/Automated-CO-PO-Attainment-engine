package com.copo.attainment_engine.common.web;

import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * A rule the request broke, turned into an {@link ApiError} by the global handler.
 * Throw it from services: {@code throw ApiException.notFound("Course not found.")}.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;
    private final Map<String, String> fieldErrors;

    public ApiException(HttpStatus status, String errorCode, String message) {
        this(status, errorCode, message, null);
    }

    public ApiException(HttpStatus status, String errorCode, String message, Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.fieldErrors = fieldErrors;
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }

    /** 409 with a contract code: VERSION_CONFLICT, INVALID_STATE, ALREADY_FINALIZED, STAGE_LOCKED… */
    public static ApiException conflict(String errorCode, String message) {
        return new ApiException(HttpStatus.CONFLICT, errorCode, message);
    }

    public static ApiException precondition(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "PRECONDITION_FAILED", message);
    }

    public static ApiException validation(String message, Map<String, String> fieldErrors) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", message, fieldErrors);
    }

    public static ApiException versionConflict() {
        return conflict("VERSION_CONFLICT", "Someone else saved this since you opened it. Reload to see the changes.");
    }

    public HttpStatus status() { return status; }

    public String errorCode() { return errorCode; }

    public Map<String, String> fieldErrors() { return fieldErrors; }
}
