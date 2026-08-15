package com.timemachine.replay;

import java.util.List;
import java.util.Map;

public record ReplayTrace(
    String sessionId,
    List<ReplayEvent> events,
    Map<String, Object> dbStateBefore,
    Map<String, Object> dbStateAfter,
    boolean racingConditionDetected,
    String racingSnapshotId,
    double anomalyScore
) {
    public ReplayTrace(
        String sessionId,
        List<ReplayEvent> events,
        Map<String, Object> dbStateBefore,
        Map<String, Object> dbStateAfter,
        boolean racingConditionDetected,
        String racingSnapshotId
    ) {
        this(sessionId, events, dbStateBefore, dbStateAfter, racingConditionDetected, racingSnapshotId, 0.0);
    }
}
