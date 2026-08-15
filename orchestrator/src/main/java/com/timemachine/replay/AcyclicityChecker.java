package com.timemachine.replay;

import com.timemachine.clock.CausalRelation;
import com.timemachine.store.Snapshot;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class AcyclicityChecker {

    /**
     * Checks if the happens-before graph of snapshots has any causal cycles.
     * Uses 3-color DFS (WHITE=0, GRAY=1, BLACK=2).
     *
     * @param snapshots list of snapshots
     * @return Optional containing the list of snapshot IDs in the cycle if one exists, or empty Optional if acyclic.
     */
    public Optional<List<String>> findCycle(List<Snapshot> snapshots) {
        if (snapshots == null || snapshots.size() <= 1) {
            return Optional.empty();
        }

        int n = snapshots.size();
        Map<String, Integer> idToIndex = new HashMap<>();
        for (int i = 0; i < n; i++) {
            idToIndex.put(snapshots.get(i).snapshotId(), i);
        }

        // Build adjacency list: u -> v if u HAPPENS_BEFORE v
        List<List<Integer>> adj = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            adj.add(new ArrayList<>());
        }

        for (int i = 0; i < n; i++) {
            Snapshot s1 = snapshots.get(i);
            for (int j = 0; j < n; j++) {
                if (i == j) continue;
                Snapshot s2 = snapshots.get(j);
                if (s1.vectorClock() != null && s2.vectorClock() != null) {
                    if (s1.vectorClock().compare(s2.vectorClock()) == CausalRelation.HAPPENS_BEFORE) {
                        adj.get(i).add(j);
                    }
                }
            }
        }

        int[] state = new int[n]; // 0=WHITE, 1=GRAY, 2=BLACK
        int[] parent = new int[n];
        Arrays.fill(parent, -1);

        for (int i = 0; i < n; i++) {
            if (state[i] == 0) {
                List<String> cycle = dfs(i, adj, state, parent, snapshots);
                if (cycle != null) {
                    return Optional.of(cycle);
                }
            }
        }

        return Optional.empty();
    }

    private List<String> dfs(int u, List<List<Integer>> adj, int[] state, int[] parent, List<Snapshot> snapshots) {
        state[u] = 1; // GRAY

        for (int v : adj.get(u)) {
            if (state[v] == 1) {
                // Cycle detected: backtrack from u to v
                List<String> cycle = new ArrayList<>();
                cycle.add(snapshots.get(v).snapshotId());
                int curr = u;
                while (curr != -1 && curr != v) {
                    cycle.add(snapshots.get(curr).snapshotId());
                    curr = parent[curr];
                }
                cycle.add(snapshots.get(v).snapshotId());
                Collections.reverse(cycle);
                return cycle;
            } else if (state[v] == 0) {
                parent[v] = u;
                List<String> cycle = dfs(v, adj, state, parent, snapshots);
                if (cycle != null) {
                    return cycle;
                }
            }
        }

        state[u] = 2; // BLACK
        return null;
    }
}
