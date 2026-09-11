package main

import (
    "sync"
    "time"
)

// CircularRingBuffer holds recent snapshots in memory without allocating new slices
type CircularRingBuffer struct {
    mu       sync.RWMutex
    buffer   []RawSnapshot
    capacity int
    head     int
    count    int
}

func NewCircularRingBuffer(capacity int) *CircularRingBuffer {
    if capacity <= 0 {
        capacity = 1000
    }
    return &CircularRingBuffer{
        buffer:   make([]RawSnapshot, capacity),
        capacity: capacity,
    }
}

// Push adds a snapshot to the ring, overwriting the oldest if full (O(1) allocation-free)
func (r *CircularRingBuffer) Push(snap RawSnapshot) {
    r.mu.Lock()
    defer r.mu.Unlock()

    r.buffer[r.head] = snap
    r.head = (r.head + 1) % r.capacity
    if r.count < r.capacity {
        r.count++
    }
}

// GetRecentWindow returns all snapshots captured within the last windowDuration
func (r *CircularRingBuffer) GetRecentWindow(windowDuration time.Duration) []RawSnapshot {
    r.mu.RLock()
    defer r.mu.RUnlock()

    cutoff := time.Now().UTC().Add(-windowDuration)
    result := make([]RawSnapshot, 0, r.count)

    for i := 0; i < r.count; i++ {
        idx := (r.head - 1 - i + r.capacity) % r.capacity
        snap := r.buffer[idx]
        if snap.CapturedAt.Before(cutoff) {
            continue
        }
        result = append(result, snap)
    }

    // Reverse to chronological order
    for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
        result[i], result[j] = result[j], result[i]
    }

    return result
}

func (r *CircularRingBuffer) Size() int {
    r.mu.RLock()
    defer r.mu.RUnlock()
    return r.count
}
