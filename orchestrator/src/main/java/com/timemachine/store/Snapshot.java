package com.timemachine.store;

import com.timemachine.clock.VectorClock;
import java.time.Instant;
import java.util.UUID;

public record Snapshot(
    UUID id,
    String snapshotId,
    String serviceId,
    String traceId,
    VectorClock vectorClock,
    String storageKey,
    String method,
    String path,
    String requestBody,
    int responseStatus,
    String responseBody,
    long latencyMs,
    int schemaVersion,
    long sequenceNum,
    Instant capturedAt
) {}
