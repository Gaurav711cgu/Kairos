# PRD: Distributed State Time Machine
**Version:** 1.0  
**Author:** Gaurav (DEBUG THUGS / CGU Bhubaneswar)  
**Status:** Active  
**Last Updated:** August 2026

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Prior Art & Why It Fails](#2-prior-art--why-it-fails)
3. [The Demo Scenario (North Star)](#3-the-demo-scenario-north-star)
4. [System Architecture](#4-system-architecture)
5. [Tech Stack Decisions](#5-tech-stack-decisions)
6. [Glossary](#6-glossary)
7. [Phased Build Plan](#7-phased-build-plan)
8. [Out of Scope](#8-out-of-scope)
9. [Failure Modes](#9-failure-modes)
10. [Security & Data Handling](#10-security--data-handling)
11. [Weekly Checkpoint Table](#11-weekly-checkpoint-table)
12. [Prerequisites & Setup](#12-prerequisites--setup)

---

## 1. Problem Statement

When a bug occurs in a distributed system, it leaves behind only logs — text that someone decided to print, not the actual system state. By the time an on-call engineer opens their laptop, the state is gone: the database rows have been overwritten, the queue has been drained, the in-flight requests have completed or failed. Engineers spend hours — sometimes days — trying to reproduce a bug that already happened, working backward from incomplete evidence.

**The core problem:** distributed system state is ephemeral. Debugging requires reconstructing what happened, which is impossible without the state itself.

This project builds a **DVR for distributed systems**. Every state snapshot is captured continuously, causally ordered using vector clocks (not wall clocks, which lie), and stored compactly. When an incident occurs, an engineer specifies a time window and receives an isolated replay environment — the exact database state, the exact queue contents, the exact in-flight requests — reconstructed deterministically. The bug plays out in slow motion. The fix can be verified against the same replay before shipping.

**Quantified pain:** According to PagerDuty's industry report, the average incident takes 4.2 hours to resolve. Senior engineers cost ₹15,000–₹40,000/hour in loaded cost. At one incident per week per team, that is ₹30L–₹80L annually in debugging labor — for one team. This system eliminates the reconstruction phase.

---

## 2. Prior Art & Why It Fails

| Tool | What It Does | Why It Fails For This |
|---|---|---|
| **Mozilla rr** | Record and deterministically replay a single Linux process | Single process only. Cannot capture state across service boundaries. Useless for microservices. |
| **Microsoft TTD (Time-Travel Debugging)** | Time-travel debugging for Windows processes | Windows only. Single process. Same fundamental limitation as rr. |
| **Datadog / Honeycomb** | Distributed tracing and observability | Shows correlation, not causation. Tells you what happened in what order, but not *why* it happened or what the state was. Cannot replay. |
| **Chronosphere** | Metrics and tracing at scale | Pure observability. No replay. No state capture. |
| **Event Sourcing** | Replay events for a single service | Single service only. No cross-service causal ordering. Requires architectural changes to every service upfront. |
| **Chaos Monkey / Chaos Engineering** | Inject failures to find weaknesses | Proactive fault injection. Does not help debug incidents that already occurred. |

**The gap:** No existing tool captures distributed system state with causal ordering and enables deterministic replay across service boundaries. This is the gap this project fills.

---

## 3. The Demo Scenario (North Star)

> Every architectural decision in this project is evaluated against one question: does this help us demonstrate this scenario correctly?

### The Bug: Ghost Order Race Condition

**Services involved:**
- `order-service` (Spring Boot, Java 21)
- `payment-service` (Spring Boot, Java 21)
- `inventory-service` (Spring Boot, Java 21)
- Shared Postgres database

**The setup:**
- 1 unit of Product X in inventory
- Two users simultaneously click "Place Order" for Product X

**What happens (the bug):**

```
T=0ms   User A → POST /orders → order-service
T=1ms   User B → POST /orders → order-service (concurrent)

T=5ms   order-service (A) → GET /inventory/productX → returns stock=1
T=5ms   order-service (B) → GET /inventory/productX → returns stock=1
        [Both see available stock. Race condition begins here.]

T=10ms  order-service (A) → POST /payments → payment-service
T=10ms  order-service (B) → POST /payments → payment-service

T=50ms  payment-service confirms A → order-service writes Order A to DB
T=51ms  payment-service confirms B → order-service writes Order B to DB
        [Two orders written. Zero stock check before write.]

T=52ms  inventory-service decrements stock: 1 → 0 (for A)
T=53ms  inventory-service decrements stock: 0 → -1 (for B)
        [Negative stock. Ghost order exists.]
```

**Observable failure:** Two confirmed orders for one item. Customer B receives order confirmation. Item cannot be fulfilled.

**What the time machine does:**

```
Engineer specifies: replay window T=0ms to T=55ms

Time machine:
1. Restores Postgres to state at T=0ms (stock=1, zero orders)
2. Replays both HTTP requests in causal order (vector clock ordered)
3. Engineer watches in slow motion:
   - Both inventory reads return stock=1 simultaneously
   - Missing lock between read and write is visible
   - Root cause identified: no SELECT FOR UPDATE before order write
4. Engineer applies fix (adds SELECT FOR UPDATE)
5. Re-runs replay with fix applied
6. Only one order is created. Bug does not occur.
```

**The demo is complete in under 5 minutes.** `docker compose up` starts everything. One script triggers the race condition. The time machine captures it. The replay plays it back. The root cause is visible without any log diving.

---

## 4. System Architecture

### Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTED STATE TIME MACHINE                   │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │ order-service│   │payment-service│  │ inventory-service    │   │
│  │ (Spring Boot)│   │(Spring Boot) │   │ (Spring Boot)        │   │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘   │
│         │                  │                       │               │
│  ┌──────▼──────────────────▼───────────────────────▼───────────┐   │
│  │              GO CAPTURE AGENT (sidecar)                     │   │
│  │  • Intercepts all inter-service HTTP calls                  │   │
│  │  • Attaches vector clock to every request/response          │   │
│  │  • Snapshots: DB state + queue contents + request payload   │   │
│  │  • Overhead target: <2ms per intercepted call               │   │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │ JSON snapshots                        │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │           PYTHON ANOMALY DETECTOR                             │  │
│  │  • Watches latency + error rate metrics via Prometheus        │  │
│  │  • Isolation Forest model                                     │  │
│  │  • Signals capture agent: "snapshot now, anomaly detected"    │  │
│  │  • Prevents storing GBs of normal-traffic snapshots           │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │ anomaly-gated snapshots               │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │           SNAPSHOT STORE (S3 / local disk in dev)             │  │
│  │  • Keyed by: service_id + vector_clock_timestamp              │  │
│  │  • Compressed with zstd                                       │  │
│  │  • Queryable by time range, service, anomaly type             │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                        │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │      JAVA REPLAY ORCHESTRATOR (Spring Boot 3, Java 21)        │  │
│  │                                                               │  │
│  │  ┌─────────────────┐    ┌──────────────────────────────────┐ │  │
│  │  │ Vector Clock    │    │  Replay Engine                   │ │  │
│  │  │ Engine          │    │  • Restores Postgres to snapshot  │ │  │
│  │  │ • tick()        │    │  • Spins up isolated Docker env   │ │  │
│  │  │ • merge()       │    │  • Replays HTTP calls causally    │ │  │
│  │  │ • compare()     │    │  • Mock layer for external APIs   │ │  │
│  │  │ • happens-before│    │  • Produces replay trace          │ │  │
│  │  └─────────────────┘    └──────────────────────────────────┘ │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │ replay trace                           │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │           PYTHON LLM ANALYSIS LAYER (FastAPI + LangGraph)     │  │
│  │  • Receives structured replay trace                           │  │
│  │  • LLM identifies root cause pattern                          │  │
│  │  • Outputs structured RCA report                              │  │
│  │  • "Bug occurs when these 3 conditions are simultaneously     │  │
│  │    true: stock read before lock, concurrent requests, no      │  │
│  │    distributed lock on inventory"                             │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │ RCA report                             │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │           NEXT.JS DASHBOARD                                   │  │
│  │  • Timeline scrubber (visual replay control)                  │  │
│  │  • Service call graph (animated, causal order)                │  │
│  │  • DB state diff viewer (before/after replay)                 │  │
│  │  • RCA report display                                         │  │
│  │  • One-click replay trigger                                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow (Numbered)

```
1. Service A makes HTTP call to Service B
2. Capture agent intercepts call, reads current vector clock
3. Capture agent ticks vector clock (local event), attaches to request header
4. Service B receives request, capture agent merges incoming clock with local
5. Anomaly detector decides: snapshot or discard?
6. If snapshot: DB state + queue state + request payload → Snapshot Store
7. Engineer triggers replay for time window [T1, T2]
8. Replay Orchestrator fetches snapshots, orders by vector clock
9. Isolated Docker environment spun up with restored DB state
10. HTTP calls replayed in causal order with mock layer active
11. Replay trace sent to LLM Analysis Layer
12. RCA report + trace displayed in Next.js Dashboard
```

---

## 5. Tech Stack Decisions

Every language choice below has a structural reason. "It's popular" is not a reason.

### Go — Capture Agent

**Why Go, not Python or Java:**
The capture agent runs as a sidecar on production services. It must add less than 2ms overhead per intercepted call. Java's JVM has GC pause events that can spike to 5-50ms unpredictably — unacceptable for a latency-critical sidecar. Python's GIL prevents true parallelism for concurrent request interception. Go's goroutines handle thousands of concurrent HTTP streams with predictable, sub-millisecond scheduling. Go also compiles to a single static binary — no runtime dependencies, trivial deployment.

**Key Go packages:**
- `net/http` — HTTP middleware for call interception
- `encoding/json` — snapshot serialization
- `sync` — vector clock concurrent access protection
- `compress/zstd` — snapshot compression

### Java 21 + Spring Boot 3 — Replay Orchestrator & Vector Clock Engine

**Why Java, not Python or Go:**
The replay orchestrator is I/O-bound workload — spinning up Docker containers, restoring Postgres state, coordinating concurrent service replays. Java 21 Virtual Threads (Project Loom) handle thousands of concurrent I/O operations without reactive programming complexity. Spring Boot's ecosystem (Spring Data JPA, Testcontainers, Actuator, Micrometer) is exactly what this orchestration layer needs. The vector clock engine is pure logic — Java's strong type system makes correctness verifiable and unit-testable. No Python equivalent matches jOOQ for type-safe snapshot metadata queries.

**Key Java/Spring packages:**
- `spring-boot-starter-web` — REST API for replay triggering
- `spring-boot-starter-data-jpa` + `jOOQ` — snapshot metadata queries
- `testcontainers` — isolated Docker environment management
- `micrometer-registry-prometheus` — metrics export
- `resilience4j` — circuit breaker for orchestrator → store calls

### Python — Anomaly Detector + LLM Analysis Layer

**Why Python here specifically:**
Anomaly detection (Isolation Forest, statistical process control) lives natively in sklearn/PyTorch. There is no Java equivalent with the same ecosystem maturity. LangGraph for multi-step LLM trace analysis is Python-only. These components are isolated microservices called via REST — the language boundary is clean and justified.

**Key Python packages:**
- `scikit-learn` — Isolation Forest anomaly detection
- `langchain` + `langgraph` — LLM trace analysis pipeline
- `fastapi` — lightweight REST wrapper for both services
- `prometheus-client` — metrics ingestion for anomaly detector

### Next.js 14 — Dashboard

**Why Next.js, not plain React:**
Server Components enable streaming the replay trace to the timeline UI without client-side state management complexity. App Router gives clean route structure for `/replay/[sessionId]` and `/incidents` views. This is the first Next.js project in the portfolio — it enters legitimately, not as a tutorial.

---

## 6. Glossary

**Vector Clock:** A data structure that tracks causal relationships between events in a distributed system. Each service maintains a counter for every other service. When service A sends a message to service B, A increments its own counter and sends the full clock. B merges the received clock with its own by taking the maximum of each counter. This creates a partial ordering of events that respects causality regardless of wall clock differences.

**Happens-Before (→):** Event A happens-before event B if A causally influenced B. If A sent a message that B received, then A → B. If A → B and B → C, then A → C (transitivity). Events with no causal relationship are called concurrent.

**Causal Ordering:** Replaying events in an order that respects happens-before relationships. If A → B, A must be replayed before B. Concurrent events can be replayed in any order.

**Deterministic Replay:** Given the same initial state and the same sequence of inputs, the system produces the same outputs. This is the property that makes replay useful for debugging — you see exactly what happened, not an approximation.

**Snapshot:** A point-in-time capture of observable system state: database row versions, queue contents, in-flight request payloads, and cache values — all tagged with a vector clock timestamp.

**Capture Agent:** A lightweight Go sidecar that intercepts HTTP calls between services, attaches vector clock headers, and writes snapshots to the snapshot store.

**Replay Orchestrator:** The Java Spring Boot service that fetches snapshots, restores database state, spins up isolated Docker environments, and replays HTTP calls in causal order.

**Mock Layer:** A component within the replay orchestrator that intercepts calls to external APIs (payment gateways, email providers, etc.) during replay and returns the captured original response — preventing real API calls during replay.

**Isolation Forest:** An unsupervised anomaly detection algorithm. It isolates anomalies by randomly partitioning the feature space — anomalies are isolated with fewer partitions (shorter paths in the isolation tree) than normal points.

**TOCTOU:** Time-of-Check-Time-of-Use. A race condition where the state checked before an operation changes before the operation executes. The ghost order bug in Section 3 is a TOCTOU race.

---

## 7. Phased Build Plan

### Phase 0 — Demo System Setup (Week 0, before time machine code)

**Goal:** A reproducible, triggerable ghost order race condition exists in a 3-service Docker Compose environment.

**Deliverables:**
- `docker-compose.yml` with order-service, payment-service, inventory-service, Postgres
- Each service: Spring Boot stub, ~100 lines, exposes required endpoints
- `trigger-race.sh`: script that fires two concurrent POST /orders requests for the same product
- Confirmed: race condition triggers in >50% of script runs

**Definition of Done:**
- `docker compose up` starts all 3 services and Postgres in under 60 seconds
- `./trigger-race.sh` produces two DB order records for one inventory item in >50% of runs
- Zero time machine code exists yet

---

### Phase 1 — Vector Clock Engine (Weeks 1–2)

**Goal:** A correct, tested Java implementation of vector clocks governing happens-before ordering.

**Deliverables:**
- `VectorClock.java` — immutable class, ~150 lines
- Methods: `tick()`, `merge(VectorClock other)`, `compare(VectorClock other)` → `CausalRelation` enum (HAPPENS_BEFORE, HAPPENS_AFTER, CONCURRENT)
- `VectorClockTest.java` — 25 unit tests minimum

**Definition of Done:**
- All 25 unit tests pass
- Adversarial concurrency test: 10 goroutines (via Kotlin coroutines or Java threads) creating concurrent events, verify all happens-before relationships hold
- Implementation matches Leslie Lamport's 1978 paper definition — verify by reading the paper and checking each property
- A distributed systems engineer can read the code and find no logical errors

**Correctness Test Cases (non-negotiable):**
```
Test 1: Single service tick increments own counter only
Test 2: Merge takes max of each counter
Test 3: A sends to B → A happens-before B
Test 4: A happens-before B, B happens-before C → A happens-before C
Test 5: Concurrent events (no causal link) → CONCURRENT result
Test 6: Identical clocks → CONCURRENT (not HAPPENS_BEFORE)
Test 7: 10-way concurrent update → no data races (run 1000x)
```

---

### Phase 2 — Go Capture Agent (Weeks 3–4)

**Goal:** HTTP middleware that intercepts inter-service calls, attaches vector clock headers, writes JSON snapshots to local disk.

**Deliverables:**
- `agent/main.go` — Go binary, <300 lines
- HTTP middleware that wraps all outbound calls from a service
- Vector clock read/increment/attach on every outbound request
- Vector clock read/merge on every inbound response
- Snapshot writer: `{service_id}_{vector_clock}_{timestamp}.json` to `/tmp/snapshots/`

**Definition of Done:**
- Agent running alongside order-service intercepts 100% of its HTTP calls to payment-service and inventory-service
- Overhead measured with Go benchmarks: <2ms p99 added latency per call
- Snapshot file written for every intercepted call with correct vector clock value
- Agent crash does not crash the wrapped service (fault isolation verified)

**Snapshot JSON Schema:**
```json
{
  "snapshot_id": "uuid",
  "service_id": "order-service",
  "vector_clock": {"order-service": 3, "payment-service": 1, "inventory-service": 2},
  "wall_clock_ms": 1234567890,
  "event_type": "HTTP_OUTBOUND",
  "request": {
    "method": "POST",
    "path": "/payments",
    "body_redacted": true,
    "headers_redacted": ["Authorization", "X-API-Key"]
  },
  "db_state_hash": "sha256_of_relevant_rows",
  "db_snapshot_ref": "s3://snapshots/order-service/db_123.sql.zst"
}
```

---

### Phase 3 — Snapshot Store API (Weeks 5–6)

**Goal:** Spring Boot REST API for storing and querying snapshots, backed by Postgres metadata + local disk (S3 in Phase 5).

**Deliverables:**
- `SnapshotController.java` — REST endpoints
- `SnapshotRepository.java` — jOOQ queries
- Endpoints:
  - `POST /snapshots` — store snapshot
  - `GET /snapshots?from=&to=&services=` — query by time range
  - `GET /snapshots/{id}/full` — fetch full snapshot for replay

**Definition of Done:**
- 100 snapshots ingested in <1 second (bulk insert benchmark)
- Time-range query returns correctly ordered results (vector clock order, not wall clock)
- Full snapshot fetch returns complete DB state reference

---

### Phase 4 — Replay Orchestrator (Weeks 7–9)

**Goal:** Spring Boot service that fetches a snapshot set, restores Postgres state, spins up isolated Docker environment, replays HTTP calls in causal vector clock order.

**Deliverables:**
- `ReplayOrchestrator.java` — main orchestration service
- `DbRestorer.java` — Postgres state restoration from snapshot
- `DockerEnvManager.java` — Testcontainers-based isolated environment
- `MockLayerInjector.java` — intercepts external API calls during replay, returns captured responses
- `ReplaySession.java` — manages replay lifecycle

**Definition of Done:**
- Given the ghost order scenario snapshots: Postgres restored to T=0 state (verified by row count + values)
- Both HTTP requests replayed in causal order (verified by vector clock sequence in replay log)
- Observable output matches original incident: two order rows created, negative inventory
- Mock layer intercepts all external calls: zero real HTTP calls made during replay
- Full replay completes in <30 seconds for the demo scenario

**Replay Fidelity Test:**
```
1. Run trigger-race.sh → capture snapshots
2. Note exact DB state after incident
3. Run replay for that time window
4. Assert replay DB state matches original incident DB state
5. Run 10 times → assert identical result every time (determinism)
```

---

### Phase 5 — Python Anomaly Detector (Weeks 10–11)

**Goal:** Lightweight ML service that watches Prometheus metrics and signals the capture agent when to snapshot.

**Deliverables:**
- `detector/main.py` — FastAPI service
- Isolation Forest model trained on simulated normal traffic patterns
- Prometheus metrics ingestion: latency p99, error rate, request rate per service
- REST endpoint: `GET /should-snapshot` → `{"snapshot": true/false, "confidence": 0.87}`

**Definition of Done:**
- Detector correctly signals snapshot=true within 500ms of race condition trigger
- False positive rate <5% on 1 hour of normal traffic simulation
- Detector adds <10ms to the snapshot decision path

---

### Phase 6 — LLM Analysis Layer (Week 12)

**Goal:** FastAPI service that receives a structured replay trace and returns a plain-English root cause analysis.

**Deliverables:**
- `analyzer/main.py` — LangGraph pipeline
- Input: structured replay trace JSON
- Output: RCA report with identified root cause, contributing conditions, suggested fix

**Definition of Done:**
- Given the ghost order replay trace, LLM output includes:
  - Identification of TOCTOU race condition
  - Specific code location (inventory read without lock)
  - Suggested fix (SELECT FOR UPDATE or distributed lock)
- RCA generated in <10 seconds

---

### Phase 7 — Next.js Dashboard (Weeks 13–14)

**Goal:** Web UI for triggering replays, visualizing causal event timelines, and reading RCA reports.

**Deliverables:**
- Timeline scrubber: visual representation of captured event window
- Service call graph: animated diagram showing inter-service calls in causal order
- DB state viewer: before/after diff for key tables
- RCA report panel: structured display of LLM output
- Replay controls: trigger, pause, step-through

**Definition of Done:**
- `docker compose up` includes Next.js dashboard
- Demo scenario fully navigable in UI without CLI commands
- Timeline correctly reflects vector clock ordering (not wall clock)

---

## 8. Out of Scope

These are explicit decisions, not oversights. Each has a reason.

| Out of Scope | Why | V2 Path |
|---|---|---|
| gRPC traffic interception | gRPC binary protocol requires a different interception strategy (HTTP/2 trailer manipulation) that would double capture agent complexity | Separate gRPC middleware module after v1 ships |
| Message queue state (Kafka, RabbitMQ) | Queue consumer state is non-deterministic to replay — requires consumer group offset management, significantly more complex | Queue replay module as separate component |
| Network partition simulation | This is chaos engineering (proactive), not replay (reactive). Different problem. | Separate tool |
| Multi-region deployment | Cross-region clock skew compounds the vector clock problem. Out of scope until single-region is proven. | After single-region is stable |
| Automatic fix generation | LLM suggests fixes. It does not apply them. Human-in-the-loop for any code changes. | Explicitly never automated — safety decision |
| Production deployment | v1 targets staging/dev environments only. Production requires security audit first. | After security review in v2 |
| Services not in the demo system | The capture agent works on order/payment/inventory services only in v1. Generalization in v2. | Plugin architecture for arbitrary services |
| Windows/macOS native agents | Go agent targets Linux only in v1. Docker handles cross-platform for dev. | Platform-specific agent builds in v2 |

---

## 9. Failure Modes

Top 3 by likelihood and impact. Mitigation is specific, not generic.

### FM-1: Capture Agent Crash Mid-Snapshot
**Likelihood:** Medium (any Go binary can panic)
**Impact:** High — partial snapshot is worse than no snapshot (misleads replay)
**Mitigation:**
- Agent writes snapshot to temp file first, renames atomically on completion
- Partial snapshots (no rename) are ignored by snapshot store on ingest
- Agent panic is isolated from wrapped service via subprocess boundary — service continues running
- Prometheus alert: `agent_panic_total > 0`

### FM-2: Postgres Restore Failure Mid-Replay
**Likelihood:** Low (but catastrophic if it happens)
**Impact:** High — corrupt replay environment produces wrong results, misleads debugging
**Mitigation:**
- Replay runs in isolated Docker container — never touches original DB
- Restore is transactional: full restore succeeds or rolls back entirely (no partial state)
- Replay orchestrator validates DB row count + schema hash post-restore before proceeding
- If validation fails: replay session marked FAILED, engineer notified, no trace produced

### FM-3: Vector Clock Ordering Violation
**Likelihood:** Low (if implementation is correct) / High (if implementation has bugs)
**Impact:** Critical — wrong causal ordering produces a replay that didn't happen, completely useless
**Mitigation:**
- 25 unit tests + adversarial concurrency test in Phase 1 (non-negotiable)
- Replay orchestrator runs a pre-replay consistency check: verify all happens-before relationships in the snapshot set are acyclic (no cycles = no ordering violations)
- If cycle detected: replay session rejected with specific violation report
- Long-term: Jepsen-style adversarial testing in CI

---

## 10. Security & Data Handling

The capture agent intercepts live HTTP traffic. This traffic contains sensitive data.

### What Gets Captured

| Data Type | Captured? | Handling |
|---|---|---|
| Request/response body | YES — but redacted | Fields matching sensitive patterns are replaced with `[REDACTED]` before write |
| HTTP headers | PARTIAL | `Authorization`, `X-API-Key`, `Cookie`, `Set-Cookie` headers always redacted |
| URL path + query params | YES | Captured as-is (assumed non-sensitive in internal service calls) |
| DB row data | YES — hashed | Full DB rows stored in encrypted snapshot; hash stored in metadata |
| Postgres credentials | NO | Agent uses read-only replica connection for state capture, not production credentials |

### Redaction Rules (Capture Agent)

```go
var sensitiveHeaders = []string{
    "Authorization",
    "X-API-Key", 
    "Cookie",
    "Set-Cookie",
    "X-Auth-Token",
}

var sensitiveBodyFields = []string{
    "password", "token", "secret", "card_number",
    "cvv", "ssn", "pan", "api_key",
}
```

### Snapshot Storage

- Snapshots stored encrypted at rest (AES-256)
- Snapshots retained for 7 days maximum (configurable), then auto-deleted
- Replay environments are ephemeral: Docker containers destroyed after replay session ends
- No snapshot data leaves the local/staging environment in v1

### What This System Does NOT Do

- Does not capture data from production databases (staging/dev only in v1)
- Does not send snapshot data to any external service
- Does not log decrypted snapshot content to stdout/stderr

---

## 11. Weekly Checkpoint Table

Print this. Check every Sunday night. If behind by >1 week, cut scope from current phase — never from a future phase.

| Week | Deliverable | Done Criteria | Blocked By |
|---|---|---|---|
| 0 | Demo system (3 services + Docker Compose) | Race condition triggers >50% of runs | Nothing |
| 1 | Vector clock core (tick, merge) | 15/25 unit tests passing | Week 0 done |
| 2 | Vector clock complete + adversarial test | All 25 tests pass, concurrency test passes | Week 1 done |
| 3 | Go capture agent (HTTP interception) | Intercepts 100% of calls, <2ms overhead | Week 2 done |
| 4 | Go capture agent (snapshot write) | JSON snapshots on disk with correct vector clocks | Week 3 done |
| 5 | Snapshot Store API (ingest) | 100 snapshots ingested in <1s | Week 4 done |
| 6 | Snapshot Store API (query) | Time-range query returns vector-clock ordered results | Week 5 done |
| 7 | Replay orchestrator (DB restore) | Postgres restored to snapshot state, verified | Week 6 done |
| 8 | Replay orchestrator (full loop) | Ghost order scenario replayed end-to-end [OK] V1 DONE | Week 7 done |
| 9 | Replay fidelity test | 10/10 identical replay outputs | Week 8 done |
| 10 | Anomaly detector | Signals within 500ms of race condition | Week 9 done |
| 11 | Anomaly detector tuned | <5% false positive rate | Week 10 done |
| 12 | LLM analysis layer | RCA identifies TOCTOU race in <10s | Week 11 done |
| 13 | Next.js dashboard (core) | Timeline + replay trigger working | Week 12 done |
| 14 | Full demo + README + demo video | `docker compose up` → full demo in 5 min | Week 13 done |

### Sunday Check Protocol

1. Can I demo what this week's deliverable said I'd build?
2. If no: am I 1 week behind or 2+ weeks behind?
3. If 1 week behind: work weekends, catch up.
4. If 2+ weeks behind: cut one deliverable from current phase, move to "stretch goals."
5. Never push the vector clock phase. It is the foundation.

---

## 12. Prerequisites & Setup

### Required Software (Install Before Week 0)

```bash
# Java 21 (required — Virtual Threads are Java 21+)
# On Ubuntu/Debian:
sudo apt install openjdk-21-jdk
java -version  # must show: openjdk 21

# Gradle 8.5+
sdk install gradle 8.5  # use SDKMAN
gradle -v

# Go 1.22+
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
go version  # must show: go1.22

# Node.js 20 LTS (for Next.js)
nvm install 20
node -v  # must show: v20.x

# Docker + Docker Compose
sudo apt install docker.io docker-compose-plugin
docker compose version  # must show: v2.x

# Python 3.11+
python3 --version  # check existing
pip install fastapi uvicorn scikit-learn langchain langgraph

# Verify all at once:
java -version && go version && node -v && docker compose version && python3 --version
```

### Project Structure

```
time-machine/
├── PRD.md                          ← this document
├── VISION.md                       ← positioning, moonshot, open-source strategy
├── docker-compose.yml              ← full system
├── trigger-race.sh                 ← demo bug trigger
│
├── demo-system/                    ← Phase 0: target services
│   ├── order-service/              ← Spring Boot
│   ├── payment-service/            ← Spring Boot
│   └── inventory-service/          ← Spring Boot
│
├── capture-agent/                  ← Phase 2: Go sidecar
│   ├── main.go
│   ├── middleware.go
│   ├── vector_clock.go
│   └── snapshot_writer.go
│
├── orchestrator/                   ← Phases 1,3,4: Java Spring Boot
│   └── src/main/java/
│       ├── clock/VectorClock.java
│       ├── store/SnapshotController.java
│       └── replay/ReplayOrchestrator.java
│
├── anomaly-detector/               ← Phase 5: Python FastAPI
│   └── detector/main.py
│
├── llm-analyzer/                   ← Phase 6: Python LangGraph
│   └── analyzer/main.py
│
└── dashboard/                      ← Phase 7: Next.js 14
    └── src/app/
```

### Verification Checkpoint (Run Before Week 1)

```bash
# Start demo system
docker compose up demo-system

# Trigger the race condition
./trigger-race.sh

# Verify ghost order exists
docker compose exec postgres psql -U postgres -c \
  "SELECT COUNT(*) FROM orders WHERE product_id='PRODUCT_X';"
# Expected: 2 (not 1)

# If count is 2: you're ready to start building the time machine.
# If count is 1: the race condition isn't triggering. Fix trigger-race.sh first.
```

---

## Appendix: Interview Answer Template

When asked to describe this project in an interview:

> "I built a causal snapshot and replay system for distributed microservices — essentially a DVR for production incidents. The core problem is that distributed system state is ephemeral: by the time you're paged, the state that caused the bug is gone.
>
> The technical foundation is vector clocks for causal ordering. Distributed wall clocks lie — two services can disagree on timestamps by milliseconds. Vector clocks establish happens-before relationships independent of wall time. My Go capture agent intercepts all inter-service HTTP calls, attaches vector clock headers, and writes compressed snapshots of DB state and request payloads.
>
> The Java Spring Boot replay orchestrator fetches a snapshot window, restores Postgres to the exact state at incident start, spins up an isolated Docker environment, and replays HTTP calls in causal vector clock order — not wall clock order. A mock layer intercepts external API calls and returns the captured original responses, so the replay is deterministic.
>
> On top of that I have a Python anomaly detector that gates snapshot creation so we're not storing gigabytes of normal traffic. An LLM analysis layer reads the replay trace and generates a plain-English root cause report. The whole thing is demoed with a ghost order race condition — two concurrent checkout requests for one item — that produces negative inventory. The time machine replays it in under 30 seconds and the root cause is visible without a single log file."

---

*PRD v1.0 — subject to revision as build progresses. Scope cuts go in the weekly checkpoint table, not in this document.*
