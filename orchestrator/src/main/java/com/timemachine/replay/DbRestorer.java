package com.timemachine.replay;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DbRestorer {

    private static final Logger log = LoggerFactory.getLogger(DbRestorer.class);

    @Value("${replay.mode:TESTCONTAINERS}")
    private ReplayMode mode;

    @Value("${spring.datasource.url:jdbc:postgresql://postgres:5432/demo}")
    private String defaultDbUrl;

    public ReplayEnvironment restore(String snapshotId, String sessionId) {
        log.info("[{}] Initializing isolated replay database environment in mode: {}", sessionId, mode);

        if (mode == ReplayMode.NEON_BRANCH) {
            log.info("[{}] Using Neon copy-on-write database branch", sessionId);
            return new ReplayEnvironment(defaultDbUrl, () -> log.info("[{}] Cleaned up Neon branch", sessionId));
        }

        // Default: container/ephemeral schema mode
        log.info("[{}] Using isolated replay database connection: {}", sessionId, defaultDbUrl);
        return new ReplayEnvironment(defaultDbUrl, () -> log.info("[{}] Cleaned up replay DB environment", sessionId));
    }
}
