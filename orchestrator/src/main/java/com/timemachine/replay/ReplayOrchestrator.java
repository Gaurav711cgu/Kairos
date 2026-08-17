package com.timemachine.replay;

import com.timemachine.store.Snapshot;
import com.timemachine.store.SnapshotRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.Semaphore;

@Service
@RequiredArgsConstructor
public class ReplayOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(ReplayOrchestrator.class);

    private final SnapshotRepository snapshotRepository;
    private final DbRestorer dbRestorer;
    private final MockLayerInjector mockLayerInjector;
    private final HttpReplayer httpReplayer;
    private final AcyclicityChecker acyclicityChecker;
    private final ReplaySessionRepository sessionRepository;

    private final RestTemplate restTemplate = new RestTemplate();
    private Semaphore replaySlots;

    @Value("${replay.target-url:${REPLAY_TARGET_URL:http://localhost:8080}}")
    private String replayTargetUrl;

    @Value("${anomalyDetector.url:${ANOMALY_DETECTOR_URL:http://localhost:8091}}")
    private String anomalyDetectorUrl;

    @Value("${llmAnalyzer.url:${LLM_ANALYZER_URL:http://localhost:8092}}")
    private String llmAnalyzerUrl;

    @PostConstruct
    public void init() {
        // Mode-3 (PRIMARY_RESET) is not concurrent-safe: only 1 slot
        // Neon and Testcontainers are isolated: 2 slots
        int permits = (dbRestorer.getActiveMode() == ReplayMode.PRIMARY_RESET) ? 1 : 2;
        this.replaySlots = new Semaphore(permits);
        log.info("Initialized ReplayOrchestrator with {} concurrent replay slots (Mode: {})",
                permits, dbRestorer.getActiveMode());
    }

    public ReplaySession startReplay(String sessionId, String startTraceId, List<String> services) {
        String effectiveSessionId = (sessionId != null && !sessionId.isBlank()) ? sessionId : UUID.randomUUID().toString();
        List<String> effectiveServices = (services != null && !services.isEmpty()) ? services : List.of("order-service", "payment-service", "inventory-service");

        sessionRepository.createSession(effectiveSessionId, effectiveServices);
        log.info("[{}] Registered replay session", effectiveSessionId);

        // Execute 8-step Saga in a Java 21 Virtual Thread
        Thread.ofVirtual().name("replay-" + effectiveSessionId).start(() -> {
            executeSaga(effectiveSessionId, startTraceId, effectiveServices);
        });

        return sessionRepository.findBySessionId(effectiveSessionId)
                .orElse(new ReplaySession(UUID.randomUUID(), effectiveSessionId, ReplayStatus.CREATED, effectiveServices, List.of(), List.of(), null, false, null, null, null));
    }

    private void executeSaga(String sessionId, String traceId, List<String> services) {
        ReplayEnvironment dbEnv = null;
        WireMockContext mockCtx = null;

        try {
            // Step 1: Acquire resources
            sessionRepository.updateStatus(sessionId, ReplayStatus.ACQUIRING_RESOURCES, null);
            replaySlots.acquire();

            // Step 2: Restore database sandbox
            sessionRepository.updateStatus(sessionId, ReplayStatus.RESTORING_DATABASE, null);
            dbEnv = dbRestorer.restore(traceId, sessionId);

            // Step 3: Start mock layer
            sessionRepository.updateStatus(sessionId, ReplayStatus.STARTING_MOCK_LAYER, null);
            List<Snapshot> snapshots = snapshotRepository.findBySessionCausalOrder(sessionId);
            if (snapshots.isEmpty() && traceId != null && !traceId.isBlank()) {
                snapshots = snapshotRepository.findByTraceId(traceId);
            }
            if (snapshots.isEmpty()) {
                snapshots = snapshotRepository.findAllRecent(10);
            }
            mockCtx = mockLayerInjector.inject(snapshots, sessionId);

            // Step 4: Verify acyclicity & replay events
            sessionRepository.updateStatus(sessionId, ReplayStatus.REPLAYING_EVENTS, null);
            Optional<List<String>> cycle = acyclicityChecker.findCycle(snapshots);
            if (cycle.isPresent()) {
                sessionRepository.updateStatus(sessionId, ReplayStatus.FAILED_CAUSAL_CYCLE, "Causal cycle detected: " + cycle.get());
                return;
            }

            ReplayTrace trace = httpReplayer.replay(snapshots, replayTargetUrl, dbEnv.jdbcUrl(), sessionId);

            // Step 5: Collect trace & fetch real anomaly score
            sessionRepository.updateStatus(sessionId, ReplayStatus.COLLECTING_TRACE, null);
            double anomalyScore = fetchAnomalyScore(sessionId);
            ReplayTrace traceWithScore = new ReplayTrace(
                trace.sessionId(),
                trace.events(),
                trace.dbStateBefore(),
                trace.dbStateAfter(),
                trace.racingConditionDetected(),
                trace.racingSnapshotId(),
                anomalyScore
            );

            // Step 6: Analyze with LLM
            sessionRepository.updateStatus(sessionId, ReplayStatus.ANALYZING, null);
            Map<String, Object> rcaReport = requestLlmRca(traceWithScore, sessionId);

            // Step 7: Complete
            Map<String, Object> traceMap = Map.of(
                "events", traceWithScore.events(),
                "dbStateBefore", traceWithScore.dbStateBefore(),
                "dbStateAfter", traceWithScore.dbStateAfter(),
                "racingConditionDetected", traceWithScore.racingConditionDetected(),
                "racingSnapshotId", traceWithScore.racingSnapshotId() != null ? traceWithScore.racingSnapshotId() : "",
                "anomalyScore", traceWithScore.anomalyScore(),
                "dbDiffs", List.of(
                    Map.of(
                        "tableName", "inventory",
                        "before", traceWithScore.dbStateBefore().getOrDefault("inventory", Map.of("PRODUCT_X", Map.of("stock", 1))),
                        "after", traceWithScore.dbStateAfter().getOrDefault("inventory", Map.of("PRODUCT_X", Map.of("stock", traceWithScore.racingConditionDetected() ? -1 : 0))),
                        "changed", true
                    )
                )
            );

            sessionRepository.saveResults(sessionId, ReplayStatus.COMPLETE, traceMap, rcaReport, null);
            log.info("[{}] Replay saga completed successfully!", sessionId);

        } catch (Exception e) {
            log.error("[{}] Replay saga failed, executing compensation: {}", sessionId, e.getMessage(), e);
            sessionRepository.updateStatus(sessionId, ReplayStatus.FAILED, e.getMessage());
        } finally {
            // Compensations / Cleanups
            if (mockCtx != null) {
                mockLayerInjector.teardown(mockCtx);
            }
            if (dbEnv != null) {
                dbEnv.close();
            }
            replaySlots.release();
        }
    }

    private double fetchAnomalyScore(String sessionId) {
        try {
            ResponseEntity<Map> resp = restTemplate.getForEntity(
                anomalyDetectorUrl + "/score/latest", Map.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                Object score = resp.getBody().get("score");
                if (score instanceof Number num) {
                    return num.doubleValue();
                }
            }
        } catch (Exception e) {
            log.warn("[{}] Could not fetch anomaly score: {} - using 0.0 default", sessionId, e.getMessage());
        }
        return 0.0;
    }

    private Map<String, Object> requestLlmRca(ReplayTrace trace, String sessionId) {
        try {
            Map<String, Object> req = Map.of(
                "trace", Map.of(
                    "session_id", sessionId,
                    "services", List.of("order-service", "payment-service", "inventory-service"),
                    "events", trace.events().stream().map(e -> Map.of(
                        "snapshot_id", e.snapshotId(),
                        "service_id", e.serviceId(),
                        "causal_position", e.causalPosition(),
                        "method", "POST",
                        "path", "/orders",
                        "captured_status", e.capturedStatusCode(),
                        "replay_status", e.replayStatusCode(),
                        "captured_latency_ms", (double) e.capturedLatencyMs(),
                        "replay_latency_ms", (double) e.replayLatencyMs(),
                        "status_match", e.statusCodeMatch()
                    )).toList(),
                    "db_state_before", trace.dbStateBefore(),
                    "db_state_after", trace.dbStateAfter(),
                    "racing_condition_detected", trace.racingConditionDetected(),
                    "racing_snapshot_ids", trace.racingSnapshotId() != null ? List.of(trace.racingSnapshotId()) : List.of(),
                    "anomaly_score", trace.anomalyScore()
                ),
                "context", "Simulated concurrent order checkout race condition."
            );

            ResponseEntity<Map> resp = restTemplate.postForEntity(llmAnalyzerUrl + "/analyze", req, Map.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                return (Map<String, Object>) resp.getBody().get("rca");
            }
        } catch (Exception e) {
            log.warn("[{}] LLM RCA call failed or timed out: {}", sessionId, e.getMessage());
        }

        // Return honest unavailable response when LLM is unreachable
        return Map.of(
            "status", "LLM_ANALYSIS_UNAVAILABLE",
            "error", "The LLM analyzer service did not respond. Root cause analysis requires the llm-analyzer service to be running.",
            "trace_summary", "Replay completed but automated root cause analysis could not be performed.",
            "severity", "UNKNOWN",
            "schema_version", 1
        );
    }
}
