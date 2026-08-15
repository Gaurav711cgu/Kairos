package com.timemachine.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.timemachine.clock.VectorClock;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class SnapshotRepository {
    
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper mapper;

    private final RowMapper<Snapshot> snapshotRowMapper = (rs, rowNum) -> new Snapshot(
        (UUID) rs.getObject("id"),
        rs.getString("snapshot_id"),
        rs.getString("service_id"),
        rs.getString("trace_id"),
        VectorClock.fromJson(rs.getString("vector_clock")),
        rs.getString("storage_key"),
        rs.getInt("schema_version"),
        rs.getLong("sequence_num"),
        rs.getTimestamp("captured_at") != null ? rs.getTimestamp("captured_at").toInstant() : Instant.now()
    );

    public void ingestSnapshot(SnapshotDTO dto) {
        String sql = """
            INSERT INTO snapshots (snapshot_id, service_id, trace_id, vector_clock, storage_key, schema_version, captured_at)
            VALUES (?, ?, ?, ?::jsonb, ?, ?, ?)
            ON CONFLICT (snapshot_id) DO NOTHING
        """;
        
        Timestamp capturedAt = dto.capturedAt() != null ? Timestamp.from(dto.capturedAt()) : Timestamp.from(Instant.now());
        String vcJson = dto.vectorClock() != null ? dto.vectorClock().toJson() : "{}";

        jdbcTemplate.update(
            sql,
            dto.snapshotId(),
            dto.serviceId(),
            dto.traceId(),
            vcJson,
            dto.storageKey(),
            dto.schemaVersion() > 0 ? dto.schemaVersion() : 1,
            capturedAt
        );
    }

    public List<Snapshot> findBySessionCausalOrder(String sessionId) {
        String sql = """
            SELECT s.id, s.snapshot_id, s.service_id, s.trace_id, s.vector_clock, s.storage_key, s.schema_version, s.sequence_num, s.captured_at
            FROM snapshot_causal_order o
            JOIN snapshots s ON o.snapshot_id = s.snapshot_id
            WHERE o.session_id = ?
            ORDER BY o.causal_position ASC
        """;
        return jdbcTemplate.query(sql, snapshotRowMapper, sessionId);
    }

    public List<Snapshot> findNewSinceSequence(long lastSeq) {
        String sql = """
            SELECT id, snapshot_id, service_id, trace_id, vector_clock, storage_key, schema_version, sequence_num, captured_at
            FROM snapshots
            WHERE sequence_num > ?
            ORDER BY sequence_num ASC
            LIMIT 500
        """;
        return jdbcTemplate.query(sql, snapshotRowMapper, lastSeq);
    }

    public void updateCausalOrder(String sessionId, List<CausalOrderEntry> entries) {
        if (entries == null || entries.isEmpty()) return;
        String sql = """
            INSERT INTO snapshot_causal_order (session_id, causal_position, snapshot_id)
            VALUES (?, ?, ?)
            ON CONFLICT (session_id, snapshot_id) DO NOTHING
        """;
        
        jdbcTemplate.batchUpdate(
            sql,
            entries,
            entries.size(),
            (ps, entry) -> {
                ps.setString(1, sessionId);
                ps.setInt(2, entry.causalPosition());
                ps.setString(3, entry.snapshotId());
            }
        );
    }

    public long getLastSequence() {
        String sql = "SELECT last_sequence FROM projection_checkpoint WHERE id = 1";
        List<Long> results = jdbcTemplate.query(sql, (rs, rowNum) -> rs.getLong("last_sequence"));
        return results.isEmpty() ? 0L : results.get(0);
    }

    public void updateCheckpoint(long newSeq) {
        String sql = "UPDATE projection_checkpoint SET last_sequence = ? WHERE id = 1";
        jdbcTemplate.update(sql, newSeq);
    }

    public List<Snapshot> findByTraceId(String traceId) {
        String sql = """
            SELECT id, snapshot_id, service_id, trace_id, vector_clock, storage_key, schema_version, sequence_num, captured_at
            FROM snapshots
            WHERE trace_id = ?
            ORDER BY sequence_num ASC
        """;
        return jdbcTemplate.query(sql, snapshotRowMapper, traceId);
    }
}
