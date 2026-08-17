package com.timemachine.store;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/snapshots")
@RequiredArgsConstructor
public class SnapshotController {
    
    private final SnapshotRepository repository;
    private final SupabaseStorageClient storageClient;

    @PostMapping
    public ResponseEntity<Map<String, String>> ingestSnapshot(@RequestBody SnapshotDTO dto) {
        if (dto.snapshotId() == null || dto.serviceId() == null) {
            return ResponseEntity.badRequest().build();
        }
        
        repository.ingestSnapshot(dto);
        
        if (dto.payload() != null) {
            storageClient.uploadSnapshot(dto.storageKey(), dto.payload());
        }
        
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("snapshotId", dto.snapshotId()));
    }

    @GetMapping
    public ResponseEntity<List<Snapshot>> querySnapshots(
            @RequestParam(required = false) String serviceIds,
            @RequestParam(required = false) Long fromSeq,
            @RequestParam(required = false) Long toSeq,
            @RequestParam(required = false) String sessionId) {
        
        if (sessionId != null && !sessionId.isBlank()) {
            return ResponseEntity.ok(repository.findBySessionCausalOrder(sessionId));
        }
        long seq = fromSeq != null ? fromSeq : 0L;
        return ResponseEntity.ok(repository.findNewSinceSequence(seq));
    }

    @GetMapping("/{snapshotId}/full")
    public ResponseEntity<Map<String, Object>> getFullSnapshot(@PathVariable String snapshotId) {
        List<Snapshot> snapshots = repository.findNewSinceSequence(0);
        Snapshot match = snapshots.stream()
                .filter(s -> snapshotId.equals(s.snapshotId()))
                .findFirst()
                .orElse(null);

        if (match == null) {
            return ResponseEntity.notFound().build();
        }

        byte[] payload = storageClient.downloadSnapshot(match.storageKey());
        Map<String, Object> result = new HashMap<>();
        result.put("snapshot", match);
        result.put("payloadBytes", payload != null ? payload.length : 0);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/ordered")
    public ResponseEntity<List<Snapshot>> getOrderedSnapshots(@RequestParam String sessionId) {
        return ResponseEntity.ok(repository.findBySessionCausalOrder(sessionId));
    }
}
