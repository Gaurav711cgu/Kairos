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
    int schemaVersion,
    long sequenceNum,
    Instant capturedAt
) {}
