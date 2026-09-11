package main

import (
    "net/http"
    

    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

type AgentMetrics struct {
    RequestTotal    prometheus.Counter
    RequestLatency  prometheus.Observer
    SnapshotQueued  prometheus.Counter
    SnapshotWritten prometheus.Counter
    SnapshotDropped prometheus.Counter
    WriteErrors     prometheus.Counter
    registry        *prometheus.Registry
}

func NewAgentMetrics() *AgentMetrics {
    reg := prometheus.NewRegistry()
    
    requestTotal := prometheus.NewCounter(prometheus.CounterOpts{
        Name: "capture_agent_requests_total",
        Help: "Total intercepted HTTP requests",
    })
    
    requestLatencyHist := prometheus.NewHistogram(prometheus.HistogramOpts{
        Name:    "capture_agent_request_latency_microseconds",
        Help:    "Added latency by capture agent (microseconds)",
        Buckets: []float64{10, 50, 100, 200, 500, 1000, 2000, 5000},
    })
    
    snapshotQueued := prometheus.NewCounter(prometheus.CounterOpts{
        Name: "capture_agent_snapshots_queued_total",
        Help: "Snapshots successfully queued",
    })
    
    snapshotWritten := prometheus.NewCounter(prometheus.CounterOpts{
        Name: "capture_agent_snapshots_written_total",
        Help: "Snapshots successfully written to store",
    })
    
    snapshotDropped := prometheus.NewCounter(prometheus.CounterOpts{
        Name: "capture_agent_snapshots_dropped_total",
        Help: "Snapshots dropped due to backpressure",
    })
    
    writeErrors := prometheus.NewCounter(prometheus.CounterOpts{
        Name: "capture_agent_write_errors_total",
        Help: "Snapshot write failures",
    })
    
    reg.MustRegister(requestTotal, requestLatencyHist, snapshotQueued,
        snapshotWritten, snapshotDropped, writeErrors)
    
    m := &AgentMetrics{
        RequestTotal:    requestTotal,
        RequestLatency:  requestLatencyHist,
        SnapshotQueued:  snapshotQueued,
        SnapshotWritten: snapshotWritten,
        SnapshotDropped: snapshotDropped,
        WriteErrors:     writeErrors,
    }
    
    // Store registry for handler
    m.registry = reg
    
    return m
}

func (m *AgentMetrics) Handler() http.Handler { return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{}) }
