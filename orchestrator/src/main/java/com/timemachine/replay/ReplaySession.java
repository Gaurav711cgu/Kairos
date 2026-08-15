package com.timemachine.replay;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ReplaySession(
    @JsonProperty("id") UUID id,
    @JsonProperty("sessionId") String sessionId,
    @JsonProperty("status") ReplayStatus status,
    @JsonProperty("services") List<String> services,
    @JsonProperty("events") List<ReplayEvent> events,
    @JsonProperty("dbDiffs") List<Map<String, Object>> dbDiffs,
    @JsonProperty("rcaReport") Map<String, Object> rcaReport,
    @JsonProperty("racingConditionDetected") boolean racingConditionDetected,
    @JsonProperty("errorMessage") String errorMessage,
    @JsonProperty("createdAt") Instant createdAt,
    @JsonProperty("updatedAt") Instant updatedAt
) {}
