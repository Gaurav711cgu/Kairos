"""Pydantic models for structured LLM output and API contracts."""
from typing import Literal, Optional
from pydantic import BaseModel, Field


class RootCause(BaseModel):
    pattern: Literal[
        "TOCTOU_RACE_CONDITION",
        "DEADLOCK",
        "MISSING_DISTRIBUTED_LOCK",
        "N_PLUS_ONE_QUERY",
        "CASCADING_FAILURE",
        "MISSING_IDEMPOTENCY",
        "VECTOR_CLOCK_VIOLATION",
        "OTHER"
    ]
    description: str = Field(description="Clear explanation of what went wrong")
    affected_services: list[str] = Field(description="Service IDs involved in the root cause")
    evidence: list[str] = Field(description="Specific events from trace that prove this")


class CodeFix(BaseModel):
    description: str = Field(description="What the fix does")
    code_location: str = Field(description="File and endpoint, e.g. 'inventory-service: POST /inventory/{id}/decrement'")
    suggested_change: str = Field(description="What code change to make")
    code_diff: str = Field(description="Git-style unified diff showing the change")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence this fix resolves the issue")


class RcaReport(BaseModel):
    """Root Cause Analysis report — structured output from Gemini."""
    root_cause: RootCause
    contributing_factors: list[str] = Field(description="Secondary factors that made the bug worse")
    primary_fix: CodeFix
    secondary_fixes: list[CodeFix] = Field(default_factory=list, max_length=3)
    trace_summary: str = Field(description="2-3 sentence narrative of what the trace shows")
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "HIGH"
    schema_version: int = 1


class ReplayEvent(BaseModel):
    """A single replayed event from the trace."""
    snapshot_id: str
    service_id: str
    causal_position: int
    method: str
    path: str
    captured_status: int
    replay_status: int
    captured_latency_ms: float
    replay_latency_ms: float
    status_match: bool


class ReplayTrace(BaseModel):
    """Full replay trace sent to LLM for analysis."""
    session_id: str
    services: list[str]
    events: list[ReplayEvent]
    db_state_before: dict
    db_state_after: dict
    racing_condition_detected: bool
    racing_snapshot_ids: Optional[list[str]] = None
    anomaly_score: Optional[float] = None


class AnalysisRequest(BaseModel):
    trace: ReplayTrace
    context: Optional[str] = None  # Additional context from operator


class AnalysisResponse(BaseModel):
    session_id: str
    rca: Optional[RcaReport] = None
    error: Optional[str] = None  # Set if LLM call failed
    latency_ms: float
    model_used: str
