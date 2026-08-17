package main

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "log/slog"
    "net/http"
    "time"

    "github.com/klauspost/compress/zstd"
    "golang.org/x/sync/semaphore"
    "io"
    "sync"
)

type RawSnapshot struct {
    SnapshotID      string
    ServiceID       string
    TraceID         string
    VectorClock     string // JSON
    Method          string
    Path            string
    RequestHeaders  map[string]string
    RequestBody     []byte
    ResponseStatus  int
    ResponseHeaders map[string]string
    ResponseBody    []byte
    LatencyMs       int64
    CapturedAt      time.Time
}

type SnapshotWriter struct {
    cfg       Config
    ch        <-chan RawSnapshot
    sem       *semaphore.Weighted
    encPool   sync.Pool
    client    *http.Client
    metrics   *AgentMetrics
}

func NewSnapshotWriter(cfg Config, ch <-chan RawSnapshot, m *AgentMetrics) *SnapshotWriter {
    return &SnapshotWriter{
        cfg:     cfg,
        ch:      ch,
        sem:     semaphore.NewWeighted(int64(cfg.SemaphoreSize)),
        encPool: sync.Pool{
            New: func() any {
                enc, _ := zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.SpeedDefault))
                return enc
            },
        },
        client:  &http.Client{Timeout: 10 * time.Second},
        metrics: m,
    }
}

func (w *SnapshotWriter) Run(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            slog.Info("snapshot writer stopping")
            return
        case snap, ok := <-w.ch:
            if !ok {
                return
            }
            // Acquire semaphore (max 5 concurrent writes)
            // Non-blocking: if all 5 permits taken, drop and log
            if !w.sem.TryAcquire(1) {
                slog.Warn("semaphore full — dropping snapshot", "snapshotId", snap.SnapshotID)
                w.metrics.SnapshotDropped.Inc()
                continue
            }
            go func(s RawSnapshot) {
                defer w.sem.Release(1)
                if err := w.write(ctx, s); err != nil {
                    slog.Error("snapshot write failed", "snapshotId", s.SnapshotID, "err", err)
                    w.metrics.WriteErrors.Inc()
                }
            }(snap)
        }
    }
}

func (w *SnapshotWriter) write(ctx context.Context, snap RawSnapshot) error {
    // 1. Serialize full payload as JSON
    payload := map[string]any{
        "snapshot_id":      snap.SnapshotID,
        "service_id":       snap.ServiceID,
        "trace_id":         snap.TraceID,
        "vector_clock":     snap.VectorClock,
        "method":           snap.Method,
        "path":             snap.Path,
        "request_headers":  snap.RequestHeaders,
        "request_body":     string(snap.RequestBody),
        "response_status":  snap.ResponseStatus,
        "response_headers": snap.ResponseHeaders,
        "response_body":    string(snap.ResponseBody),
        "latency_ms":       snap.LatencyMs,
        "captured_at":      snap.CapturedAt.Format(time.RFC3339Nano),
        "schema_version":   1,
    }
    payloadJSON, err := json.Marshal(payload)
    if err != nil {
        return fmt.Errorf("marshal: %w", err)
    }
    
    // 2. zstd compress (level 3, ~50-100μs for 10KB payload)
    enc := w.encPool.Get().(*zstd.Encoder)
    compressed := enc.EncodeAll(payloadJSON, make([]byte, 0, len(payloadJSON)/3))
    w.encPool.Put(enc)

    req, err := http.NewRequestWithContext(ctx, http.MethodPost,
        w.cfg.SnapshotStoreURL+"/snapshots",
        bytes.NewReader(compressed))
    if err != nil {
        return fmt.Errorf("build request: %w", err)
    }
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Content-Encoding", "zstd")

    resp, err := w.client.Do(req)
    if err != nil {
        return fmt.Errorf("post to store: %w", err)
    }
    defer resp.Body.Close()
    io.Copy(io.Discard, resp.Body)

    if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
        slog.Warn("snapshot store returned non-201", "status", resp.StatusCode, "id", snap.SnapshotID)
        return fmt.Errorf("unexpected status: %d", resp.StatusCode)
    }

    w.metrics.SnapshotWritten.Inc()

    slog.Debug("snapshot written",
        "id", snap.SnapshotID,
        "service", snap.ServiceID,
        "path", snap.Path,
        "compressedBytes", len(compressed),
        "originalBytes", len(payloadJSON))

    return nil
}
