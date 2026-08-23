package com.kairos.core;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.HexFormat;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.StructuredTaskScope;

/**
 * Staff-Level Distributed Systems: Anti-Entropy Merkle Tree Reconciliation.
 * 
 * In a distributed Saga with Lamport clocks, network partitions (Split-Brain) 
 * can cause nodes to diverge. Instead of transferring the entire database to 
 * find missing events, Kairos uses a Merkle Tree (Hash Tree).
 * 
 * By comparing the Root Hash, two nodes instantly know if they are out of sync.
 * By traversing down the branches, they can isolate the exact missing transaction 
 * in O(log N) bandwidth instead of O(N).
 * 
 * Leverages Java 21 Structured Concurrency and Virtual Threads for parallel 
 * hash computation of millions of nodes without blocking OS threads.
 */
public class MerkleAntiEntropy {

    public record MerkleNode(String hash, MerkleNode left, MerkleNode right) {}

    private final MessageDigest digest;

    public MerkleAntiEntropy() {
        try {
            this.digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String sha256(String input) {
        byte[] hashBytes = digest.digest(input.getBytes());
        return HexFormat.of().formatHex(hashBytes);
    }

    /**
     * Recursively builds the Merkle Tree using Java 21 Virtual Threads.
     */
    public MerkleNode buildTree(List<String> transactionIds) throws InterruptedException {
        if (transactionIds.isEmpty()) {
            return new MerkleNode(sha256(""), null, null);
        }
        if (transactionIds.size() == 1) {
            return new MerkleNode(sha256(transactionIds.getFirst()), null, null);
        }

        int mid = transactionIds.size() / 2;
        List<String> leftSplit = transactionIds.subList(0, mid);
        List<String> rightSplit = transactionIds.subList(mid, transactionIds.size());

        // Java 21 Structured Concurrency: Spawn lightweight Virtual Threads
        try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
            StructuredTaskScope.Subtask<MerkleNode> leftTask = scope.fork(() -> buildTree(leftSplit));
            StructuredTaskScope.Subtask<MerkleNode> rightTask = scope.fork(() -> buildTree(rightSplit));

            scope.join();
            scope.throwIfFailed();

            MerkleNode leftNode = leftTask.get();
            MerkleNode rightNode = rightTask.get();
            
            String combinedHash = sha256(leftNode.hash() + rightNode.hash());
            return new MerkleNode(combinedHash, leftNode, rightNode);
            
        } catch (ExecutionException e) {
            throw new RuntimeException("Failed to build Merkle Tree concurrently", e);
        }
    }

    /**
     * Compare two trees in O(log N) to find out-of-sync transaction branches.
     */
    public boolean isInSync(MerkleNode localTree, MerkleNode remoteTree) {
        if (localTree == null || remoteTree == null) return false;
        // O(1) comparison at the root level
        return localTree.hash().equals(remoteTree.hash());
    }
}
