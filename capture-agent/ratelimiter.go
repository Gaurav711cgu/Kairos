package main

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// TokenBucketLimiter implements the Token Bucket algorithm for backpressure.
//
// CUSTOMER POV: "The system slows down every Monday morning when everyone starts work."
//
// WHY TOKEN BUCKET AT AMAZON:
// When the Java Saga Orchestrator is overloaded, the Go capture agent must
// apply backpressure instead of blindly forwarding requests that will
// timeout or cause cascading failures.
//
// Mathematical guarantee:
//   - Sustained throughput is strictly bounded to refillRate tokens/sec
//   - Short bursts up to `capacity` tokens are allowed
//   - This is the algorithm used by AWS API Gateway throttling
type TokenBucketLimiter struct {
	capacity   int64
	refillRate time.Duration // Duration per token refill
	tokens     atomic.Int64
	mu         sync.Mutex
	stopCh     chan struct{}
}

// NewTokenBucketLimiter creates a new rate limiter.
// capacity: max burst size
// refillRate: how often to add 1 token (e.g., 20ms = 50 tokens/sec)
func NewTokenBucketLimiter(capacity int64, refillRate time.Duration) *TokenBucketLimiter {
	limiter := &TokenBucketLimiter{
		capacity:   capacity,
		refillRate: refillRate,
		stopCh:     make(chan struct{}),
	}
	// Start full
	limiter.tokens.Store(capacity)
	go limiter.refillLoop()
	return limiter
}

// Allow atomically checks and consumes a token.
// Returns false if no tokens available (caller should apply backpressure: drop or queue).
func (l *TokenBucketLimiter) Allow() bool {
	for {
		current := l.tokens.Load()
		if current <= 0 {
			return false // Backpressure: bucket empty
		}
		// CAS loop for lock-free atomic decrement
		if l.tokens.CompareAndSwap(current, current-1) {
			return true
		}
		// CAS failed (race): retry
	}
}

// refillLoop runs in a background goroutine, adding 1 token every refillRate.
func (l *TokenBucketLimiter) refillLoop() {
	ticker := time.NewTicker(l.refillRate)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			for {
				current := l.tokens.Load()
				if current >= l.capacity {
					break // Already full
				}
				if l.tokens.CompareAndSwap(current, current+1) {
					break
				}
			}
		case <-l.stopCh:
			return
		}
	}
}

func (l *TokenBucketLimiter) Stop() {
	close(l.stopCh)
}

func (l *TokenBucketLimiter) Stats() string {
	return fmt.Sprintf("TokenBucket[capacity=%d, current_tokens=%d, refill_rate=%s]",
		l.capacity, l.tokens.Load(), l.refillRate)
}
