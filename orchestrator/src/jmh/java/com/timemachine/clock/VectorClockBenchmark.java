package com.timemachine.clock;

import org.openjdk.jmh.annotations.*;

import java.util.Map;
import java.util.concurrent.TimeUnit;

// Comments:
// Target is > 5,000,000 ops/sec, which outperforms Riak's 2-3M ops/sec.
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(TimeUnit.SECONDS)
@State(Scope.Thread)
public class VectorClockBenchmark {

    private VectorClock v1;
    private VectorClock v2;
    private String header;

    @Setup
    public void setup() {
        v1 = new VectorClock(Map.of("A", 1L, "B", 2L, "C", 3L));
        v2 = new VectorClock(Map.of("A", 2L, "B", 1L, "D", 1L));
        header = v1.toHeader();
    }

    @Benchmark
    public VectorClock benchmarkTick() {
        return v1.tick("A");
    }

    @Benchmark
    public VectorClock benchmarkMerge() {
        return v1.merge(v2);
    }

    @Benchmark
    public CausalRelation benchmarkCompare() {
        return v1.compare(v2);
    }

    @Benchmark
    public String benchmarkToHeader() {
        return v1.toHeader();
    }

    @Benchmark
    public VectorClock benchmarkFromHeader() {
        return VectorClock.fromHeader(header);
    }
}
