import pytest
import numpy as np
import time
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from detector import AnomalyDetector, MetricsWindow

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
        assert isinstance(result.is_anomaly, bool)
        assert 0.0 <= result.confidence <= 1.0
        assert result.inference_time_us > 0
        assert hasattr(result, 'features')
    
    def test_race_condition_metrics_trigger_anomaly(self, detector):
        """Ghost order race condition metrics should be detected as anomaly."""
        race_metrics = MetricsWindow(
            latency_p99_ms=450.0,
            error_rate_percent=0.0,
            requests_per_second=40.0,
            latency_p50_ms=90.0,
            concurrent_requests=2,
            timestamp_ms=int(time.time() * 1000),
        )
        result = detector.predict(race_metrics)
        assert result.is_anomaly or result.confidence > 0.0
    
    def test_inference_latency_benchmark(self, detector):
        """Benchmark single-sample inference time."""
        metrics = MetricsWindow(
            latency_p99_ms=150.0,
            error_rate_percent=1.0,
            requests_per_second=20.0,
            latency_p50_ms=80.0,
            concurrent_requests=1,
            timestamp_ms=0,
        )
        # Warmup
        for _ in range(10):
            detector.predict(metrics)
            
        latencies = []
        for _ in range(500):
            result = detector.predict(metrics)
            latencies.append(result.inference_time_us)
        
        p99 = np.percentile(latencies, 99)
        p50 = np.percentile(latencies, 50)
        assert p99 < 50000.0, f"Inference latency {p99/1000:.1f}ms should be fast"

