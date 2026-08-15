package com.timemachine.clock;

public class ThreadSafeVectorClock {
    private VectorClock vc;

    public ThreadSafeVectorClock(VectorClock initial) {
        this.vc = initial != null ? initial : new VectorClock(null);
    }

    public synchronized void tick(String serviceId) {
        this.vc = this.vc.tick(serviceId);
    }

    public synchronized void merge(VectorClock other) {
        this.vc = this.vc.merge(other);
    }

    public synchronized VectorClock get() {
        return this.vc;
    }
}
