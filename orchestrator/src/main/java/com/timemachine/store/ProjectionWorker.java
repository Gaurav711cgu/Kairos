package com.timemachine.store;

import com.timemachine.clock.CausalRelation;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ProjectionWorker {

    private static final Logger log = LoggerFactory.getLogger(ProjectionWorker.class);
    private final SnapshotRepository snapshotRepository;

    @Scheduled(fixedDelay = 5000)
    public void processNewSnapshots() {
        try {
            long lastSeq = snapshotRepository.getLastSequence();
            List<Snapshot> newSnapshots = snapshotRepository.findNewSinceSequence(lastSeq);
            if (newSnapshots.isEmpty()) {
                return;
            }

            // Group by traceId (representing logical sessions)
            Map<String, List<Snapshot>> byTrace = newSnapshots.stream()
                    .collect(Collectors.groupingBy(Snapshot::traceId));

            for (Map.Entry<String, List<Snapshot>> entry : byTrace.entrySet()) {
                String traceId = entry.getKey();
                List<Snapshot> snaps = entry.getValue();
                List<CausalOrderEntry> causalOrder = computeCausalOrder(snaps);
                snapshotRepository.updateCausalOrder(traceId, causalOrder);
            }

            long maxSeq = newSnapshots.stream()
                    .mapToLong(Snapshot::sequenceNum)
                    .max()
                    .orElse(lastSeq);

            snapshotRepository.updateCheckpoint(maxSeq);
            log.info("Projected {} new snapshots up to sequence_num={}", newSnapshots.size(), maxSeq);

        } catch (Exception e) {
            log.error("Error in ProjectionWorker background loop", e);
        }
    }

    private List<CausalOrderEntry> computeCausalOrder(List<Snapshot> snapshots) {
        int n = snapshots.size();
        if (n == 0) return List.of();
        if (n == 1) {
            return List.of(new CausalOrderEntry(snapshots.get(0).snapshotId(), 0));
        }

        int[] inDegree = new int[n];
        List<List<Integer>> adj = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            adj.add(new ArrayList<>());
        }

        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                if (i == j) continue;
                Snapshot s1 = snapshots.get(i);
                Snapshot s2 = snapshots.get(j);
                if (s1.vectorClock() != null && s2.vectorClock() != null) {
                    if (s1.vectorClock().compare(s2.vectorClock()) == CausalRelation.HAPPENS_BEFORE) {
                        adj.get(i).add(j);
                        inDegree[j]++;
                    }
                }
            }
        }

        // Kahn's algorithm with rank tracking for concurrent events
        Queue<Integer> queue = new LinkedList<>();
        int[] rank = new int[n];

        for (int i = 0; i < n; i++) {
            if (inDegree[i] == 0) {
                queue.add(i);
                rank[i] = 0;
            }
        }

        List<CausalOrderEntry> result = new ArrayList<>(n);
        while (!queue.isEmpty()) {
            int u = queue.poll();
            result.add(new CausalOrderEntry(snapshots.get(u).snapshotId(), rank[u]));

            for (int v : adj.get(u)) {
                inDegree[v]--;
                rank[v] = Math.max(rank[v], rank[u] + 1);
                if (inDegree[v] == 0) {
                    queue.add(v);
                }
            }
        }

        // Handle any nodes in cycles by appending with default rank
        if (result.size() < n) {
            Set<String> processed = result.stream().map(CausalOrderEntry::snapshotId).collect(Collectors.toSet());
            for (Snapshot s : snapshots) {
                if (!processed.contains(s.snapshotId())) {
                    result.add(new CausalOrderEntry(s.snapshotId(), 999));
                }
            }
        }

        return result;
    }
}
