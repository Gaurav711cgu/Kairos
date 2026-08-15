package com.timemachine.clock;

import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Hybrid Logical Clock (HLC) implementation (Kulkarni et al., 2014).
 * Provides strict causal ordering with bounded O(1) 128-bit space.
 */
public record HybridLogicalClock(long physicalMillis, int logicalCounter) implements Comparable<HybridLogicalClock> {

    public HybridLogicalClock {
        if (physicalMillis < 0 || logicalCounter < 0) {
            throw new IllegalArgumentException("Physical millis and logical counter must be non-negative");
        }
    }

    public static HybridLogicalClock now() {
        return new HybridLogicalClock(System.currentTimeMillis(), 0);
    }

    public static HybridLogicalClock of(long physicalMillis, int logicalCounter) {
        return new HybridLogicalClock(physicalMillis, logicalCounter);
    }

    public static HybridLogicalClock parse(String header) {
        if (header == null || header.isBlank()) {
            return now();
        }
        try {
            String[] parts = header.trim().split("\\.");
            if (parts.length == 2) {
                long phys = Long.parseLong(parts[0], 16);
                int logi = Integer.parseInt(parts[1], 16);
                return new HybridLogicalClock(phys, logi);
            }
        } catch (Exception ignored) {}
        return now();
    }

    public String toHeader() {
        return String.format("%016x.%08x", physicalMillis, logicalCounter);
    }

    public Instant toInstant() {
        return Instant.ofEpochMilli(physicalMillis);
    }

    @Override
    public int compareTo(HybridLogicalClock other) {
        if (other == null) return 1;
        int physCmp = Long.compare(this.physicalMillis, other.physicalMillis);
        if (physCmp != 0) {
            return physCmp;
        }
        return Integer.compare(this.logicalCounter, other.logicalCounter);
    }

    /**
     * Thread-safe mutable coordinator for HLC state updates.
     */
    public static class Coordinator {
        private final AtomicReference<HybridLogicalClock> latest = new AtomicReference<>(HybridLogicalClock.now());

        public synchronized HybridLogicalClock tick() {
            long now = System.currentTimeMillis();
            HybridLogicalClock current = latest.get();

            HybridLogicalClock next;
            if (now > current.physicalMillis()) {
                next = new HybridLogicalClock(now, 0);
            } else {
                next = new HybridLogicalClock(current.physicalMillis(), current.logicalCounter() + 1);
            }

            latest.set(next);
            return next;
        }

        public synchronized HybridLogicalClock merge(HybridLogicalClock remote) {
            if (remote == null) return tick();

            long now = System.currentTimeMillis();
            HybridLogicalClock current = latest.get();

            long maxPhys = Math.max(now, Math.max(current.physicalMillis(), remote.physicalMillis()));
            int nextLog;

            if (maxPhys == current.physicalMillis() && maxPhys == remote.physicalMillis()) {
                nextLog = Math.max(current.logicalCounter(), remote.logicalCounter()) + 1;
            } else if (maxPhys == current.physicalMillis()) {
                nextLog = current.logicalCounter() + 1;
            } else if (maxPhys == remote.physicalMillis()) {
                nextLog = remote.logicalCounter() + 1;
            } else {
                nextLog = 0;
            }

            HybridLogicalClock next = new HybridLogicalClock(maxPhys, nextLog);
            latest.set(next);
            return next;
        }

        public HybridLogicalClock current() {
            return latest.get();
        }
    }
}
