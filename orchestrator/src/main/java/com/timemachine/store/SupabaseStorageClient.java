package com.timemachine.store;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Local filesystem snapshot storage backend.
 *
 * Stores compressed zstd snapshot payloads in a configurable directory.
 * Uses local disk as the storage medium -- no external cloud dependencies.
 * For cloud deployments, swap this implementation for S3/R2/Supabase without
 * changing the caller interface.
 */
@Service
public class SupabaseStorageClient {

    private static final Logger log = LoggerFactory.getLogger(SupabaseStorageClient.class);

    private final Path storageDir;
    private final ExecutorService ioExecutor;

    public SupabaseStorageClient(
            @Value("${storage.local-path:./snapshot-store}") String localPath) {
        this.storageDir = Path.of(localPath);
        this.ioExecutor = Executors.newFixedThreadPool(4, r -> {
            Thread t = new Thread(r, "snapshot-storage-io");
            t.setDaemon(true);
            return t;
        });
        try {
            Files.createDirectories(storageDir);
            log.info("Snapshot storage initialized at: {}", storageDir.toAbsolutePath());
        } catch (IOException e) {
            log.warn("Could not create snapshot storage directory: {}", e.getMessage());
        }
    }

    public CompletableFuture<String> uploadSnapshot(String key, byte[] compressedPayload) {
        if (key == null || compressedPayload == null || compressedPayload.length == 0) {
            return CompletableFuture.completedFuture(key);
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                String sanitizedKey = key.replaceAll("[^a-zA-Z0-9_\\-.]", "_");
                Path target = storageDir.resolve(sanitizedKey + ".zstd");
                Files.write(target, compressedPayload);
                log.debug("Stored snapshot payload: {} ({} bytes)", target, compressedPayload.length);
                return key;
            } catch (IOException e) {
                log.warn("Failed to store snapshot {}: {}", key, e.getMessage());
                return key;
            }
        }, ioExecutor);
    }

    public byte[] downloadSnapshot(String key) {
        if (key == null) {
            return new byte[0];
        }
        try {
            String sanitizedKey = key.replaceAll("[^a-zA-Z0-9_\\-.]", "_");
            Path target = storageDir.resolve(sanitizedKey + ".zstd");
            if (Files.exists(target)) {
                return Files.readAllBytes(target);
            }
            log.warn("Snapshot not found in local store: {}", target);
            return new byte[0];
        } catch (IOException e) {
            log.warn("Failed to read snapshot {}: {}", key, e.getMessage());
            return new byte[0];
        }
    }
}
