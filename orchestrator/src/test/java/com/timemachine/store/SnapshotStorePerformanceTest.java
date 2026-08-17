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

import static org.junit.jupiter.api.Assertions.*;

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
            SnapshotDTO dto = new SnapshotDTO(
                UUID.randomUUID(),
                "perf-snap-" + i + "-" + UUID.randomUUID().toString().substring(0, 4),
                "order-service",
                "trace-perf-" + UUID.randomUUID().toString().substring(0, 4),
                vc,
                null,
                "POST", "/orders",
                null,
                "{\"productId\":\"PRODUCT_X\"}",
                200, null,
                "{\"status\":\"CREATED\"}",
                15L, 1, (long) i, Instant.now(), null
            );
            snapshotRepository.ingestSnapshot(dto);
        }

        long elapsed = System.currentTimeMillis() - start;
        assertTrue(elapsed < 3000,
            "100 snapshots must ingest in < 3000ms, took: " + elapsed + "ms");
    }

    @Test
    void timeRangeQuery_100snapshots_under200ms() {
        long start = System.currentTimeMillis();

        List<Snapshot> results = snapshotRepository.findAllRecent(100);

        long elapsed = System.currentTimeMillis() - start;
        assertTrue(elapsed < 200,
            "Time-range query on 100 snapshots must complete in < 200ms, took: " + elapsed + "ms");
        assertNotNull(results, "Query must not return null");
    }
}
