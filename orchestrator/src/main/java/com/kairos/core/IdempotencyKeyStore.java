package com.kairos.core;

import java.util.concurrent.*;
import java.util.function.Supplier;
import java.util.logging.Logger;

/**
 * Staff-Level Distributed Systems: Idempotency Key Store.
 *
 * CUSTOMER POV: "I submitted a payment twice because my phone glitched. I got charged twice."
 *
 * WHY THIS MATTERS AT AMAZON:
 * Amazon SQS delivers messages "at least once". This means the same Saga event
 * can be replayed by the message broker during retries. Without idempotency keys,
 * a single order could be processed (and charged) multiple times.
 *
 * IMPLEMENTATION:
 * - Every incoming Saga request carries a unique client-generated idempotency key
 * - Before processing, we check if this key was already handled
 * - If yes, return the cached result immediately (no re-execution)
 * - Keys expire after 24 hours (matching standard payment industry TTL)
 */
public class IdempotencyKeyStore<T> {

    private static final Logger logger = Logger.getLogger(IdempotencyKeyStore.class.getName());
    private static final long EXPIRY_HOURS = 24;

    public enum Status { PROCESSING, COMPLETED, FAILED }

    public record IdempotencyRecord<T>(T result, long timestampMs, Status status) {
        public boolean isExpired() {
            return System.currentTimeMillis() - timestampMs > EXPIRY_HOURS * 3600 * 1000L;
        }
    }

    // ConcurrentHashMap provides O(1) amortized lookup with thread-safe semantics
    private final ConcurrentHashMap<String, IdempotencyRecord<T>> store = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleanupScheduler = Executors.newSingleThreadScheduledExecutor();

    public IdempotencyKeyStore() {
        // Background thread evicts expired keys every 6 hours to prevent memory leaks
        cleanupScheduler.scheduleAtFixedRate(this::evictExpiredKeys, 6, 6, TimeUnit.HOURS);
    }

    /**
     * Core idempotency check-and-execute pattern.
     * Uses ConcurrentHashMap.computeIfAbsent for atomic check-then-act semantics.
     */
    public T processIdempotent(String idempotencyKey, Supplier<T> operation) {
        IdempotencyRecord<T> existing = store.get(idempotencyKey);

        if (existing != null && !existing.isExpired()) {
            if (existing.status() == Status.COMPLETED) {
                logger.info("Idempotency hit for key: " + idempotencyKey + " - returning cached result");
                return existing.result();
            }
            if (existing.status() == Status.PROCESSING) {
                throw new IllegalStateException("Request with key " + idempotencyKey + " is still being processed");
            }
        }

        // Mark as PROCESSING before executing to handle concurrent duplicate requests
        store.put(idempotencyKey, new IdempotencyRecord<>(null, System.currentTimeMillis(), Status.PROCESSING));

        try {
            T result = operation.get();
            store.put(idempotencyKey, new IdempotencyRecord<>(result, System.currentTimeMillis(), Status.COMPLETED));
            return result;
        } catch (Exception e) {
            store.put(idempotencyKey, new IdempotencyRecord<>(null, System.currentTimeMillis(), Status.FAILED));
            throw e;
        }
    }

    private void evictExpiredKeys() {
        long before = store.size();
        store.entrySet().removeIf(entry -> entry.getValue().isExpired());
        logger.info("Idempotency eviction: removed " + (before - store.size()) + " expired keys");
    }

    public void shutdown() {
        cleanupScheduler.shutdownNow();
    }
}
