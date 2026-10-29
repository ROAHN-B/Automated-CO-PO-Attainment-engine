package com.copo.attainment_engine.common.security;

import com.copo.attainment_engine.auth.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/** Issues signed access tokens carrying the user's ID, email and roles. */
@Service
public class TokenService {

    public record IssuedToken(String value, Instant expiresAt) {}

    private final JwtEncoder encoder;
    private final Duration ttl;

    public TokenService(JwtEncoder encoder, @Value("${app.jwt.ttl:PT8H}") Duration ttl) {
        this.encoder = encoder;
        this.ttl = ttl;
    }

    public IssuedToken issue(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttl);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("attainment-engine")
                .subject(user.getId())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("email", user.getEmail())
                .claim("roles", user.getRoles().stream().map(Enum::name).sorted().toList())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return new IssuedToken(encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue(), expiresAt);
    }
}
