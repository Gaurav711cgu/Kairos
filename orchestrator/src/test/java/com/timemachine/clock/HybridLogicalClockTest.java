package com.timemachine.clock;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HybridLogicalClockTest {

    @Test
    void testHlcOrderingPhysicalPrecedence() {
        HybridLogicalClock h1 = HybridLogicalClock.of(1000L, 5);
        HybridLogicalClock h2 = HybridLogicalClock.of(1001L, 0);
        assertTrue(h1.compareTo(h2) < 0);
    }

    @Test
    void testHlcOrderingLogicalPrecedenceSamePhysical() {
        HybridLogicalClock h1 = HybridLogicalClock.of(1000L, 2);
        HybridLogicalClock h2 = HybridLogicalClock.of(1000L, 3);
        assertTrue(h1.compareTo(h2) < 0);
    }

    @Test
    void testHlcSerializationRoundTrip() {
        HybridLogicalClock h1 = HybridLogicalClock.of(1710000000000L, 42);
        String header = h1.toHeader();
        HybridLogicalClock h2 = HybridLogicalClock.parse(header);
        assertEquals(h1.physicalMillis(), h2.physicalMillis());
        assertEquals(h1.logicalCounter(), h2.logicalCounter());
    }

    @Test
    void testHlcCoordinatorMonotonicity() {
        HybridLogicalClock.Coordinator coord = new HybridLogicalClock.Coordinator();
        HybridLogicalClock c1 = coord.tick();
        HybridLogicalClock c2 = coord.tick();
        assertTrue(c1.compareTo(c2) < 0);
    }

    @Test
    void testHlcMergeCatchup() {
        HybridLogicalClock.Coordinator coord = new HybridLogicalClock.Coordinator();
        HybridLogicalClock remoteFuture = HybridLogicalClock.of(System.currentTimeMillis() + 5000L, 10);
        HybridLogicalClock merged = coord.merge(remoteFuture);
        assertTrue(merged.physicalMillis() >= remoteFuture.physicalMillis());
        assertTrue(merged.compareTo(remoteFuture) > 0);
    }
}
