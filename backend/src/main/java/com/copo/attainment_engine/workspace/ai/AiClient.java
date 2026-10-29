package com.copo.attainment_engine.workspace.ai;

import com.copo.attainment_engine.common.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

import java.net.SocketTimeoutException;
import java.time.Duration;

/**
 * Calls Mayuri's academic AI service (FastAPI). The frontend never calls it directly;
 * Spring Boot builds the context from saved data, sends {@code X-Internal-Token} and
 * checks the answer. Errors become the contract's AI codes (§18).
 */
@Component
public class AiClient {

    private static final Logger log = LoggerFactory.getLogger(AiClient.class);

    private final RestClient http;

    public AiClient(@Value("${app.ai.base-url}") String baseUrl, @Value("${app.ai.internal-token:}") String token) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(120));
        RestClient.Builder b = RestClient.builder().baseUrl(baseUrl).requestFactory(factory);
        if (!token.isBlank()) b.defaultHeader("X-Internal-Token", token);
        this.http = b.build();
    }

    /** POSTs {@code body} and returns the {@code data} of the AI service's envelope; retries once on a timeout or 5xx. */
    public JsonNode post(String path, Object body) {
        try {
            return once(path, body);
        } catch (ApiException e) {
            if (e.status() == HttpStatus.BAD_GATEWAY && "AI_OUTPUT_INVALID".equals(e.errorCode())) throw e;
            if (e.status().is5xxServerError()) return once(path, body);
            throw e;
        }
    }

    private JsonNode once(String path, Object body) {
        try {
            JsonNode res = http.post().uri(path).body(body).retrieve().body(JsonNode.class);
            if (res == null || !res.path("success").asBoolean(false) || res.path("data").isNull()) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_SERVICE_UNAVAILABLE", "The AI service gave an empty answer. Try again.");
            }
            return res.get("data");
        } catch (RestClientResponseException e) {
            log.warn("AI service {} answered {}: {}", path, e.getStatusCode(), e.getResponseBodyAsString());
            if (e.getStatusCode().value() == 504) {
                throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "UPSTREAM_TIMEOUT", "The AI took too long to answer. Try again.");
            }
            if (e.getStatusCode().is4xxClientError()) {
                // A rule the service checks itself, e.g. a CO without a unit (422).
                String message = messageOf(e);
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "PRECONDITION_FAILED",
                        message != null ? message : "The AI service couldn't use this course's data.");
            }
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_SERVICE_UNAVAILABLE", "The AI service isn't available right now. Try again.");
        } catch (ResourceAccessException e) {
            boolean timeout = e.getCause() instanceof SocketTimeoutException;
            log.warn("AI service {} unreachable: {}", path, e.getMessage());
            throw timeout
                    ? new ApiException(HttpStatus.GATEWAY_TIMEOUT, "UPSTREAM_TIMEOUT", "The AI took too long to answer. Try again.")
                    : new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_SERVICE_UNAVAILABLE", "The AI service isn't running. Start it and try again.");
        }
    }

    private static String messageOf(RestClientResponseException e) {
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            return body == null ? null : body.path("message").asString(null);
        } catch (RuntimeException ignored) {
            return null;
        }
    }
}
