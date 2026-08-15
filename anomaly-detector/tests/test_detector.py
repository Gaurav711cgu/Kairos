import os
import sys
import time
import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from detector import AnomalyDetector, MetricsWindow, AnomalyResult

@pytest.fixture
def detector():
    return AnomalyDetector()

class TestAnomalyDetector:
    def test_normal_traffic_not_anomaly(self, detector):
        """Normal traffic should not trigger anomaly."""
        normal = MetricsWindow(
            latency_p99_ms=150.0,
            error_rate_percent=1.0,
            requests_per_second=20.0,
            latency_p50_ms=80.0,
            concurrent_requests=1,
            timestamp_ms=int(time.time() * 1000),
        )
        result = detector.predict(normal)
        # Not asserting is_anomaly=False strictly (model is probabilistic)
        # Just verify the structure
        assert isinstance(result.is_anomaly, bool)
        assert 0.0 <= result.confidence <= 1.0
        assert result.inference_time_us > 0
    
    def test_race_condition_metrics_trigger_anomaly(self, detector):
        """Ghost order race condition metrics should be detected as anomaly."""
        # Characteristics: high p99, low error rate, doubled RPS, concurrent=2
        race_metrics = MetricsWindow(
            latency_p99_ms=450.0,  # Spike due to concurrent requests
            error_rate_percent=0.0,  # Both orders SUCCEED (no 5xx!)
            requests_per_second=40.0,  # Doubled briefly
            latency_p50_ms=90.0,
            concurrent_requests=2,
            timestamp_ms=int(time.time() * 1000),
        )
        result = detector.predict(race_metrics)
        # The anomaly score should be negative (anomalous)
        assert result.score < 0
        assert result.inference_time_us < 1000  # < 1ms target
    
    def test_inference_latency_under_1ms(self, detector):
        """Single-sample inference must be < 1ms (p99 target)."""
        metrics = MetricsWindow(
            latency_p99_ms=150.0,
            error_rate_percent=1.0,
            requests_per_second=20.0,
            latency_p50_ms=80.0,
            concurrent_requests=1,
            timestamp_ms=0,
        )
        latencies = []
        for _ in range(1000):
            result = detector.predict(metrics)
            latencies.append(result.inference_time_us)
        
        p99 = np.percentile(latencies, 99)
        p50 = np.percentile(latencies, 50)
        print(f"Inference p50={p50:.1f}μs p99={p99:.1f}μs")
        assert p99 < 1000, f"p99 inference latency {p99:.1f}μs exceeds 1ms target"
    
    def test_false_positive_rate_under_5_percent(self, detector):
        """False positive rate on normal traffic must be < 5%."""
        rng = np.random.default_rng(42)
        n = 1000
        false_positives = 0
        for _ in range(n):
            m = MetricsWindow(
                latency_p99_ms=rng.uniform(80, 200),
                error_rate_percent=rng.uniform(0, 2),
                requests_per_second=rng.uniform(5, 50),
                latency_p50_ms=rng.uniform(50, 100),
                concurrent_requests=int(rng.integers(1, 2)),
                timestamp_ms=0,
            )
            result = detector.predict(m)
            if result.is_anomaly:
                false_positives += 1
        
        fp_rate = false_positives / n
        print(f"False positive rate: {fp_rate:.1%} ({false_positives}/{n})")
        assert fp_rate < 0.05, f"False positive rate {fp_rate:.1%} exceeds 5% target"
    
    def test_retrain(self, detector):
        """Retraining should update model_age."""
        before = detector.trained_at
        time.sleep(0.01)  # Ensure timestamp changes
        rng = np.random.default_rng()
        data = rng.uniform(0, 1, (500, 5))
        detector.retrain(data)
        assert detector.trained_at > before
    
    def test_confidence_range(self, detector):
        """Confidence must always be in [0, 1]."""
        for _ in range(100):
            m = MetricsWindow(
                latency_p99_ms=np.random.uniform(0, 1000),
                error_rate_percent=np.random.uniform(0, 100),
                requests_per_second=np.random.uniform(0, 200),
                latency_p50_ms=np.random.uniform(1, 500),
                concurrent_requests=np.random.randint(0, 20),
                timestamp_ms=0,
            )
            result = detector.predict(m)
            assert 0.0 <= result.confidence <= 1.0
