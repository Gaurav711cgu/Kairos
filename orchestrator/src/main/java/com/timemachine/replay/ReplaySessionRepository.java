package com.timemachine.replay;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Repository
@RequiredArgsConstructor
public class ReplaySessionRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    private final RowMapper<ReplaySession> sessionRowMapper = (rs, rowNum) -> {
        try {
            UUID id = (UUID) rs.getObject("id");
            String sessionId = rs.getString("session_id");
            ReplayStatus status = ReplayStatus.valueOf(rs.getString("status"));
            
            java.sql.Array servicesArray = rs.getArray("services");
            List<String> services = servicesArray != null ? Arrays.asList((String[]) servicesArray.getArray()) : List.of();

            String traceJson = rs.getString("replay_trace");
            List<ReplayEvent> events = List.of();
            List<Map<String, Object>> dbDiffs = List.of();
            boolean raceDetected = false;

            if (traceJson != null && !traceJson.isBlank()) {
                Map<String, Object> traceMap = objectMapper.readValue(traceJson, new TypeReference<Map<String, Object>>() {});
                if (traceMap.containsKey("events")) {
                    events = objectMapper.convertValue(traceMap.get("events"), new TypeReference<List<ReplayEvent>>() {});
                }
                if (traceMap.containsKey("dbDiffs")) {
                    dbDiffs = objectMapper.convertValue(traceMap.get("dbDiffs"), new TypeReference<List<Map<String, Object>>>() {});
                }
                if (traceMap.containsKey("racingConditionDetected")) {
                    raceDetected = Boolean.TRUE.equals(traceMap.get("racingConditionDetected"));
                }
            }

            String rcaJson = rs.getString("rca_report");
            Map<String, Object> rcaReport = null;
            if (rcaJson != null && !rcaJson.isBlank()) {
                rcaReport = objectMapper.readValue(rcaJson, new TypeReference<Map<String, Object>>() {});
            }

            String errorMessage = rs.getString("error_message");
            Instant createdAt = rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant() : Instant.now();
            Instant updatedAt = rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant() : Instant.now();

            return new ReplaySession(
                id, sessionId, status, services, events, dbDiffs, rcaReport, raceDetected, errorMessage, createdAt, updatedAt
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to map ReplaySession", e);
        }
    };

    public void createSession(String sessionId, List<String> services) {
        String sql = """
            INSERT INTO replay_sessions (session_id, status, services, created_at, updated_at)
            VALUES (?, 'CREATED', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (session_id) DO NOTHING
        """;
        String[] servicesArr = services != null ? services.toArray(new String[0]) : new String[0];
        jdbcTemplate.update(sql, sessionId, servicesArr);
    }

    public void updateStatus(String sessionId, ReplayStatus status, String errorMessage) {
        String sql = "UPDATE replay_sessions SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?";
        jdbcTemplate.update(sql, status.name(), errorMessage, sessionId);
    }

    public void saveResults(String sessionId, ReplayStatus status, Map<String, Object> traceMap, Map<String, Object> rcaReport, String errorMessage) {
        try {
            String traceJson = traceMap != null ? objectMapper.writeValueAsString(traceMap) : null;
            String rcaJson = rcaReport != null ? objectMapper.writeValueAsString(rcaReport) : null;

            String sql = """
                UPDATE replay_sessions
                SET status = ?, replay_trace = ?::jsonb, rca_report = ?::jsonb, error_message = ?, updated_at = CURRENT_TIMESTAMP
                WHERE session_id = ?
            """;
            jdbcTemplate.update(sql, status.name(), traceJson, rcaJson, errorMessage, sessionId);
        } catch (Exception e) {
            throw new RuntimeException("Failed to save replay results", e);
        }
    }

    public Optional<ReplaySession> findBySessionId(String sessionId) {
        String sql = "SELECT * FROM replay_sessions WHERE session_id = ?";
        List<ReplaySession> list = jdbcTemplate.query(sql, sessionRowMapper, sessionId);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<ReplaySession> listAll() {
        String sql = "SELECT * FROM replay_sessions ORDER BY created_at DESC LIMIT 50";
        return jdbcTemplate.query(sql, sessionRowMapper);
    }
}
