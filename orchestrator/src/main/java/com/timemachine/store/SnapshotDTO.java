package com.timemachine.store;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.timemachine.clock.VectorClock;

import java.time.Instant;
import java.util.UUID;

public record SnapshotDTO(
    @JsonProperty("id") UUID id,
    @JsonProperty("snapshotId") String snapshotId,
    @JsonProperty("serviceId") String serviceId,
    @JsonProperty("traceId") String traceId,
    @JsonProperty("vectorClock") VectorClock vectorClock,
    @JsonProperty("storageKey") String storageKey,
    @JsonProperty("schemaVersion") int schemaVersion,
    @JsonProperty("sequenceNum") long sequenceNum,
    @JsonProperty("capturedAt") Instant capturedAt,
    @JsonProperty("payload") byte[] payload
) {
    @JsonCreator
    public SnapshotDTO {}
}
