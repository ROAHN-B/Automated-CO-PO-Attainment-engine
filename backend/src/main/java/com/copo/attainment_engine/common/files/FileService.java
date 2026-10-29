package com.copo.attainment_engine.common.files;

import com.copo.attainment_engine.common.web.ApiException;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Generated files (API_CONTRACT §2.6): stored for 10 minutes and handed out as an
 * {@link ExportFile} whose {@code downloadUrl} carries a random token, so a plain
 * link (no Authorization header) can download it.
 */
@Service
public class FileService {

    private static final Duration TTL = Duration.ofMinutes(10);
    private static final SecureRandom RANDOM = new SecureRandom();

    /** §2.6 ExportFile. */
    public record ExportFile(String fileId, String fileName, String mimeType, long sizeBytes, String downloadUrl, Instant expiresAt) {}

    @Document(collection = "exportFiles")
    public static class StoredFile {
        @Id public String id;
        public String fileName;
        public String mimeType;
        public byte[] content;
        public String token;
        /** Mongo removes the file once this passes. */
        @Indexed(expireAfter = "0s") public Instant expiresAt;
    }

    private final MongoTemplate mongo;

    public FileService(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    public ExportFile store(String fileName, String mimeType, byte[] content) {
        StoredFile f = new StoredFile();
        f.id = UUID.randomUUID().toString();
        f.fileName = fileName;
        f.mimeType = mimeType;
        f.content = content;
        byte[] token = new byte[24];
        RANDOM.nextBytes(token);
        f.token = Base64.getUrlEncoder().withoutPadding().encodeToString(token);
        f.expiresAt = Instant.now().plus(TTL);
        mongo.save(f);
        String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/files/{id}").queryParam("token", f.token).buildAndExpand(f.id).toUriString();
        return new ExportFile(f.id, fileName, mimeType, content.length, url, f.expiresAt);
    }

    /** The file, if the link's token matches and it hasn't expired. */
    public StoredFile download(String fileId, String token) {
        StoredFile f = mongo.findById(fileId, StoredFile.class);
        boolean ok = f != null && token != null && f.expiresAt.isAfter(Instant.now())
                && MessageDigest.isEqual(f.token.getBytes(), token.getBytes());
        if (!ok) throw ApiException.notFound("This download link has expired. Generate the file again.");
        return f;
    }
}
