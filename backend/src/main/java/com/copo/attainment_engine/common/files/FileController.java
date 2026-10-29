package com.copo.attainment_engine.common.files;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

/** Serves an {@link FileService.ExportFile}'s {@code downloadUrl}; the token in the link is the permission. */
@RestController
public class FileController {

    private final FileService files;

    public FileController(FileService files) {
        this.files = files;
    }

    @GetMapping("/api/v1/files/{fileId}")
    public ResponseEntity<byte[]> download(@PathVariable String fileId, @RequestParam String token) {
        FileService.StoredFile f = files.download(fileId, token);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(f.mimeType))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(f.fileName, StandardCharsets.UTF_8).build().toString())
                .body(f.content);
    }
}
