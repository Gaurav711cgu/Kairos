package com.timemachine.replay;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import com.timemachine.store.Snapshot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class MockLayerInjector {

    private static final Logger log = LoggerFactory.getLogger(MockLayerInjector.class);

    public WireMockContext inject(List<Snapshot> snapshots, String sessionId) {
        try {
            WireMockServer server = new WireMockServer(WireMockConfiguration.wireMockConfig().dynamicPort());
            server.start();
            int port = server.port();
            log.info("[{}] Started WireMock server on port {}", sessionId, port);

            // 1. Fail-Closed Sandbox Security: Block all unmocked egress traffic
            server.stubFor(
                WireMock.any(WireMock.anyUrl())
                    .atPriority(100) // Lowest priority fallback
                    .willReturn(WireMock.aResponse()
                        .withStatus(503)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"error\":\"EGRESS_BLOCKED_UNMOCKED_REPLAY_CALL\",\"session\":\"" + sessionId + "\"}")
                    )
            );

            // 2. Register real stubs from recorded downstream snapshots (higher priority)
            if (snapshots != null) {
                int stubsCount = 0;
                for (Snapshot s : snapshots) {
                    if (s.path() != null && !s.path().isBlank() && s.method() != null) {
                        String body = s.responseBody() != null ? s.responseBody() : "{\"status\":\"OK\"}";
                        int status = s.responseStatus() > 0 ? s.responseStatus() : 200;

                        server.stubFor(
                            WireMock.request(s.method(), WireMock.urlEqualTo(s.path()))
                                .atPriority(1) // High priority match
                                .willReturn(WireMock.aResponse()
                                    .withStatus(status)
                                    .withHeader("Content-Type", "application/json")
                                    .withHeader("X-Vector-Clock", s.vectorClock() != null ? s.vectorClock().toHeader() : "")
                                    .withBody(body)
                                )
                        );
                        stubsCount++;
                    }
                }
                log.info("[{}] Injected {} recorded snapshot stubs into WireMock (Fail-Closed mode active)", sessionId, stubsCount);
            }

            return new WireMockContext(server, port);
        } catch (Exception e) {
            log.warn("[{}] Could not start local WireMock (running with downstream direct routing): {}", sessionId, e.getMessage());
            return new WireMockContext(null, 0);
        }
    }

    public void teardown(WireMockContext ctx) {
        if (ctx != null && ctx.server() != null && ctx.server().isRunning()) {
            try {
                ctx.server().stop();
                log.info("Stopped WireMock server on port {}", ctx.port());
            } catch (Exception e) {
                log.warn("Error stopping WireMock server: {}", e.getMessage());
            }
        }
    }
}
