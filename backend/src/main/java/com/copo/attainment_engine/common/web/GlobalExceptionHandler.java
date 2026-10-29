package com.copo.attainment_engine.common.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Turns every failure into the contract's {@link ApiError} envelope (API_CONTRACT §2.2, §18). */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> api(ApiException e) {
        return ResponseEntity.status(e.status()).body(ApiError.of(e.errorCode(), e.getMessage(), e.fieldErrors()));
    }

    /** Bean Validation on a request body: one message per field path. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors().forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
        return ResponseEntity.badRequest().body(ApiError.of("VALIDATION_FAILED", "Check the highlighted fields.", fields));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> unreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(ApiError.of("VALIDATION_FAILED", "The request body isn't valid."));
    }

    @ExceptionHandler(TypeMismatchException.class)
    ResponseEntity<ApiError> mismatch(TypeMismatchException e) {
        return ResponseEntity.badRequest().body(ApiError.of("VALIDATION_FAILED", "The request isn't valid."));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<ApiError> duplicate(DuplicateKeyException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of("DUPLICATE_RECORD", "That record already exists."));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> denied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of("FORBIDDEN", "You don't have access to this."));
    }

    /** Thrown by the academic and faculty CRUD services; their reason is a user-facing message. */
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ApiError> status(ResponseStatusException e) {
        String code = e.getStatusCode().value() == 404 ? "NOT_FOUND" : e.getStatusCode().is4xxClientError() ? "VALIDATION_FAILED" : "INTERNAL_ERROR";
        return ResponseEntity.status(e.getStatusCode()).body(ApiError.of(code, e.getReason() != null ? e.getReason() : "The request failed."));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception e) {
        // Spring's own errors (unknown path, wrong method, missing parameter…) carry their status.
        if (e instanceof ErrorResponse er && !er.getStatusCode().is5xxServerError()) {
            HttpStatusCode status = er.getStatusCode();
            String code = switch (status.value()) {
                case 404, 405 -> "NOT_FOUND";
                case 413 -> "FILE_TOO_LARGE";
                case 415 -> "UNSUPPORTED_FILE_TYPE";
                default -> "VALIDATION_FAILED";
            };
            String message = code.equals("NOT_FOUND") ? "Not found." : "The request isn't valid.";
            return ResponseEntity.status(status).body(ApiError.of(code, message));
        }
        String traceId = UUID.randomUUID().toString();
        log.error("Unhandled error {}", traceId, e);
        return ResponseEntity.internalServerError().body(ApiError.internal(traceId));
    }
}
