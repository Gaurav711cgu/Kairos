package com.timemachine.store;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.timemachine.clock.VectorClock;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record SnapshotDTO(
    @JsonProperty("id") UUID id,
    @JsonProperty("snapshot_id") String snapshotId,
    @JsonProperty("service_id") String serviceId,
    @JsonProperty("trace_id") String traceId,
    @JsonProperty("vector_clock") VectorClock vectorClock,
    @JsonProperty("storage_key") String storageKey,
    @JsonProperty("method") String method,
    @JsonProperty("path") String path,
    @JsonProperty("request_headers") Map<String, Object> requestHeaders,
    @JsonProperty("request_body") String requestBody,
    @JsonProperty("response_status") Integer responseStatus,
    @JsonProperty("response_headers") Map<String, Object> responseHeaders,
    @JsonProperty("response_body") String responseBody,
    @JsonProperty("latency_ms") Long latencyMs,
    @JsonProperty("schema_version") int schemaVersion,
    @JsonProperty("sequence_num") long sequenceNum,
    @JsonProperty("captured_at") Instant capturedAt,
    @JsonProperty("payload") byte[] payload
) {
    @JsonCreator
    public SnapshotDTO {}
}
