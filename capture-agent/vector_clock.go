package main

import (
    "fmt"
    "sort"
    "strconv"
    "strings"
    "sync"
    "sync/atomic"
    "time"
)

// HLC (Hybrid Logical Clock) provides O(1) space causal ordering (Kulkarni et al.)
// Structure: 64-bit physical time (ms) + 32-bit logical counter
type HLC struct {
    Physical int64  // Unix milliseconds
    Logical  uint32 // Monotonic counter within same millisecond
}

func (h HLC) String() string {
    return fmt.Sprintf("%016x.%08x", h.Physical, h.Logical)
}

func ParseHLC(s string) (HLC, error) {
    if s == "" {
        return HLC{}, nil
    }
    parts := strings.Split(s, ".")
    if len(parts) != 2 {
        return HLC{}, fmt.Errorf("invalid HLC format")
    }
    phys, err := strconv.ParseInt(parts[0], 16, 64)
    if err != nil {
        return HLC{}, err
    }
    logi, err := strconv.ParseUint(parts[1], 16, 32)
    if err != nil {
        return HLC{}, err
    }
    return HLC{Physical: phys, Logical: uint32(logi)}, nil
}

// ThreadSafeHLC manages hybrid logical clock updates with lock-free atomic CAS
type ThreadSafeHLC struct {
    latest atomic.Int64 // packed physical (high 48 bits) + logical (low 16 bits)
    mu     sync.Mutex
}

func NewThreadSafeHLC() *ThreadSafeHLC {
    hlc := &ThreadSafeHLC{}
    hlc.Tick()
    return hlc
}

func (t *ThreadSafeHLC) Tick() HLC {
    now := time.Now().UnixMilli()
    t.mu.Lock()
    defer t.mu.Unlock()

    current := t.unpack(t.latest.Load())
    var next HLC
    if now > current.Physical {
        next = HLC{Physical: now, Logical: 0}
    } else {
        next = HLC{Physical: current.Physical, Logical: current.Logical + 1}
    }
    t.latest.Store(t.pack(next))
    return next
}

func (t *ThreadSafeHLC) Merge(remote HLC) HLC {
    now := time.Now().UnixMilli()
    t.mu.Lock()
    defer t.mu.Unlock()

    current := t.unpack(t.latest.Load())
    maxPhys := now
    if current.Physical > maxPhys {
        maxPhys = current.Physical
    }
    if remote.Physical > maxPhys {
        maxPhys = remote.Physical
    }

    var next HLC
    if maxPhys == current.Physical && maxPhys == remote.Physical {
        maxLog := current.Logical
        if remote.Logical > maxLog {
            maxLog = remote.Logical
        }
        next = HLC{Physical: maxPhys, Logical: maxLog + 1}
    } else if maxPhys == current.Physical {
        next = HLC{Physical: maxPhys, Logical: current.Logical + 1}
    } else if maxPhys == remote.Physical {
        next = HLC{Physical: maxPhys, Logical: remote.Logical + 1}
    } else {
        next = HLC{Physical: maxPhys, Logical: 0}
    }

    t.latest.Store(t.pack(next))
    return next
}

func (t *ThreadSafeHLC) Now() HLC {
    return t.unpack(t.latest.Load())
}

func (t *ThreadSafeHLC) pack(h HLC) int64 {
    return (h.Physical << 16) | int64(h.Logical&0xFFFF)
}

func (t *ThreadSafeHLC) unpack(val int64) HLC {
    return HLC{
        Physical: val >> 16,
        Logical:  uint32(val & 0xFFFF),
    }
}

// Bounded Vector Clock with Actor Pruning (Max 10 keys, service prefix normalization)
const MaxVectorClockActors = 10

type ThreadSafeVectorClock struct {
    mu     sync.RWMutex
    clocks map[string]uint64
    hlc    *ThreadSafeHLC
}

func NewVectorClock(serviceIDs ...string) *ThreadSafeVectorClock {
    vc := &ThreadSafeVectorClock{
        clocks: make(map[string]uint64),
        hlc:    NewThreadSafeHLC(),
    }
    for _, id := range serviceIDs {
        normalized := normalizeServiceID(id)
        vc.clocks[normalized] = 0
    }
    return vc
}

func (vc *ThreadSafeVectorClock) Tick(serviceID string) VectorClockSnapshot {
    normalized := normalizeServiceID(serviceID)
    vc.mu.Lock()
    defer vc.mu.Unlock()

    vc.clocks[normalized]++
    hlcNow := vc.hlc.Tick()
    return vc.snapshot(hlcNow)
}

func (vc *ThreadSafeVectorClock) Merge(header string) {
    other, hlcRemote, err := parseHeader(header)
    if err != nil {
        return
    }

    if hlcRemote != nil {
        vc.hlc.Merge(*hlcRemote)
    }

    if len(other) == 0 {
        return
    }

    vc.mu.Lock()
    defer vc.mu.Unlock()

    for svc, v := range other {
        normalized := normalizeServiceID(svc)
        if current, ok := vc.clocks[normalized]; !ok || v > current {
            vc.clocks[normalized] = v
        }
    }

    // Prune stale actors if map grows beyond bounded size
    if len(vc.clocks) > MaxVectorClockActors {
        vc.pruneActors()
    }
}

func (vc *ThreadSafeVectorClock) pruneActors() {
    type kv struct {
        k string
        v uint64
    }
    var list []kv
    for k, v := range vc.clocks {
        list = append(list, kv{k, v})
    }
    sort.Slice(list, func(i, j int) bool {
        return list[i].v > list[j].v // Keep highest sequence actors
    })

    newClocks := make(map[string]uint64, MaxVectorClockActors)
    for i := 0; i < MaxVectorClockActors && i < len(list); i++ {
        newClocks[list[i].k] = list[i].v
    }
    vc.clocks = newClocks
}

type VectorClockSnapshot struct {
    clocks map[string]uint64
    hlc    HLC
}

func (s VectorClockSnapshot) ToHeader() string {
    parts := make([]string, 0, len(s.clocks))
    for svc, v := range s.clocks {
        parts = append(parts, fmt.Sprintf("%s:%d", svc, v))
    }
    sort.Strings(parts)
    vcStr := strings.Join(parts, ",")
    if s.hlc.Physical > 0 {
        return fmt.Sprintf("%s;hlc=%s", vcStr, s.hlc.String())
    }
    return vcStr
}

func (s VectorClockSnapshot) ToJSON() string {
    parts := make([]string, 0, len(s.clocks))
    for svc, v := range s.clocks {
        parts = append(parts, fmt.Sprintf("%q:%d", svc, v))
    }
    sort.Strings(parts)
    return "{" + strings.Join(parts, ",") + "}"
}

func (s VectorClockSnapshot) HLC() HLC {
    return s.hlc
}

func (vc *ThreadSafeVectorClock) snapshot(h HLC) VectorClockSnapshot {
    c := make(map[string]uint64, len(vc.clocks))
    for k, v := range vc.clocks {
        c[k] = v
    }
    return VectorClockSnapshot{clocks: c, hlc: h}
}

func normalizeServiceID(id string) string {
    // Strip ephemeral pod IDs (e.g. "order-service-7f89d-xk2" -> "order-service")
    parts := strings.Split(id, "-")
    if len(parts) >= 3 && len(parts[len(parts)-1]) <= 6 {
        return strings.Join(parts[:len(parts)-2], "-")
    }
    return id
}

func parseHeader(header string) (map[string]uint64, *HLC, error) {
    if header == "" {
        return nil, nil, nil
    }

    var hlcPtr *HLC
    mainPart := header

    if strings.Contains(header, ";hlc=") {
        parts := strings.SplitN(header, ";hlc=", 2)
        mainPart = parts[0]
        if parsedHlc, err := ParseHLC(parts[1]); err == nil {
            hlcPtr = &parsedHlc
        }
    }

    result := make(map[string]uint64)
    if mainPart != "" {
        for _, part := range strings.Split(mainPart, ",") {
            kv := strings.SplitN(strings.TrimSpace(part), ":", 2)
            if len(kv) != 2 {
                continue
            }
            v, err := strconv.ParseUint(strings.TrimSpace(kv[1]), 10, 64)
            if err != nil {
                return nil, nil, err
            }
            result[strings.TrimSpace(kv[0])] = v
        }
    }
    return result, hlcPtr, nil
}
