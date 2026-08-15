package com.timemachine.replay;

public record ReplayEnvironment(String jdbcUrl, Runnable cleanup) implements AutoCloseable {
    public void close() { cleanup.run(); }
}
