package com.copo.attainment_engine.common.security;

import com.copo.attainment_engine.common.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/** The signed-in user's ID from the access token. */
public final class CurrentUser {

    private CurrentUser() {}

    public static String id() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) return jwt.getSubject();
        throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Sign in to continue.");
    }
}
