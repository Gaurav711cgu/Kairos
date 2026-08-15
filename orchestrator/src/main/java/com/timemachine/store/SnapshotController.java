package com.timemachine.store;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<SnapshotDTO> getFullSnapshot(@PathVariable String snapshotId) {
        return ResponseEntity.ok(null);
    }

    @GetMapping("/ordered")
    public ResponseEntity<List<Snapshot>> getOrderedSnapshots(@RequestParam String sessionId) {
        return ResponseEntity.ok(repository.findBySessionCausalOrder(sessionId));
    }
}
