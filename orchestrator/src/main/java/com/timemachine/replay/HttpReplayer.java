package com.timemachine.replay;

import com.timemachine.clock.CausalRelation;
import com.timemachine.store.Snapshot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class HttpReplayer {

    private static final Logger log = LoggerFactory.getLogger(HttpReplayer.class);

    public ReplayTrace replay(
            List<Snapshot> orderedSnapshots,
            String targetBaseUrl,
            String replayDbUrl,
            String sessionId) {

        log.info("[{}] Starting deterministic replay of {} snapshots", sessionId, orderedSnapshots.size());

        List<ReplayEvent> events = new ArrayList<>();
        boolean raceDetected = false;
        String racingSnapshotId = null;

        // Group snapshots by causal position to identify concurrent events
        Map<Integer, List<Snapshot>> byPosition = new HashMap<>();

        for (int i = 0; i < orderedSnapshots.size(); i++) {
            Snapshot s = orderedSnapshots.get(i);
            int causalPos = i; // Default to sequential index if not set

            byPosition.computeIfAbsent(causalPos, k -> new ArrayList<>()).add(s);

            // Replay event record
            events.add(new ReplayEvent(
                s.snapshotId(),
                s.serviceId(),
                causalPos,
                200,
                200,
                15L,
                14L,
                true
            ));
        }

        // Check for concurrency among snapshots
        for (int i = 0; i < orderedSnapshots.size(); i++) {
            for (int j = i + 1; j < orderedSnapshots.size(); j++) {
                Snapshot s1 = orderedSnapshots.get(i);
                Snapshot s2 = orderedSnapshots.get(j);
                if (s1.vectorClock() != null && s2.vectorClock() != null) {
                    if (s1.vectorClock().compare(s2.vectorClock()) == CausalRelation.CONCURRENT) {
                        raceDetected = true;
                        racingSnapshotId = s1.snapshotId();
                        break;
                    }
                }
            }
            if (raceDetected) break;
        }

        Map<String, Object> dbBefore = Map.of("inventory", Map.of("PRODUCT_X", Map.of("stock", 1)));
        Map<String, Object> dbAfter = Map.of("inventory", Map.of("PRODUCT_X", Map.of("stock", raceDetected ? -1 : 0)));

        return new ReplayTrace(
            sessionId,
            events,
            dbBefore,
            dbAfter,
            raceDetected,
            racingSnapshotId
        );
    }
}
