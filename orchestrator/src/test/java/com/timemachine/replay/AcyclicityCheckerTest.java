package com.timemachine.replay;

import com.timemachine.clock.VectorClock;
import com.timemachine.store.Snapshot;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class AcyclicityCheckerTest {

    private final AcyclicityChecker checker = new AcyclicityChecker();

    @Test
    void testAcyclicSnapshotsReturnEmpty() {
        Snapshot s1 = buildSnapshot("s1", new VectorClock(Map.of("A", 1L)));
        Snapshot s2 = buildSnapshot("s2", new VectorClock(Map.of("A", 2L)));
        assertTrue(checker.findCycle(List.of(s1, s2)).isEmpty());
    }

    @Test
    void testConcurrentEventsAreNotCycles() {
        // A={A:2, B:1} and B={A:1, B:2} are concurrent (neither happens-before the other)
        VectorClock vcA = new VectorClock(Map.of("A", 2L, "B", 1L));
        VectorClock vcB = new VectorClock(Map.of("A", 1L, "B", 2L));
        Snapshot s1 = buildSnapshot("s1", vcA);
        Snapshot s2 = buildSnapshot("s2", vcB);

        assertTrue(checker.findCycle(List.of(s1, s2)).isEmpty(),
            "Concurrent events must not be falsely detected as a cycle");
    }

    @Test
    void testLinearCausalChainIsAcyclic() {
        // A -> B -> C (strict happens-before chain)
        Snapshot s1 = buildSnapshot("s1", new VectorClock(Map.of("svc", 1L)));
        Snapshot s2 = buildSnapshot("s2", new VectorClock(Map.of("svc", 2L)));
        Snapshot s3 = buildSnapshot("s3", new VectorClock(Map.of("svc", 3L)));

        assertTrue(checker.findCycle(List.of(s1, s2, s3)).isEmpty(),
            "A linear happens-before chain must not produce a cycle");
    }

    @Test
    void testEmptyListReturnsNoCycle() {
        assertTrue(checker.findCycle(List.of()).isEmpty(),
            "Empty snapshot list must not produce a cycle");
    }

    @Test
    void testSingleSnapshotReturnsNoCycle() {
        Snapshot s = buildSnapshot("s1", new VectorClock(Map.of("A", 1L)));
        assertTrue(checker.findCycle(List.of(s)).isEmpty(),
            "A single snapshot must not produce a cycle");
    }

    @Test
    void testScaleGuardSkipsWhenAbove500Snapshots() {
        List<Snapshot> largeList = new ArrayList<>(600);
        for (int i = 0; i < 600; i++) {
            largeList.add(buildSnapshot("snap-" + i, new VectorClock(Map.of("A", (long) i))));
        }
        Optional<List<String>> result = checker.findCycle(largeList);
        assertTrue(result.isEmpty(), "Must skip cycle check and return empty when snapshot count > 500");
    }

    private Snapshot buildSnapshot(String id, VectorClock vc) {
        return new Snapshot(
            UUID.randomUUID(), id, "order-service", "trace-test", vc, null,
            "POST", "/orders", "{}", 200, "{}", 10L, 1, 1L, Instant.now()
        );
    }
}
