"""
Isolation Forest Anomaly Detector for Kairos.

Model training data:
- Bootstrap: 2000 synthetic samples (uniform random normal traffic patterns)
- Target: Replace with real_traffic_data.csv collected from demo system
          by running: python scripts/collect_training_data.py

Features (5):
  1. latency_p99_ms      - p99 HTTP latency in ms
  2. error_rate_percent  - % of 5xx responses
  3. requests_per_second - RPS at the agent level
  4. latency_ratio       - p99/p50 (spread indicator)
  5. concurrent_requests - simultaneous in-flight requests

Target anomaly: TOCTOU race condition during concurrent checkout.
Observable signal: concurrent_requests=2 + latency_ratio spike,
                   error_rate stays LOW (both orders succeed - no 5xx!).
"""
import numpy as np
import joblib
import os
from sklearn.ensemble import IsolationForest
from dataclasses import dataclass
from typing import Optional
import time
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("detector")

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
    MODEL_PATH = os.environ.get("KAIROS_MODEL_PATH", os.path.join(os.path.dirname(__file__), "isolation_forest.joblib"))
    REAL_DATA_PATH = os.path.join(os.path.dirname(__file__), "scripts", "training_data.csv")
    
    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.trained_at: Optional[float] = None
        self.last_score: float = 0.0
        self.last_is_anomaly: bool = False
        self.last_computed_at: str = ""
        self._initialize_model()
    
    def _initialize_model(self):
        """Load pre-trained model or train from real/synthetic data."""
        if os.path.exists(self.REAL_DATA_PATH):
            try:
                import pandas as pd
                data = pd.read_csv(self.REAL_DATA_PATH).values
                log.info("Training on real traffic (%d samples) from %s", len(data), self.REAL_DATA_PATH)
                self.retrain(data)
                return
            except Exception as e:
                log.warning("Could not load real traffic: %s", e)

        if os.path.exists(self.MODEL_PATH):
            try:
                self.model = joblib.load(self.MODEL_PATH)
                self.trained_at = os.path.getmtime(self.MODEL_PATH)
                log.info("Loaded existing model from %s", self.MODEL_PATH)
                return
            except Exception as e:
                log.warning("Failed to load model from %s: %s", self.MODEL_PATH, e)
        
        log.info("Training initial model with synthetic data")
        self._train_with_synthetic_data()
    
    def _train_with_synthetic_data(self):
        """Train on synthetic 'normal' traffic to bootstrap the model."""
        rng = np.random.default_rng(42)
        n_samples = 2000
        
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
        
        try:
            joblib.dump(self.model, self.MODEL_PATH)
        except Exception as e:
            log.warning("Failed to save model to %s: %s", self.MODEL_PATH, e)
        log.info("Model trained with %d samples and saved to %s", n_samples, self.MODEL_PATH)
    
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
        try:
            joblib.dump(self.model, self.MODEL_PATH)
        except Exception as e:
            log.warning("Failed to save model to %s: %s", self.MODEL_PATH, e)
        log.info("Model retrained with %d samples", len(historical_data))
    
    def predict(self, metrics: MetricsWindow) -> AnomalyResult:
        """Predict if metrics window represents anomalous behavior."""
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
        
        confidence = min(1.0, max(0.0, -score / 0.5))
        is_anomaly = bool(prediction == -1)
        
        result = AnomalyResult(
            is_anomaly=is_anomaly,
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
        
        self.last_score = result.score
        self.last_is_anomaly = result.is_anomaly
        self.last_computed_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        
        return result
    
    @property
    def model_age_hours(self) -> float:
        if not self.trained_at:
            return 0.0
        return (time.time() - self.trained_at) / 3600
