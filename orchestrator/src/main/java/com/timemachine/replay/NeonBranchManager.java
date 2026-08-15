package com.timemachine.replay;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
public class NeonBranchManager {

    private static final Logger log = LoggerFactory.getLogger(NeonBranchManager.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Value("${neon.api-key:${NEON_API_KEY:}}")
    private String apiKey;

    @Value("${neon.project-id:${NEON_PROJECT_ID:}}")
    private String projectId;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public NeonBranch createBranch(String branchName) {
        if (apiKey == null || apiKey.isBlank() || projectId == null || projectId.isBlank()) {
            log.warn("Neon API credentials not set, cannot create Neon cloud branch");
            return null;
        }

        try {
            String url = String.format("https://console.neon.tech/api/v2/projects/%s/branches", projectId);
            String payload = String.format("{\"branch\":{\"name\":\"%s\"}}", branchName);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .timeout(Duration.ofSeconds(15))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 201 || response.statusCode() == 200) {
                JsonNode root = MAPPER.readTree(response.body());
                String branchId = root.path("branch").path("id").asText();
                log.info("Created Neon copy-on-write branch id={}", branchId);

                // Fetch connection string for the new branch endpoint
                String connUrl = String.format("https://console.neon.tech/api/v2/projects/%s/connection_uri?branch_id=%s", projectId, branchId);
                HttpRequest connReq = HttpRequest.newBuilder()
                        .uri(URI.create(connUrl))
                        .header("Authorization", "Bearer " + apiKey)
                        .GET()
                        .timeout(Duration.ofSeconds(10))
                        .build();

                HttpResponse<String> connResp = httpClient.send(connReq, HttpResponse.BodyHandlers.ofString());
                String jdbcUrl = "jdbc:postgresql://postgres:5432/demo";
                if (connResp.statusCode() == 200) {
                    JsonNode connJson = MAPPER.readTree(connResp.body());
                    String rawUri = connJson.path("uri").asText();
                    if (rawUri != null && !rawUri.isBlank()) {
                        jdbcUrl = "jdbc:" + rawUri;
                    }
                }

                return new NeonBranch(branchId, jdbcUrl);
            } else {
                log.warn("Neon API returned error {}: {}", response.statusCode(), response.body());
                return null;
            }
        } catch (Exception e) {
            log.error("Failed to create Neon cloud branch: {}", e.getMessage());
            return null;
        }
    }

    public void deleteBranch(String branchId) {
        if (apiKey == null || apiKey.isBlank() || projectId == null || projectId.isBlank() || branchId == null) {
            return;
        }

        try {
            String url = String.format("https://console.neon.tech/api/v2/projects/%s/branches/%s", projectId, branchId);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Bearer " + apiKey)
                    .DELETE()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            log.info("Deleted Neon branch id={} status={}", branchId, response.statusCode());
        } catch (Exception e) {
            log.warn("Failed to delete Neon branch id={}: {}", branchId, e.getMessage());
        }
    }
}
