"""LLM Analyzer FastAPI service."""
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from models import AnalysisRequest, AnalysisResponse
from chain import RcaChain

try:
    import structlog
    log = structlog.get_logger()
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    log = logging.getLogger("llm-analyzer")

ANALYSIS_TOTAL = Counter('llm_analyzer_requests_total', 'Total analysis requests')
ANALYSIS_SUCCESS = Counter('llm_analyzer_success_total', 'Successful analyses')
ANALYSIS_ERRORS = Counter('llm_analyzer_errors_total', 'Failed analyses')
LLM_LATENCY = Histogram(
    'llm_analyzer_latency_milliseconds',
    'LLM call latency',
    buckets=[200, 500, 1000, 2000, 5000, 10000, 15000]
)

chain: Optional[RcaChain] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global chain
    log.info("initializing_llm_chain")
    chain = RcaChain()
    log.info("llm_chain_ready")
    yield

app = FastAPI(
    title="Distributed State Time Machine — LLM Analyzer",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(req: AnalysisRequest):
    """Analyze a replay trace and return RCA.
    
    Always returns 200 — rca field is null if LLM call failed.
    The caller should handle partial results gracefully.
    """
    if chain is None:
        raise HTTPException(503, "Chain not initialized")
    
    ANALYSIS_TOTAL.inc()
    
    result = chain.analyze(req.trace, req.context or "")
    
    LLM_LATENCY.observe(result.latency_ms)
    if result.rca is not None:
        ANALYSIS_SUCCESS.inc()
    else:
        ANALYSIS_ERRORS.inc()
    
    return result

@app.get("/health")
async def health():
    return {
        "status": "UP",
        "service": "llm-analyzer",
        "chain_ready": chain is not None,
        "model": "gemini-2.5-flash",
    }

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8092")), log_level="info")
