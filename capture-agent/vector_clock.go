package main

import (
    "fmt"
    "sort"
    "strconv"
    "strings"
    "sync"
)

// ThreadSafeVectorClock: mutable, goroutine-safe, used by the agent
type ThreadSafeVectorClock struct {
    mu     sync.RWMutex
    clocks map[string]uint64
}

func NewVectorClock(serviceIDs ...string) *ThreadSafeVectorClock {
    vc := &ThreadSafeVectorClock{clocks: make(map[string]uint64)}
    for _, id := range serviceIDs {
        vc.clocks[id] = 0
    }
    return vc
}

// Tick increments the local service counter and returns the new clock snapshot
func (vc *ThreadSafeVectorClock) Tick(serviceID string) VectorClockSnapshot {
    vc.mu.Lock()
    defer vc.mu.Unlock()
    vc.clocks[serviceID]++
    return vc.snapshot()
}

// Merge performs component-wise max with the given header value
func (vc *ThreadSafeVectorClock) Merge(header string) {
    other, err := parseHeader(header)
    if err != nil || len(other) == 0 {
        return
    }
    vc.mu.Lock()
    defer vc.mu.Unlock()
    for svc, v := range other {
        if current, ok := vc.clocks[svc]; !ok || v > current {
            vc.clocks[svc] = v
        }
    }
}

// VectorClockSnapshot is an immutable point-in-time copy
type VectorClockSnapshot struct {
    clocks map[string]uint64
}

func (s VectorClockSnapshot) ToHeader() string {
    parts := make([]string, 0, len(s.clocks))
    for svc, v := range s.clocks {
        parts = append(parts, fmt.Sprintf("%s:%d", svc, v))
    }
    // Sort for deterministic output
    sort.Strings(parts)
    return strings.Join(parts, ",")
}

func (s VectorClockSnapshot) ToJSON() string {
    parts := make([]string, 0, len(s.clocks))
    for svc, v := range s.clocks {
        parts = append(parts, fmt.Sprintf("%q:%d", svc, v))
    }
    sort.Strings(parts)
    return "{" + strings.Join(parts, ",") + "}"
}

func (vc *ThreadSafeVectorClock) snapshot() VectorClockSnapshot {
    c := make(map[string]uint64, len(vc.clocks))
    for k, v := range vc.clocks {
        c[k] = v
    }
    return VectorClockSnapshot{clocks: c}
}

func parseHeader(header string) (map[string]uint64, error) {
    if header == "" {
        return nil, nil
    }
    result := make(map[string]uint64)
    for _, part := range strings.Split(header, ",") {
        kv := strings.SplitN(strings.TrimSpace(part), ":", 2)
        if len(kv) != 2 {
            continue
        }
        v, err := strconv.ParseUint(strings.TrimSpace(kv[1]), 10, 64)
        if err != nil {
            return nil, err
        }
        result[strings.TrimSpace(kv[0])] = v
    }
    return result, nil
}
