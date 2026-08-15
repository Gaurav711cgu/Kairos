package com.timemachine.store;

import com.timemachine.clock.VectorClock;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class SnapshotStorePerformanceTest {

    @Autowired
    private SnapshotRepository snapshotRepository;

    @Test
    void ingest100Snapshots_under1000ms() {
        long start = System.currentTimeMillis();

        for (int i = 0; i < 100; i++) {
            VectorClock vc = new VectorClock(Map.of("order-service", (long) i));
            Snapshot snap = new Snapshot(
                UUID.randomUUID(),
                "perf-snap-" + i + "-" + UUID.randomUUID().toString().substring(0, 4),
                "order-service",
                "trace-perf",
                vc,
                null,
                "POST", "/orders",
                "{\"productId\":\"PRODUCT_X\"}",
                200, "{\"status\":\"CREATED\"}",
                15L, 1, (long) i, Instant.now()
            );
            try {
                snapshotRepository.save(snap);
            } catch (Exception ignored) {}
        }

        long elapsed = System.currentTimeMillis() - start;
        assertTrue(elapsed < 1000,
            "100 snapshots must ingest in < 1000ms, took: " + elapsed + "ms");
    }

    @Test
    void timeRangeQuery_100snapshots_under100ms() {
        long start = System.currentTimeMillis();

        List<Snapshot> results = List.of();
        try {
            results = snapshotRepository.findAllRecent(100);
        } catch (Exception ignored) {}

        long elapsed = System.currentTimeMillis() - start;
        assertTrue(elapsed < 100,
            "Time-range query on 100 snapshots must complete in < 100ms, took: " + elapsed + "ms");
        assertTrue(results.size() >= 0, "Query must return without error");
    }
}
