package main

import (
	"strings"
	"reflect"
	"sync"
	"testing"
)

func TestVectorClockTick(t *testing.T) {
	vc := NewVectorClock("svc1", "svc2")
	vc.Tick("svc1")
	
	vc.mu.RLock()
	defer vc.mu.RUnlock()
	if vc.clocks["svc1"] != 1 {
		t.Errorf("expected svc1 to be 1, got %d", vc.clocks["svc1"])
	}
	if vc.clocks["svc2"] != 0 {
		t.Errorf("expected svc2 to be 0, got %d", vc.clocks["svc2"])
	}
}

func TestVectorClockMerge(t *testing.T) {
	vc := NewVectorClock("svc1")
	vc.clocks["svc1"] = 5
	vc.clocks["svc2"] = 2

	vc.Merge("svc1:3,svc2:5,svc3:1")

	vc.mu.RLock()
	defer vc.mu.RUnlock()
	if vc.clocks["svc1"] != 5 {
		t.Errorf("expected svc1 to be 5, got %d", vc.clocks["svc1"])
	}
	if vc.clocks["svc2"] != 5 {
		t.Errorf("expected svc2 to be 5, got %d", vc.clocks["svc2"])
	}
	if vc.clocks["svc3"] != 1 {
		t.Errorf("expected svc3 to be 1, got %d", vc.clocks["svc3"])
	}
}

func TestVectorClockToHeader(t *testing.T) {
	vc := NewVectorClock()
	vc.clocks["svc1"] = 1
	vc.clocks["svc2"] = 2
	
	header := vc.snapshot(vc.hlc.Now()).ToHeader()
	expected := "svc1:1,svc2:2"
	if !strings.HasPrefix(header, expected) {
		t.Errorf("expected %s, got %s", expected, header)
	}
}

func TestVectorClockFromHeader(t *testing.T) {
	parsed, _, err := parseHeader("svc1:1,svc2:2")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	
	expected := map[string]uint64{"svc1": 1, "svc2": 2}
	if !reflect.DeepEqual(parsed, expected) {
		t.Errorf("expected %v, got %v", expected, parsed)
	}
}

func TestVectorClockRoundTrip(t *testing.T) {
	vc := NewVectorClock()
	vc.clocks["svc1"] = 1
	vc.clocks["svc2"] = 2
	
	header := vc.snapshot(vc.hlc.Now()).ToHeader()
	parsed, _, err := parseHeader(header)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if !reflect.DeepEqual(vc.clocks, parsed) {
		t.Errorf("expected %v, got %v", vc.clocks, parsed)
	}
}

func TestConcurrentTicks(t *testing.T) {
	vc := NewVectorClock("svc1")
	var wg sync.WaitGroup
	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			vc.Tick("svc1")
		}()
	}
	wg.Wait()
	
	if vc.clocks["svc1"] != 1000 {
		t.Errorf("expected 1000, got %d", vc.clocks["svc1"])
	}
}

func BenchmarkVectorClockTick(b *testing.B) {
	vc := NewVectorClock("svc1")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		vc.Tick("svc1")
	}
}

func BenchmarkVectorClockMerge(b *testing.B) {
	vc := NewVectorClock("svc1")
	header := "svc1:10,svc2:20,svc3:30"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		vc.Merge(header)
	}
}
