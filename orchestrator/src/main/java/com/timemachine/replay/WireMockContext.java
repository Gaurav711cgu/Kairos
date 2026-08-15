package com.timemachine.replay;

import com.github.tomakehurst.wiremock.WireMockServer;

public record WireMockContext(WireMockServer server, int port) {}
