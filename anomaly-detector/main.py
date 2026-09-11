"""FastAPI anomaly detection service."""
import os
import sys
import time
from typing import Optional
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from detector import AnomalyDetector, MetricsWindow

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
    title="Distributed State Time Machine - Anomaly Detector",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
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
    should_capture: bool
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
        latency_p50_ms=req.latency_p50_ms if req.latency_p50_ms > 0 else req.latency_p99_ms,
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

@app.get("/score/latest")
async def get_latest_score():
    """Returns the most recent anomaly score computed by the detector."""
    if detector is None:
        return {"score": 0.0, "is_anomaly": False, "computed_at": ""}
    return {
        "score": detector.last_score,
        "is_anomaly": detector.last_is_anomaly,
        "computed_at": detector.last_computed_at
    }

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

from fastapi import Depends
from fastapi.security import APIKeyHeader

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

def verify_api_key(api_key: str = Depends(API_KEY_HEADER)):
    expected = os.getenv("KAIROS_API_KEY", "dev-secret-key")
    if api_key != expected:
        raise HTTPException(status_code=403, detail="Invalid API Key")

@app.post("/retrain")
async def retrain(metrics_history: list[MetricsRequest], _ = Depends(verify_api_key)):
    """Trigger model retraining with real traffic data."""
    if detector is None:
        raise HTTPException(503, "Detector not initialized")
    
    if len(metrics_history) < 100:
        raise HTTPException(400, "Need at least 100 samples to retrain")
        
    data = np.column_stack([
        [m.latency_p99_ms for m in metrics_history],
        [m.error_rate_percent for m in metrics_history],
        [m.requests_per_second for m in metrics_history],
        [m.latency_p99_ms / max(m.latency_p50_ms, 1.0) for m in metrics_history],
        [m.concurrent_requests for m in metrics_history],
    ])
    
    detector.retrain(data)
    return {"status": "retrained", "samples": len(metrics_history)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8091")), log_level="info")
