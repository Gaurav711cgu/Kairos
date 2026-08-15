package main

import (
    "bytes"
    "context"
    "io"
    "log/slog"
    "net/http"
    "net/http/httputil"
    "net/url"
    "time"

    "github.com/google/uuid"
)

type Agent struct {
    cfg        Config
    proxy      *httputil.ReverseProxy
    clock      *ThreadSafeVectorClock
    snapCh     chan RawSnapshot
    ringBuffer *CircularRingBuffer
    metrics    *AgentMetrics
    writer     *SnapshotWriter
}

func NewAgent(cfg Config) *Agent {
    target, _ := url.Parse("http://" + cfg.UpstreamHost)
    proxy := httputil.NewSingleHostReverseProxy(target)
    
    // Tune transport for high throughput
    proxy.Transport = &http.Transport{
        MaxIdleConnsPerHost: 100,
        IdleConnTimeout:     90 * time.Second,
    }
    
    metrics := NewAgentMetrics()
    snapCh := make(chan RawSnapshot, cfg.ChannelSize)
    ringBuffer := NewCircularRingBuffer(1000)
    writer := NewSnapshotWriter(cfg, snapCh, metrics)
    
    return &Agent{
        cfg:        cfg,
        proxy:      proxy,
        clock:      NewVectorClock(cfg.ServiceID),
        snapCh:     snapCh,
        ringBuffer: ringBuffer,
        metrics:    metrics,
        writer:     writer,
    }
}

func (a *Agent) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    start := time.Now()
    
    // 1. Ensure deterministic trace ID
    traceID := r.Header.Get("X-Trace-Id")
    if traceID == "" {
        traceID = uuid.New().String()
    }
    
    // 2. Tick bounded vector clock & HLC
    vcSnapshot := a.clock.Tick(a.cfg.ServiceID)
    capturedTimestamp := start.UTC().Format(time.RFC3339Nano)
    
    // 3. Capture request body for snapshot
    var reqBody []byte
    if r.Body != nil && r.ContentLength != 0 && r.ContentLength < 1*1024*1024 { // max 1MB
        reqBody, _ = io.ReadAll(io.LimitReader(r.Body, 1*1024*1024))
        r.Body = io.NopCloser(bytes.NewReader(reqBody))
    }
    
    // 4. Attach deterministic entropy & causal headers to outgoing request
    outReq := r.Clone(r.Context())
    outReq.URL.Host = a.cfg.UpstreamHost
    outReq.URL.Scheme = "http"
    outReq.Header.Set("X-Vector-Clock", vcSnapshot.ToHeader())
    outReq.Header.Set("X-HLC", vcSnapshot.HLC().String())
    outReq.Header.Set("X-Trace-Id", traceID)
    outReq.Header.Set("X-Captured-Timestamp", capturedTimestamp)
    outReq.Header.Set("X-Replay-Seed", traceID)
    outReq.Host = a.cfg.UpstreamHost
    
    // 5. Capture response
    rec := NewResponseRecorder(w)
    a.proxy.ServeHTTP(rec, outReq)
    
    latency := time.Since(start)
    
    // 6. Merge response vector clock
    if respVC := rec.Header().Get("X-Vector-Clock"); respVC != "" {
        a.clock.Merge(respVC)
    }
    
    // 7. Store in circular in-memory ring buffer (allocation-free O(1))
    snap := RawSnapshot{
        SnapshotID:      uuid.New().String(),
        ServiceID:       a.cfg.ServiceID,
        TraceID:         traceID,
        VectorClock:     vcSnapshot.ToJSON(),
        Method:          r.Method,
        Path:            r.URL.Path,
        RequestHeaders:  redactHeaders(r.Header),
        RequestBody:     reqBody,
        ResponseStatus:  rec.StatusCode,
        ResponseHeaders: redactHeaders(rec.Header()),
        ResponseBody:    rec.Body(),
        LatencyMs:       latency.Milliseconds(),
        CapturedAt:      time.Now().UTC(),
    }
    a.ringBuffer.Push(snap)
    
    // 8. NON-BLOCKING snapshot enqueue with load-shedding
    select {
    case a.snapCh <- snap:
        a.metrics.SnapshotQueued.Inc()
    default:
        a.metrics.SnapshotDropped.Inc()
        slog.Warn("snapshot channel full - load shedding",
            "channelSize", cap(a.snapCh), "dropped", a.metrics.DroppedTotal())
    }
    
    a.metrics.RequestLatency.Observe(float64(latency.Microseconds()))
    a.metrics.RequestTotal.Inc()
}

func (a *Agent) MetricsHandler() http.Handler {
    return a.metrics.Handler()
}

func (a *Agent) RunSnapshotWriter(ctx context.Context) {
    a.writer.Run(ctx)
}

// ResponseRecorder wraps http.ResponseWriter to capture response
type ResponseRecorder struct {
    http.ResponseWriter
    StatusCode int
    body       *bytes.Buffer
}

func NewResponseRecorder(w http.ResponseWriter) *ResponseRecorder {
    return &ResponseRecorder{ResponseWriter: w, StatusCode: http.StatusOK, body: &bytes.Buffer{}}
}

func (r *ResponseRecorder) WriteHeader(code int) {
    r.StatusCode = code
    r.ResponseWriter.WriteHeader(code)
}

func (r *ResponseRecorder) Write(b []byte) (int, error) {
    if r.body.Len() < 1*1024*1024 { // Cap captured body at 1MB
        r.body.Write(b)
    }
    return r.ResponseWriter.Write(b)
}

func (r *ResponseRecorder) Body() []byte { return r.body.Bytes() }
