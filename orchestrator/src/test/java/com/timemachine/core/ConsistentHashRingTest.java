package com.timemachine.core;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for ConsistentHashRing.
 * These tests verify the mathematical guarantees of consistent hashing
 * and are the exact questions Amazon/Google interviewers ask.
 */
class ConsistentHashRingTest {

    private ConsistentHashRing ring;

    @BeforeEach
    void setUp() {
        ring = new ConsistentHashRing();
    }

    @Test
    void testBasicNodeAssignment() {
        ring.addNode("node-1");
        ring.addNode("node-2");
        ring.addNode("node-3");

        Optional<String> node = ring.getNode("some-key");
        assertTrue(node.isPresent(), "Key must always map to some node");
        assertTrue(List.of("node-1", "node-2", "node-3").contains(node.get()));
    }

    @Test
    void testKeyStabilityOnNodeAddition() {
        // CORE GUARANTEE: adding a new node should only affect ~1/N keys
        ring.addNode("node-1");
        ring.addNode("node-2");

        // Record assignments before adding a third node
        int totalKeys = 10000;
        int changed = 0;
        String[] assignments = new String[totalKeys];
        for (int i = 0; i < totalKeys; i++) {
            assignments[i] = ring.getNode("key-" + i).orElse("");
        }

        // Add a new node
        ring.addNode("node-3");

        for (int i = 0; i < totalKeys; i++) {
            String newAssignment = ring.getNode("key-" + i).orElse("");
            if (!newAssignment.equals(assignments[i])) changed++;
        }

        double remappedFraction = (double) changed / totalKeys;
        System.out.printf("Keys remapped after adding node-3: %.2f%%%n", remappedFraction * 100);

        // With 3 nodes, ~1/3 of keys should remap. Allow ±10% tolerance.
        assertTrue(remappedFraction < 0.45,
            "Adding a node should remap at most ~45% of keys, got: " + remappedFraction);
    }

    @Test
    void testLoadBalance() {
        ring.addNode("node-A");
        ring.addNode("node-B");
        ring.addNode("node-C");

        Map<String, Integer> distribution = ring.simulateKeyDistribution(100000);
        int total = distribution.values().stream().mapToInt(Integer::intValue).sum();

        // Each node should own roughly 33.3% of keys with vnodes
        for (Map.Entry<String, Integer> entry : distribution.entrySet()) {
            double fraction = (double) entry.getValue() / total;
            System.out.printf("%s owns %.2f%% of keys%n", entry.getKey(), fraction * 100);
            assertTrue(fraction > 0.25 && fraction < 0.45,
                "Node " + entry.getKey() + " owns " + (fraction * 100) + "% — outside acceptable range");
        }
    }

    @Test
    void testReplicationReturnDistinctNodes() {
        ring.addNode("node-1");
        ring.addNode("node-2");
        ring.addNode("node-3");
        ring.addNode("node-4");

        List<String> replicas = ring.getReplicaNodes("my-transaction-key", 3);
        assertEquals(3, replicas.size(), "Should return exactly 3 replicas");

        // All replicas must be distinct physical nodes
        long distinctCount = replicas.stream().distinct().count();
        assertEquals(3, distinctCount, "All replica nodes must be distinct");
    }

    @Test
    void testNodeRemovalDoesNotBreakRing() {
        ring.addNode("node-1");
        ring.addNode("node-2");
        ring.addNode("node-3");
        ring.removeNode("node-2");

        // After removal, all keys must still resolve to a valid node
        for (int i = 0; i < 1000; i++) {
            Optional<String> node = ring.getNode("key-" + i);
            assertTrue(node.isPresent());
            assertNotEquals("node-2", node.get(), "Removed node must not be returned");
        }
    }

    @Test
    void testEmptyRingReturnsEmpty() {
        Optional<String> result = ring.getNode("any-key");
        assertTrue(result.isEmpty(), "Empty ring should return empty Optional");
    }
}
