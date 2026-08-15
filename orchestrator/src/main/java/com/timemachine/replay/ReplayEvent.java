package com.timemachine.replay;

public record ReplayEvent(
    String snapshotId,
    String serviceId,
    int causalPosition,
    int capturedStatusCode,
    int replayStatusCode,
    long capturedLatencyMs,
    long replayLatencyMs,
    boolean statusCodeMatch
) {}
