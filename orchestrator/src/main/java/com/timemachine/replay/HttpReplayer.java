package com.timemachine.replay;

import com.timemachine.clock.CausalRelation;
import com.timemachine.store.Snapshot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class HttpReplayer {

    private static final Logger log = LoggerFactory.getLogger(HttpReplayer.class);

    @Value("${spring.datasource.username:postgres}")
    private String dbUser;

    @Value("${spring.datasource.password:postgres}")
    private String dbPass;

    // Virtual threads for non-blocking HTTP socket dispatching
    private final ExecutorService virtualExecutor = Executors.newVirtualThreadPerTaskExecutor();

    // Dedicated platform thread pool for JDBC queries to avoid carrier thread pinning
    private final ExecutorService databaseIoPool = Executors.newFixedThreadPool(16, r -> {
        Thread t = new Thread(r, "kairos-db-io");
        t.setDaemon(true);
        return t;
    });

    private final HttpClient httpClient = HttpClient.newBuilder()
            .executor(virtualExecutor)
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public ReplayTrace replay(
            List<Snapshot> orderedSnapshots,
            String targetBaseUrl,
            String replayDbUrl,
            String sessionId) {

        if (orderedSnapshots == null || orderedSnapshots.isEmpty()) {
            log.warn("[{}] No snapshots found for replay. Cannot fabricate results. " +
                     "Ensure the capture agent is running and trigger-race.sh was executed " +
                     "before starting the replay.", sessionId);
            return new ReplayTrace(
                sessionId,
                List.of(),
                Map.of(),
                Map.of(),
                false,
                null,
                0.0
            );
        }

        log.info("[{}] Executing real distributed replay of {} snapshots against {}",
                sessionId, orderedSnapshots.size(), targetBaseUrl);

        // 1. Inspect real database state BEFORE replay
        Map<String, Object> dbBefore = queryDatabaseState(replayDbUrl);
        log.info("[{}] Real database state BEFORE replay: {}", sessionId, dbBefore);

        List<ReplayEvent> events = Collections.synchronizedList(new ArrayList<>());
        boolean vectorClockRaceDetected = false;
        String racingSnapshotId = null;

        // Check for causal concurrency across snapshots
        for (int i = 0; i < orderedSnapshots.size(); i++) {
            for (int j = i + 1; j < orderedSnapshots.size(); j++) {
                Snapshot s1 = orderedSnapshots.get(i);
                Snapshot s2 = orderedSnapshots.get(j);
                if (s1.vectorClock() != null && s2.vectorClock() != null) {
                    if (s1.vectorClock().compare(s2.vectorClock()) == CausalRelation.CONCURRENT) {
                        vectorClockRaceDetected = true;
                        racingSnapshotId = s1.snapshotId();
                        break;
                    }
                }
            }
            if (vectorClockRaceDetected) break;
        }

        // Build causal tiers from vector clock happens-before relationships
        Map<Integer, List<Snapshot>> tiers = buildCausalTiers(orderedSnapshots);

        // Execute tier by tier: concurrent snapshots within a tier fire simultaneously via Virtual Threads
        for (Map.Entry<Integer, List<Snapshot>> tierEntry : tiers.entrySet()) {
            int tierRank = tierEntry.getKey();
            List<Snapshot> tierSnapshots = tierEntry.getValue();
            log.info("[{}] Dispatching tier {} ({} concurrent requests) via Java 21 Virtual Threads",
                    sessionId, tierRank, tierSnapshots.size());

            List<CompletableFuture<Void>> futures = new ArrayList<>();
            for (Snapshot snap : tierSnapshots) {
                CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
                    ReplayEvent ev = executeRealHttpRequest(snap, targetBaseUrl, tierRank);
                    events.add(ev);
                }, virtualExecutor);
                futures.add(future);
            }

            // Await all concurrent requests in this causal tier before advancing
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        }

        // 2. Inspect real database state AFTER replay
        Map<String, Object> dbAfter = queryDatabaseState(replayDbUrl);
        log.info("[{}] Real database state AFTER replay: {}", sessionId, dbAfter);

        // Check if database stock went negative (real race condition triggered)
        boolean dbStateRaceDetected = false;
        try {
            Map<?, ?> invMap = (Map<?, ?>) dbAfter.get("inventory");
            if (invMap != null) {
                Map<?, ?> prodMap = (Map<?, ?>) invMap.get("PRODUCT_X");
                if (prodMap != null && prodMap.get("stock") instanceof Number num) {
                    if (num.intValue() < 0) {
                        dbStateRaceDetected = true;
                    }
                }
            }
        } catch (Exception ignored) {}

        boolean finalRaceDetected = vectorClockRaceDetected || dbStateRaceDetected;

        return new ReplayTrace(
            sessionId,
            new ArrayList<>(events),
            dbBefore,
            dbAfter,
            finalRaceDetected,
            racingSnapshotId,
            0.0
        );
    }

    public Map<Integer, List<Snapshot>> buildCausalTiers(List<Snapshot> snapshots) {
        // Topological sort: assign tier = length of longest happens-before chain
        // ending at each snapshot. Concurrent events get the same tier rank.
        Map<String, Integer> tierRank = new HashMap<>();

        for (Snapshot s : snapshots) {
            tierRank.put(s.snapshotId(), 0);
        }

        // For each snapshot, find the maximum tier of all snapshots that
        // happen-before it, then assign tier = max + 1
        for (Snapshot s : snapshots) {
            int maxPredecessorTier = -1;
            for (Snapshot other : snapshots) {
                if (other.snapshotId().equals(s.snapshotId())) continue;
                if (other.vectorClock() != null && s.vectorClock() != null) {
                    CausalRelation rel = other.vectorClock().compare(s.vectorClock());
                    if (rel == CausalRelation.HAPPENS_BEFORE) {
                        maxPredecessorTier = Math.max(maxPredecessorTier,
                            tierRank.getOrDefault(other.snapshotId(), 0));
                    }
                }
            }
            tierRank.put(s.snapshotId(), maxPredecessorTier + 1);
        }

        // Group by tier rank (TreeMap ensures ascending tier order)
        Map<Integer, List<Snapshot>> tiers = new TreeMap<>();
        for (Snapshot s : snapshots) {
            int rank = tierRank.getOrDefault(s.snapshotId(), 0);
            tiers.computeIfAbsent(rank, k -> new ArrayList<>()).add(s);
        }

        return tiers;
    }

    private ReplayEvent executeRealHttpRequest(Snapshot snap, String targetBaseUrl, int causalPosition) {
        String path = (snap.path() != null && !snap.path().isBlank()) ? snap.path() : "/orders";
        String method = (snap.method() != null && !snap.method().isBlank()) ? snap.method() : "POST";
        String body = snap.requestBody() != null ? snap.requestBody() : "{\"productId\":\"PRODUCT_X\",\"userId\":\"user-replay\"}";

        String fullUrl = targetBaseUrl.replaceAll("/+$", "") + (path.startsWith("/") ? path : "/" + path);
        int capturedStatus = snap.responseStatus() > 0 ? snap.responseStatus() : 200;
        long capturedLatency = snap.latencyMs() > 0 ? snap.latencyMs() : 25L;

        long t0 = System.currentTimeMillis();
        int replayStatus = 200;

        try {
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(fullUrl))
                    .header("Content-Type", "application/json")
                    .header("X-Trace-Id", snap.traceId() != null ? snap.traceId() : "replay")
                    .timeout(Duration.ofSeconds(10));

            if ("POST".equalsIgnoreCase(method)) {
                reqBuilder.POST(HttpRequest.BodyPublishers.ofString(body));
            } else if ("PUT".equalsIgnoreCase(method)) {
                reqBuilder.PUT(HttpRequest.BodyPublishers.ofString(body));
            } else if ("DELETE".equalsIgnoreCase(method)) {
                reqBuilder.DELETE();
            } else {
                reqBuilder.GET();
            }

            HttpResponse<String> resp = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            replayStatus = resp.statusCode();
            log.info("Replayed {} {} -> status: {}", method, fullUrl, replayStatus);

        } catch (Exception e) {
            log.warn("Replay HTTP request failed for {}: {}", fullUrl, e.getMessage());
            replayStatus = 0;
        }

        long replayLatency = System.currentTimeMillis() - t0;

        return new ReplayEvent(
            snap.snapshotId() != null ? snap.snapshotId() : UUID.randomUUID().toString(),
            snap.serviceId() != null ? snap.serviceId() : "order-service",
            causalPosition,
            capturedStatus,
            replayStatus,
            capturedLatency,
            replayLatency,
            (capturedStatus == replayStatus)
        );
    }

    private Map<String, Object> queryDatabaseState(String jdbcUrl) {
        Map<String, Object> state = new HashMap<>();
        Map<String, Object> inventory = new HashMap<>();

        try (Connection conn = DriverManager.getConnection(jdbcUrl, dbUser, dbPass);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT product_id, stock FROM inventory")) {

            while (rs.next()) {
                String productId = rs.getString("product_id");
                int stock = rs.getInt("stock");
                inventory.put(productId, Map.of("stock", stock));
            }
            state.put("inventory", inventory);

        } catch (Exception e) {
            log.warn("Could not query live DB state from {}: {}. Returning empty state.", jdbcUrl, e.getMessage());
            state.put("error", "Database query failed: " + e.getMessage());
        }

        return state;
    }
}
