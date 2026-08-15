package com.timemachine.clock;

import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import static org.junit.jupiter.api.Assertions.*;

class VectorClockTest {

    @Test void test1_tickIncrementsSpecificService() {
        VectorClock vc = VectorClock.of("A", "B").tick("A");
        assertEquals(1L, vc.clocks().get("A"));
        assertEquals(0L, vc.clocks().get("B"));
    }

    @Test void test2_tickOnNonExistentServiceCreatesIt() {
        VectorClock vc = new VectorClock(Map.of()).tick("A");
        assertEquals(1L, vc.clocks().get("A"));
    }

    @Test void test3_tickReturnsNewInstance() {
        VectorClock v1 = new VectorClock(Map.of());
        VectorClock v2 = v1.tick("A");
        assertNotSame(v1, v2);
        assertTrue(v1.clocks().isEmpty());
    }

    @Test void test4_mergeProducesComponentWiseMax() {
        VectorClock v1 = new VectorClock(Map.of("A", 2L, "B", 1L));
        VectorClock v2 = new VectorClock(Map.of("A", 1L, "B", 3L, "C", 1L));
        VectorClock v3 = v1.merge(v2);
        assertEquals(2L, v3.clocks().get("A"));
        assertEquals(3L, v3.clocks().get("B"));
        assertEquals(1L, v3.clocks().get("C"));
    }

    @Test void test5_mergeIsCommutative() {
        VectorClock v1 = new VectorClock(Map.of("A", 2L, "B", 1L));
        VectorClock v2 = new VectorClock(Map.of("A", 1L, "B", 3L, "C", 1L));
        assertEquals(v1.merge(v2).clocks(), v2.merge(v1).clocks());
    }

    @Test void test6_mergeIsIdempotent() {
        VectorClock v1 = new VectorClock(Map.of("A", 2L, "B", 1L));
        assertEquals(v1.clocks(), v1.merge(v1).clocks());
    }

    @Test void test7_happensBeforeBasic() {
        VectorClock v1 = new VectorClock(Map.of("A", 1L));
        VectorClock v2 = new VectorClock(Map.of("A", 1L, "B", 1L));
        assertEquals(CausalRelation.HAPPENS_BEFORE, v1.compare(v2));
    }

    @Test void test8_happensBeforeTransitivity() {
        VectorClock v1 = new VectorClock(Map.of("A", 1L));
        VectorClock v2 = new VectorClock(Map.of("A", 2L));
        VectorClock v3 = new VectorClock(Map.of("A", 3L));
        assertEquals(CausalRelation.HAPPENS_BEFORE, v1.compare(v2));
        assertEquals(CausalRelation.HAPPENS_BEFORE, v2.compare(v3));
        assertEquals(CausalRelation.HAPPENS_BEFORE, v1.compare(v3));
    }

    @Test void test9_concurrentDetection() {
        VectorClock v1 = new VectorClock(Map.of("A", 1L));
        VectorClock v2 = new VectorClock(Map.of("B", 1L));
        assertEquals(CausalRelation.CONCURRENT, v1.compare(v2));
    }

    @Test void test10_equalClocksAreConcurrent() {
        VectorClock v1 = new VectorClock(Map.of("A", 1L));
        VectorClock v2 = new VectorClock(Map.of("A", 1L));
        assertEquals(CausalRelation.CONCURRENT, v1.compare(v2));
    }

    @Test void test11_toFromHeaderRoundTrip() {
        VectorClock v1 = new VectorClock(Map.of("A", 2L, "B", 1L));
        String header = v1.toHeader();
        VectorClock v2 = VectorClock.fromHeader(header);
        assertEquals(v1.clocks(), v2.clocks());
    }

    @Test void test12_fromHeaderSingleService() {
        VectorClock v = VectorClock.fromHeader("A:1");
        assertEquals(1L, v.clocks().get("A"));
    }

    @Test void test13_fromHeaderEmptyGracefully() {
        assertTrue(VectorClock.fromHeader("").clocks().isEmpty());
        assertTrue(VectorClock.fromHeader(null).clocks().isEmpty());
    }

    @Test void test14_compareSymmetry() {
        VectorClock v1 = new VectorClock(Map.of("A", 1L));
        VectorClock v2 = new VectorClock(Map.of("A", 1L, "B", 1L));
        assertEquals(CausalRelation.HAPPENS_BEFORE, v1.compare(v2));
        assertEquals(CausalRelation.HAPPENS_AFTER, v2.compare(v1));
    }

    @Test void test15_mergeDisjoint() {
        VectorClock v1 = new VectorClock(Map.of("A", 1L));
        VectorClock v2 = new VectorClock(Map.of("B", 2L));
        VectorClock v3 = v1.merge(v2);
        assertEquals(1L, v3.clocks().get("A"));
        assertEquals(2L, v3.clocks().get("B"));
    }

    @Test void test16_ofFactoryAllZeros() {
        VectorClock v = VectorClock.of("A", "B");
        assertEquals(0L, v.clocks().get("A"));
        assertEquals(0L, v.clocks().get("B"));
    }

    @Test void test17_prdCase1() {
        VectorClock v1 = new VectorClock(Map.of("A", 3L, "B", 1L, "C", 2L));
        VectorClock v2 = new VectorClock(Map.of("A", 3L, "B", 2L, "C", 3L));
        assertEquals(CausalRelation.HAPPENS_BEFORE, v1.compare(v2));
    }

    @Test void test18_prdCase2() {
        VectorClock v1 = new VectorClock(Map.of("A", 3L, "B", 2L, "C", 2L));
        VectorClock v2 = new VectorClock(Map.of("A", 3L, "B", 1L, "C", 3L));
        assertEquals(CausalRelation.CONCURRENT, v1.compare(v2));
    }

    @Test void test19_prdRaceTriggering() {
        VectorClock orderReadAlice = new VectorClock(Map.of("OrderAlice", 1L, "Inventory", 1L));
        VectorClock orderReadBob = new VectorClock(Map.of("OrderBob", 1L, "Inventory", 1L));
        assertEquals(CausalRelation.CONCURRENT, orderReadAlice.compare(orderReadBob));
    }

    @Test void test20_toJsonFromJsonRoundTrip() {
        VectorClock v1 = new VectorClock(Map.of("A", 3L, "B", 1L));
        String json = v1.toJson();
        VectorClock v2 = VectorClock.fromJson(json);
        assertEquals(v1.clocks(), v2.clocks());
    }

    @Test void test21_mergePreservesKeysNotPresent() {
        VectorClock v1 = new VectorClock(Map.of("A", 1L));
        VectorClock v2 = new VectorClock(Map.of());
        assertEquals(v1.clocks(), v1.merge(v2).clocks());
    }

    @Test void test22_tickMonotonically() {
        VectorClock v = new VectorClock(Map.of());
        v = v.tick("A");
        assertEquals(1L, v.clocks().get("A"));
        v = v.tick("A");
        assertEquals(2L, v.clocks().get("A"));
    }

    @Test void test23_largeClock() {
        VectorClock v = new VectorClock(Map.of());
        for (int i=0; i<100; i++) {
            v = v.tick("S" + i);
        }
        assertEquals(100, v.clocks().size());
    }

    @Test void test24_threadSafetyStressTest() throws InterruptedException {
        ThreadSafeVectorClock tvc = new ThreadSafeVectorClock(new VectorClock(Map.of()));
        int numThreads = 1000;
        ExecutorService executor = Executors.newFixedThreadPool(100);
        CountDownLatch latch = new CountDownLatch(numThreads);
        for(int i=0; i<numThreads; i++) {
            executor.submit(() -> {
                tvc.tick("A");
                latch.countDown();
            });
        }
        latch.await();
        assertEquals(1000L, tvc.get().clocks().get("A"));
        executor.shutdown();
    }

    @Test void test25_overflowGuard() {
        VectorClock v = new VectorClock(Map.of("A", Long.MAX_VALUE));
        assertThrows(VectorClockOverflowException.class, () -> v.tick("A"));
    }
}
