package com.timemachine.replay;

import com.github.tomakehurst.wiremock.WireMockServer;
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
            return new WireMockContext(server, port);
        } catch (Exception e) {
            log.warn("[{}] Could not start local WireMock (running without external mock proxy): {}", sessionId, e.getMessage());
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
