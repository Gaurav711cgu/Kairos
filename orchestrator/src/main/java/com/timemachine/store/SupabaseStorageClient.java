package com.timemachine.store;

import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import java.util.concurrent.CompletableFuture;

@Service
public class SupabaseStorageClient {
    private final S3Client s3;
    private final String bucket;
    
    public SupabaseStorageClient() {
        this.s3 = null;
        this.bucket = "snapshots";
    }
    
    public CompletableFuture<String> uploadSnapshot(String key, byte[] compressedPayload) {
        return CompletableFuture.completedFuture(key);
    }
    
    public byte[] downloadSnapshot(String key) {
        return new byte[0];
    }
}
