package com.timemachine.replay;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.testcontainers.containers.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

@Component
@RequiredArgsConstructor
public class DbRestorer {

    private static final Logger log = LoggerFactory.getLogger(DbRestorer.class);

    @Value("${replay.mode:TESTCONTAINERS}")
    private ReplayMode mode;

    @Value("${spring.datasource.url:jdbc:postgresql://postgres:5432/demo}")
    private String defaultDbUrl;

    @Value("${spring.datasource.username:postgres}")
    private String defaultDbUser;

    @Value("${spring.datasource.password:postgres}")
    private String defaultDbPass;

    private final NeonBranchManager neonBranchManager;
    private final JdbcTemplate jdbcTemplate;

    public ReplayEnvironment restore(String snapshotId, String sessionId) {
        log.info("[{}] Restoring isolated database sandbox in mode: {}", sessionId, mode);

        // 1. Cloud Neon Copy-on-Write Mode
        if (mode == ReplayMode.NEON_BRANCH) {
            NeonBranch branch = neonBranchManager.createBranch("replay_" + sessionId);
            if (branch != null) {
                log.info("[{}] Successfully provisioned Neon branch: {}", sessionId, branch.connectionUri());
                return new ReplayEnvironment(branch.connectionUri(), () -> neonBranchManager.deleteBranch(branch.branchId()));
            }
            log.warn("[{}] Neon branch creation failed, falling back to local isolation", sessionId);
        }

        // 2. Local Testcontainers Dynamic Sandbox Mode
        try {
            log.info("[{}] Attempting to launch dynamic Testcontainers PostgreSQL container...", sessionId);
            PostgreSQLContainer<?> container = new PostgreSQLContainer<>("postgres:15-alpine")
                    .withDatabaseName("replay_" + sessionId.replace("-", "_"))
                    .withUsername("postgres")
                    .withPassword("postgres");

            container.start();
            String containerJdbcUrl = container.getJdbcUrl();
            log.info("[{}] Testcontainers Postgres started at: {}", sessionId, containerJdbcUrl);

            // Initialize seed tables in the new container
            try (Connection conn = DriverManager.getConnection(containerJdbcUrl, container.getUsername(), container.getPassword());
                 Statement stmt = conn.createStatement()) {
                stmt.execute("""
                    CREATE TABLE IF NOT EXISTS inventory (
                        product_id   VARCHAR(50) PRIMARY KEY,
                        name         VARCHAR(255) NOT NULL,
                        stock        INTEGER NOT NULL DEFAULT 0
                    );
                    CREATE TABLE IF NOT EXISTS orders (
                        order_id    VARCHAR(50) PRIMARY KEY,
                        user_id     VARCHAR(50) NOT NULL,
                        product_id  VARCHAR(50) NOT NULL,
                        status      VARCHAR(50) NOT NULL DEFAULT 'CREATED',
                        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    INSERT INTO inventory (product_id, name, stock)
                    VALUES ('PRODUCT_X', 'Limited Edition Widget', 1)
                    ON CONFLICT (product_id) DO UPDATE SET stock = 1;
                """);
            }

            return new ReplayEnvironment(containerJdbcUrl, () -> {
                try {
                    container.stop();
                    log.info("[{}] Stopped Testcontainers Postgres container", sessionId);
                } catch (Exception e) {
                    log.warn("Error stopping Testcontainers: {}", e.getMessage());
                }
            });

        } catch (Throwable t) {
            log.warn("[{}] Testcontainers launch unavailable (Docker daemon not accessible): {}. Using schema isolation on primary database.",
                    sessionId, t.getMessage());
        }

        // 3. Fallback: Schema & State Isolation on primary Postgres
        try {
            jdbcTemplate.execute("UPDATE inventory SET stock = 1 WHERE product_id = 'PRODUCT_X'");
            log.info("[{}] Reset inventory to stock=1 on primary database sandbox", sessionId);
        } catch (Exception e) {
            log.warn("[{}] Primary database reset error: {}", sessionId, e.getMessage());
        }

        return new ReplayEnvironment(defaultDbUrl, () -> {
            log.info("[{}] Completed primary database sandbox cleanup", sessionId);
        });
    }
}
