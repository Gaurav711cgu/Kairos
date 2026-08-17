# Kairos System Architecture

Kairos is a deterministic distributed state capture and causal replay time machine for microservice architectures. It captures distributed HTTP transactions across service boundaries, attaches vector clock metadata, detects concurrency anomalies (e.g. TOCTOU race conditions) using unsupervised Isolation Forest ML, and replays execution traces inside isolated sandbox databases to perform automated LLM root cause analysis (RCA).

---

## 1. System Topology & Data Flow

```mermaid
flowchart TD
    Client([Client / Test Traffic]) -->|HTTP Requests| CA[Go Capture Agent :8080]
    
    subgraph Target Microservices
        CA -->|Reverse Proxy| OS[order-service :8081]
        OS -->|REST Check| IS[inventory-service :8082]
        OS -->|REST Charge| PS[payment-service :8083]
        IS -->|Postgres Wire| DB[(PostgreSQL :5432)]
    end

    subgraph Ingestion Pipeline
        CA -->|Async zstd Snapshot| SS[Snapshot Store API :8090]
        SS -->|Persist JSONB| DB
        SS -->|Flush zstd| DISK[(Local / S3 Storage)]
    end

    subgraph Replay & Analysis Engine
        ORC[Replay Orchestrator :8090] -->|Fetch Causal Sequence| SS
        ORC -->|1. Restore Schema| DB_BOX[(Sandbox DB / Testcontainers)]
        ORC -->|2. Start WireMock| WM[WireMock Mock Layer]
        ORC -->|3. Concurrent Virtual Threads| REPLAY[HTTP Replay Worker]
        REPLAY -->|Replayed Requests| OS
        REPLAY -->|Inspect State| DB_BOX
        ORC -->|4. Feature Inference| AD[Anomaly Detector :8091]
        ORC -->|5. Structured RCA Prompt| LLM[LLM Analyzer :8092]
    end

    subgraph Observability & Control Plane
        DASH[Next.js 14 Dashboard :3000] -->|Session REST API| ORC
        PROM[Prometheus :9090] -->|Scrape /metrics| CA
        PROM -->|Scrape /actuator| ORC
        PROM -->|Scrape /metrics| AD
        PROM -->|Scrape /metrics| LLM
        GRAF[Grafana :3001] -->|Query| PROM
    end
```

---

## 2. Distributed Saga Replay Lifecycle

The replay orchestrator executes an 8-stage distributed saga with automatic resource cleanup and fail-closed egress boundaries:

```mermaid
sequenceDiagram
    autonumber
    participant UI as Next.js Dashboard (:3000)
    participant O as Replay Orchestrator (:8090)
    participant D as Isolated DB Sandbox (Testcontainers / Neon)
    participant W as WireMock (:dynamic)
    participant R as HTTP Virtual Thread Replayer
    participant A as Isolation Forest (:8091)
    participant L as LLM Analyzer (:8092)

    UI->>O: POST /replay (sessionId, traceId)
    Note over O: Stage 1: Resource Acquisition (Semaphore Guard)
    O->>D: Stage 2: Provision Isolated DB Sandbox
    D-->>O: Sandbox Ready (JDBC URI)
    O->>W: Stage 3: Start Mock Layer & Inject Baseline Stubs
    W-->>O: Mock Server Up (Fail-Closed 503 Guard)
    O->>O: Stage 4: Validate Causal DAG Acyclicity (3-Color DFS)
    O->>R: Stage 5: Dispatch Replay in Topological Causal Tiers
    Note over R: Concurrent Virtual Threads Fire in Parallel
    R->>D: Inspect DB State Mutation (Stock Before/After)
    R-->>O: Return Replay Trace Events
    O->>A: Stage 6: Predict Anomaly Score (5-Feature Vector)
    A-->>O: Return Score & Confidence
    O->>L: Stage 7: Request Structured RCA (ReplayTrace + Diffs)
    L-->>O: Return RcaReport (RootCause, CodeFix, Diff)
    O->>UI: Stage 8: Persist Session & Stream Complete Status
    Note over O,W: Automatic Saga Compensation & Teardown
```

---

## 3. Causal Consistency & Vector Clock Model

Kairos rejects wall-clock ordering (NTP skew, Leap Seconds) and guarantees causal consistency using bounded Vector Clocks and Hybrid Logical Clocks (HLC):

```mermaid
flowchart LR
    subgraph Order Service
        E1["Order A (Alice)<br/>VC: {order: 1}<br/>HLC: (T1, 0)"]
        E2["Order B (Bob)<br/>VC: {order: 2}<br/>HLC: (T2, 0)"]
    end

    subgraph Inventory Service
        E3["Read Stock A<br/>VC: {order: 1, inv: 1}"]
        E4["Read Stock B<br/>VC: {order: 2, inv: 1}"]
        E5["Decrement A<br/>VC: {order: 1, inv: 2}"]
        E6["Decrement B<br/>VC: {order: 2, inv: 2}"]
    end

    E1 --> E3
    E2 --> E4
    E3 -. Concurrent .-> E4
    E3 --> E5
    E4 --> E6
    E5 -. Race Detected (Stock = -1) .-> E6
```

---

## 4. Component Port & Responsibility Matrix

| Component | Port | Technology | Primary Responsibility |
|---|---|---|---|
| **Capture Agent** | `8080` (public) | Go 1.22 | Zero-allocation reverse proxy, vector clock injection, zstd async streaming, non-blocking ring buffer load-shedding |
| **Order Service (Internal)** | `8081` | Spring Boot 3.2 (Java 21) | Target demo e-commerce checkout orchestrator with deterministic seed support (`X-Replay-Seed`) |
| **Inventory Service** | `8082` | Spring Boot 3.2 (Java 21) | Target stock management service with intentional un-guarded read-decrement race condition |
| **Payment Service** | `8083` | Spring Boot 3.2 (Java 21) | Simulated payment processing gateway with 40ms intentional latency |
| **Replay Orchestrator** | `8090` | Spring Boot 3.2 (Java 21 Loom) | 8-step Saga coordinator, causal DAG tier execution via Virtual Threads, CQRS projection worker |
| **Anomaly Detector** | `8091` | FastAPI + Scikit-Learn | Real-time Isolation Forest inference on 5-feature traffic metric windows (`< 1ms` latency) |
| **LLM Analyzer** | `8092` | FastAPI + LangChain + Gemini | Automated Root Cause Analysis (RCA), generating structured git diff patches and confidence metrics |
| **Dashboard** | `3000` | Next.js 14 + D3.js | Interactive causal timeline visualization, DB diff inspection, and replay controls |
| **PostgreSQL** | `5432` | PostgreSQL 15 | Persistent snapshot store, materialized causal ordering tables, and target inventory catalog |
| **Prometheus** | `9090` | Prometheus v2.48 | Distributed metric scraping across all Go, Java, and Python microservices |
| **Grafana** | `3001` | Grafana v10.2 | Real-time telemetry visualization for sidecar overhead, queue depth, and anomaly rates |

---

## 5. Failure Modes & Resilience Engineering

1. **Carrier Thread Pinning Prevention**: Database IO operations during replay are scheduled on dedicated platform thread pools (`kairos-db-io`) rather than pinning Virtual Thread carrier threads during JDBC socket blocking.
2. **Fail-Closed Egress Isolation**: During replay, all outbound network calls are intercepted by WireMock. Any unrecorded downstream request receives an immediate HTTP 503 response to prevent accidental real-world side effects.
3. **Capture Agent Load Shedding**: If the snapshot worker channel fills past capacity, the capture agent sheds snapshot persistence non-blockingly while preserving user-facing proxy throughput.
4. **Saga Teardown Guarantees**: Sandbox database containers (Testcontainers) and ephemeral cloud branches (Neon) implement `AutoCloseable` lifecycle hooks to guarantee resource reclamation even on replay errors.
