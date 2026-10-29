package com.copo.attainment_engine.common.web;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

/** The error envelope of API_CONTRACT §2.2; {@code message} is always safe to show to a user. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(boolean success, String errorCode, String message, Map<String, String> fieldErrors,
                       String traceId, Instant timestamp) {

    public static ApiError of(String errorCode, String message) {
        return of(errorCode, message, null);
    }

    public static ApiError of(String errorCode, String message, Map<String, String> fieldErrors) {
        return new ApiError(false, errorCode, message, fieldErrors == null || fieldErrors.isEmpty() ? null : fieldErrors,
                null, Instant.now());
    }

    public static ApiError internal(String traceId) {
        return new ApiError(false, "INTERNAL_ERROR", "Something went wrong. Please try again.", null, traceId, Instant.now());
    }
}
