package com.timemachine.replay;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import java.util.List;

@RestController
@RequestMapping("/replay")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ReplayController {
    
    private final ReplayOrchestrator orchestrator;
    private final ReplaySessionRepository sessionRepository;

    @PostMapping
    public ResponseEntity<ReplaySession> startReplay(@RequestBody ReplayRequest req) {
        ReplaySession session = orchestrator.startReplay(req.sessionId(), req.startTraceId(), req.services());
        return ResponseEntity.accepted().body(session);
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<ReplaySession> getSession(@PathVariable String sessionId) {
        return sessionRepository.findBySessionId(sessionId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<ReplaySession>> listSessions() {
        return ResponseEntity.ok(sessionRepository.listAll());
    }
}

record ReplayRequest(String sessionId, String startTraceId, List<String> services) {}
