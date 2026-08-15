"""FastAPI anomaly detection service."""
import os
import time
from typing import Optional
from contextlib import asynccontextmanager

import numpy as np
try:
    import structlog
    log = structlog.get_logger()
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    log = logging.getLogger("anomaly-detector")

# Prometheus metrics
PREDICT_TOTAL = Counter('anomaly_detector_predictions_total', 'Total predictions')
ANOMALY_TOTAL = Counter('anomaly_detector_anomalies_total', 'Total anomalies detected')
INFERENCE_LATENCY = Histogram(
    'anomaly_detector_inference_latency_microseconds',
    'Isolation Forest inference latency',
    buckets=[50, 100, 200, 500, 1000, 2000]
)
MODEL_AGE = Gauge('anomaly_detector_model_age_hours', 'Hours since model was trained')

detector: Optional[AnomalyDetector] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector
    log.info("initializing_anomaly_detector")
    detector = AnomalyDetector()
    log.info("anomaly_detector_ready", model_age_hours=detector.model_age_hours)
    yield
    log.info("shutting_down")

app = FastAPI(
    title="Distributed State Time Machine — Anomaly Detector",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class MetricsRequest(BaseModel):
    latency_p99_ms: float = Field(ge=0)
    latency_p50_ms: float = Field(ge=0, default=0.0)
    error_rate_percent: float = Field(ge=0, le=100)
    requests_per_second: float = Field(ge=0)
    concurrent_requests: int = Field(ge=0, default=1)
    timestamp_ms: Optional[int] = None

class PredictionResponse(BaseModel):
    is_anomaly: bool
    score: float
    confidence: float
    should_capture: bool  # True when is_anomaly and confidence > 0.7
    features: dict
    inference_time_us: float
    model_age_hours: float

@app.post("/predict", response_model=PredictionResponse)
async def predict(req: MetricsRequest):
    """Predict if current metrics indicate an anomaly worth capturing."""
    if detector is None:
        raise HTTPException(503, "Detector not initialized")
    
    metrics = MetricsWindow(
        latency_p99_ms=req.latency_p99_ms,
        error_rate_percent=req.error_rate_percent,
        requests_per_second=req.requests_per_second,
        latency_p50_ms=req.latency_p50_ms or req.latency_p99_ms,
        concurrent_requests=req.concurrent_requests,
        timestamp_ms=req.timestamp_ms or int(time.time() * 1000),
    )
    
    result = detector.predict(metrics)
    
    PREDICT_TOTAL.inc()
    INFERENCE_LATENCY.observe(result.inference_time_us)
    MODEL_AGE.set(result.model_age_hours)
    if result.is_anomaly:
        ANOMALY_TOTAL.inc()
    
    return PredictionResponse(
        is_anomaly=result.is_anomaly,
        score=result.score,
        confidence=result.confidence,
        should_capture=result.is_anomaly and result.confidence > 0.7,
        features=result.features,
        inference_time_us=result.inference_time_us,
        model_age_hours=result.model_age_hours,
    )

@app.get("/health")
async def health():
    return {
        "status": "UP",
        "service": "anomaly-detector",
        "model_initialized": detector is not None,
        "model_age_hours": detector.model_age_hours if detector else None,
    }

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/retrain")
async def retrain():
    """Trigger model retraining (called by scheduled job)."""
    if detector is None:
        raise HTTPException(503, "Detector not initialized")
    # In production: load real historical data from Postgres
    # For demo: retrain with fresh synthetic data
    rng = np.random.default_rng()
    synthetic = np.column_stack([
        rng.uniform(80, 200, 2000),
        rng.uniform(0, 2, 2000),
        rng.uniform(5, 50, 2000),
        rng.uniform(1.5, 3.0, 2000),
        rng.integers(1, 3, 2000),
    ])
    detector.retrain(synthetic)
    return {"status": "retrained", "samples": 2000}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8091")), log_level="info")
