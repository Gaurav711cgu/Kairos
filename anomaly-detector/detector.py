"""Isolation Forest anomaly detector for distributed system metrics."""
import numpy as np
import joblib
import os
from sklearn.ensemble import IsolationForest
from dataclasses import dataclass
from typing import Optional
try:
    import structlog
    log = structlog.get_logger()
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    log = logging.getLogger("detector")
import time

# The 5 features that characterize the ghost order race condition:
# 1. latency_p99_ms: spikes during concurrent requests
# 2. error_rate_percent: stays low (both orders SUCCEED — no 5xx!)
# 3. requests_per_second: doubles briefly
# 4. latency_ratio: p99/p50 spikes (high p99 vs normal p50)
# 5. concurrent_requests: 2 simultaneously
FEATURE_NAMES = [
    'latency_p99_ms',
    'error_rate_percent',
    'requests_per_second',
    'latency_ratio',
    'concurrent_requests',
]

@dataclass
class MetricsWindow:
    latency_p99_ms: float
    error_rate_percent: float
    requests_per_second: float
    latency_p50_ms: float
    concurrent_requests: int
    timestamp_ms: int

@dataclass 
class AnomalyResult:
    is_anomaly: bool
    score: float           # Isolation Forest anomaly score (more negative = more anomalous)
    confidence: float      # 0.0-1.0
    features: dict
    inference_time_us: float  # Microseconds
    model_age_hours: float


class AnomalyDetector:
    MODEL_PATH = "/tmp/isolation_forest.joblib"
    
    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.trained_at: Optional[float] = None
        self._initialize_model()
    
    def _initialize_model(self):
        """Load pre-trained model or train a new one with synthetic normal data."""
        if os.path.exists(self.MODEL_PATH):
            log.info("loading_existing_model", path=self.MODEL_PATH)
            self.model = joblib.load(self.MODEL_PATH)
            self.trained_at = os.path.getmtime(self.MODEL_PATH)
        else:
            log.info("training_initial_model_with_synthetic_data")
            self._train_with_synthetic_data()
    
    def _train_with_synthetic_data(self):
        """Train on synthetic 'normal' traffic to bootstrap the model."""
        rng = np.random.default_rng(42)
        n_samples = 2000
        
        # Normal traffic patterns:
        # - p99 latency: 80-200ms (normal service latency)
        # - error rate: 0-2%
        # - RPS: 5-50
        # - latency ratio (p99/p50): 1.5-3.0 (acceptable spread)
        # - concurrent: 1-2
        normal_data = np.column_stack([
            rng.uniform(80, 200, n_samples),    # latency_p99_ms
            rng.uniform(0, 2, n_samples),       # error_rate_percent
            rng.uniform(5, 50, n_samples),      # requests_per_second
            rng.uniform(1.5, 3.0, n_samples),   # latency_ratio
            rng.integers(1, 3, n_samples),      # concurrent_requests
        ])
        
        self.model = IsolationForest(
            n_estimators=100,
            max_samples=256,  # O(log n) tree depth = fast inference
            contamination=0.05,  # Expect 5% anomalies
            random_state=42,
        )
        self.model.fit(normal_data)
        self.trained_at = time.time()
        
        # Persist for reuse across restarts
        joblib.dump(self.model, self.MODEL_PATH)
        log.info("model_trained", samples=n_samples, path=self.MODEL_PATH)
    
    def retrain(self, historical_data: np.ndarray):
        """Retrain with real historical data."""
        self.model = IsolationForest(
            n_estimators=100,
            max_samples=min(256, len(historical_data)),
            contamination=0.05,
            random_state=42,
        )
        self.model.fit(historical_data)
        self.trained_at = time.time()
        joblib.dump(self.model, self.MODEL_PATH)
        log.info("model_retrained", samples=len(historical_data))
    
    def predict(self, metrics: MetricsWindow) -> AnomalyResult:
        """Predict if metrics window represents anomalous behavior.
        
        Target performance (from benchmark plan):
        - p50 latency: < 500μs
        - p99 latency: < 1000μs
        """
        if self.model is None:
            raise RuntimeError("Model not initialized")
        
        p99 = metrics.latency_p99_ms
        p50 = max(metrics.latency_p50_ms, 1.0)  # Avoid division by zero
        
        features = np.array([[
            p99,
            metrics.error_rate_percent,
            metrics.requests_per_second,
            p99 / p50,  # latency_ratio
            float(metrics.concurrent_requests),
        ]], dtype=np.float32)
        
        t0 = time.perf_counter()
        prediction = self.model.predict(features)[0]  # 1=normal, -1=anomaly
        score = self.model.score_samples(features)[0]  # More negative = more anomalous
        inference_us = (time.perf_counter() - t0) * 1e6
        
        # Normalize score to [0, 1] confidence
        # score range is roughly [-0.5, 0] for Isolation Forest
        confidence = min(1.0, max(0.0, -score / 0.5))
        
        result = AnomalyResult(
            is_anomaly=(prediction == -1),
            score=float(score),
            confidence=float(confidence),
            features={
                'latency_p99_ms': p99,
                'error_rate_percent': metrics.error_rate_percent,
                'requests_per_second': metrics.requests_per_second,
                'latency_ratio': p99 / p50,
                'concurrent_requests': metrics.concurrent_requests,
            },
            inference_time_us=inference_us,
            model_age_hours=(
                (time.time() - self.trained_at) / 3600
                if self.trained_at else 0.0
            ),
        )
        
        if result.is_anomaly:
            log.warning("anomaly_detected",
                score=result.score,
                confidence=result.confidence,
                inference_us=f"{inference_us:.1f}",
                features=result.features)
        
        return result
    
    @property
    def model_age_hours(self) -> float:
        if not self.trained_at:
            return 0.0
        return (time.time() - self.trained_at) / 3600
