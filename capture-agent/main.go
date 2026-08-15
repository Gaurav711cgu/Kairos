package main

import (
    "context"
    "log/slog"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"
)

func main() {
    // Configuration from environment
    cfg := Config{
        ListenAddr:        getEnv("LISTEN_ADDR", ":8080"),
        UpstreamHost:     getEnv("UPSTREAM_HOST", "localhost:8081"),
        ServiceID:        getEnv("SERVICE_ID", "order-service"),
        SnapshotStoreURL: getEnv("SNAPSHOT_STORE_URL", "http://localhost:8090"),
        SupabaseURL:      getEnv("SUPABASE_URL", ""),
        SupabaseKey:      getEnv("SUPABASE_ACCESS_KEY", ""),
        SupabaseSecret:   getEnv("SUPABASE_SECRET_KEY", ""),
        SupabaseBucket:   getEnv("SUPABASE_BUCKET", "snapshots"),
        ChannelSize:      100,
        SemaphoreSize:    5,
    }
    
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
    slog.SetDefault(logger)
    
    agent := NewAgent(cfg)
    
    // Start background snapshot writer
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()
    go agent.RunSnapshotWriter(ctx)
    
    // HTTP server with graceful shutdown
    srv := &http.Server{
        Addr:         cfg.ListenAddr,
        Handler:      agent,
        ReadTimeout:  30 * time.Second,
        WriteTimeout: 30 * time.Second,
    }
    
    // Prometheus metrics endpoint on :2112
    go func() {
        http.Handle("/metrics", agent.MetricsHandler())
        http.ListenAndServe(":2112", nil)
    }()
    
    go func() {
        slog.Info("capture agent started", "addr", cfg.ListenAddr, "upstream", cfg.UpstreamHost)
        if err := srv.ListenAndServe(); err != http.ErrServerClosed {
            slog.Error("server error", "err", err)
            os.Exit(1)
        }
    }()
    
    // Graceful shutdown
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
    <-sigCh
    
    slog.Info("shutting down gracefully")
    shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer shutdownCancel()
    srv.Shutdown(shutdownCtx)
}

func getEnv(key, defaultVal string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return defaultVal
}

type Config struct {
    ListenAddr        string
    UpstreamHost     string
    ServiceID        string
    SnapshotStoreURL string
    SupabaseURL      string
    SupabaseKey      string
    SupabaseSecret   string
    SupabaseBucket   string
    ChannelSize      int
    SemaphoreSize    int
}
