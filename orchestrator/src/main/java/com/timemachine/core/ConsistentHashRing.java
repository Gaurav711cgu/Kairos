package com.timemachine.core;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.logging.Logger;

/**
 * Staff-Level Distributed Systems: Consistent Hash Ring with Virtual Nodes.
 *
 * ============================================================
 * WHY CONSISTENT HASHING?
 * ============================================================
 * The naive approach to distributing keys across N nodes is:
 *     node = hash(key) % N
 *
 * This is catastrophically fragile. When a node is added or removed,
 * almost EVERY key remaps to a different node, causing a massive cache
 * miss storm or data migration event.
 *
 * Amazon DynamoDB (2007 Dynamo paper), Apache Cassandra, and Redis Cluster
 * all use Consistent Hashing instead. When a node is added or removed,
 * on average only K/N keys need to remigrate (where K = total keys, N = nodes).
 *
 * ============================================================
 * HOW THE RING WORKS
 * ============================================================
 * 1. Imagine a circular hash space [0, 2^32) arranged as a ring.
 * 2. Each physical node is hashed to a position on the ring.
 * 3. A key is assigned to the first node clockwise from its hash position.
 *
 * ============================================================
 * VIRTUAL NODES (VNODES) — THE CRITICAL UPGRADE
 * ============================================================
 * With just 1 position per physical node, the load distribution is
 * extremely uneven due to hash collisions and clustering.
 *
 * Solution: Each physical node gets VIRTUAL_NODES_PER_SERVER positions
 * on the ring (e.g., 150 virtual nodes). This:
 *   - Spreads load almost uniformly (standard deviation drops dramatically)
 *   - Allows heterogeneous nodes (a bigger server gets more vnodes)
 *   - Handles node failures gracefully with fine-grained key redistribution
 *
 * This is exactly how Cassandra's vnode architecture works (default: 256 vnodes).
 *
 * ============================================================
 * REPLICATION
 * ============================================================
 * The getReplicaNodes(key, replicationFactor) method walks N clockwise
 * positions on the ring, collecting DISTINCT physical nodes.
 * This mirrors DynamoDB's replication strategy: every key is stored
 * on the next N distinct physical nodes clockwise.
 *
 * KAIROS USE CASE:
 * Used to shard the state snapshot buffer across multiple capture agents,
 * ensuring no single agent is a hotspot and that replays can be reconstructed
 * even if an agent node fails.
 */
public class ConsistentHashRing {

    private static final Logger logger = Logger.getLogger(ConsistentHashRing.class.getName());

    // Number of virtual node positions per physical server.
    // Higher = better load balance but more memory. 150 is the Cassandra default.
    private static final int VIRTUAL_NODES_PER_SERVER = 150;

    // The ring: sorted map of hash position -> physical node name.
    // TreeMap uses a Red-Black Tree internally: O(log N) for all operations.
    private final TreeMap<Long, String> ring = new TreeMap<>();

    // Tracks which physical nodes are currently on the ring.
    private final Set<String> physicalNodes = new HashSet<>();

    // ReadWriteLock: allows concurrent reads but exclusive writes.
    // This is the correct pattern for a read-heavy, write-rare data structure.
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    // MD5 gives us a 128-bit hash space. We use the first 32 bits as a long.
    private final MessageDigest md5;

    public ConsistentHashRing() {
        try {
            this.md5 = MessageDigest.getInstance("MD5");
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 not available on this JVM", e);
        }
    }

    /**
     * Adds a physical node to the ring by placing VIRTUAL_NODES_PER_SERVER
     * virtual nodes at deterministic positions derived from the node name.
     *
     * Time complexity: O(V * log(V*N)) where V = vnodes, N = physical nodes.
     */
    public void addNode(String nodeName) {
        lock.writeLock().lock();
        try {
            if (physicalNodes.contains(nodeName)) {
                logger.warning("Node already on ring: " + nodeName);
                return;
            }
            physicalNodes.add(nodeName);

            for (int i = 0; i < VIRTUAL_NODES_PER_SERVER; i++) {
                // Deterministic vnode key: "node-name#vnode-0", "node-name#vnode-1", ...
                long hashPosition = hash(nodeName + "#vnode-" + i);
                ring.put(hashPosition, nodeName);
            }
            logger.info("Added node: " + nodeName + " (" + VIRTUAL_NODES_PER_SERVER +
                        " vnodes). Ring size: " + ring.size() + " positions.");
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Removes a physical node and all its virtual nodes from the ring.
     * Keys previously owned by this node will automatically remap to the
     * next clockwise node — no global rehashing required.
     */
    public void removeNode(String nodeName) {
        lock.writeLock().lock();
        try {
            if (!physicalNodes.remove(nodeName)) {
                logger.warning("Node not found on ring: " + nodeName);
                return;
            }
            for (int i = 0; i < VIRTUAL_NODES_PER_SERVER; i++) {
                ring.remove(hash(nodeName + "#vnode-" + i));
            }
            logger.info("Removed node: " + nodeName + ". Ring size: " + ring.size() + " positions.");
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Returns the responsible physical node for a given key.
     * Finds the first virtual node clockwise from the key's hash position.
     *
     * Time complexity: O(log(V*N)) — single TreeMap.ceilingKey() call.
     */
    public Optional<String> getNode(String key) {
        lock.readLock().lock();
        try {
            if (ring.isEmpty()) return Optional.empty();

            long keyHash = hash(key);

            // Find the first ring position >= keyHash (clockwise lookup)
            Map.Entry<Long, String> entry = ring.ceilingEntry(keyHash);

            // Wrap around: if no position found clockwise, use the first node on the ring
            if (entry == null) {
                entry = ring.firstEntry();
            }

            return Optional.of(entry.getValue());
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Returns N distinct physical nodes responsible for replicating a key.
     *
     * Walks clockwise from the key's hash position, collecting unique physical
     * nodes until we have `replicationFactor` nodes or exhaust the ring.
     *
     * This is identical to DynamoDB's "preference list" construction from
     * the 2007 Dynamo paper (Section 4.3).
     *
     * @param key               The key to replicate
     * @param replicationFactor Number of distinct replicas to return (e.g., 3)
     * @return Ordered list of physical node names (primary first)
     */
    public List<String> getReplicaNodes(String key, int replicationFactor) {
        lock.readLock().lock();
        try {
            if (ring.isEmpty()) return Collections.emptyList();

            List<String> replicas = new ArrayList<>();
            long keyHash = hash(key);

            // Start from the primary node's position
            NavigableMap<Long, String> tailMap = ring.tailMap(keyHash, true);

            // Iterate clockwise: tailMap first, then wrap around to the full ring
            for (String node : tailMap.values()) {
                if (!replicas.contains(node)) {
                    replicas.add(node);
                }
                if (replicas.size() >= replicationFactor) return replicas;
            }

            // Wrap around the ring
            for (String node : ring.values()) {
                if (!replicas.contains(node)) {
                    replicas.add(node);
                }
                if (replicas.size() >= replicationFactor) return replicas;
            }

            return replicas;
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Returns load distribution statistics: how many keys (out of a sample)
     * each physical node would own. Used to verify vnode balance.
     *
     * In a perfectly balanced ring, each node should own ~(1/N) of keys.
     * With 150 vnodes, the standard deviation from ideal is typically <5%.
     */
    public Map<String, Integer> simulateKeyDistribution(int totalKeys) {
        Map<String, Integer> distribution = new HashMap<>();
        physicalNodes.forEach(n -> distribution.put(n, 0));

        for (int i = 0; i < totalKeys; i++) {
            String key = "key-" + i;
            getNode(key).ifPresent(node ->
                distribution.merge(node, 1, Integer::sum)
            );
        }
        return distribution;
    }

    public int getPhysicalNodeCount() {
        lock.readLock().lock();
        try {
            return physicalNodes.size();
        } finally {
            lock.readLock().unlock();
        }
    }

    public int getRingSize() {
        lock.readLock().lock();
        try {
            return ring.size();
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Deterministic MD5-based hash function.
     * Returns a positive long value within [0, 2^31) for use as ring position.
     *
     * We use MD5 (not Java's hashCode()) because MD5 distributes values
     * uniformly across the hash space regardless of string similarity,
     * preventing clustering of adjacent node names.
     */
    private synchronized long hash(String key) {
        md5.reset();
        byte[] digest = md5.digest(key.getBytes(StandardCharsets.UTF_8));
        // Combine first 4 bytes into a positive long
        long hash = ((long) (digest[3] & 0xFF) << 24)
                  | ((long) (digest[2] & 0xFF) << 16)
                  | ((long) (digest[1] & 0xFF) << 8)
                  | ((long) (digest[0] & 0xFF));
        return hash & 0xFFFFFFFFL; // Ensure positive value
    }
}
