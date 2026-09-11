import os
import sys
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import (
    ReplayTrace, ReplayEvent, AnalysisRequest, RcaReport,
    RootCause, CodeFix
)
from chain import RcaChain

MOCK_RCA_REPORT = RcaReport(
    root_cause=RootCause(
        pattern="TOCTOU_RACE_CONDITION",
        description="Two concurrent reads of inventory both see stock=1, both proceed",
        affected_services=["order-service", "inventory-service"],
        evidence=["Events at causal_position=0 are concurrent", "Both GET /inventory/PRODUCT_X return stock=1"]
    ),
    contributing_factors=["Missing SELECT FOR UPDATE", "40ms payment delay widens window"],
    primary_fix=CodeFix(
        description="Add SELECT FOR UPDATE to inventory read",
        code_location="inventory-service: GET /inventory/{productId}",
        suggested_change="Use SELECT stock FROM inventory WHERE product_id = ? FOR UPDATE",
        code_diff="-SELECT stock FROM inventory WHERE product_id = ?\\n+SELECT stock FROM inventory WHERE product_id = ? FOR UPDATE",
        confidence=0.95
    ),
    secondary_fixes=[],
    trace_summary="Two orders raced. Both saw stock=1. Both decremented. Stock went to -1.",
    severity="CRITICAL",
    schema_version=1
)


def make_trace() -> ReplayTrace:
    return ReplayTrace(
        session_id="test-session-001",
        services=["order-service", "payment-service", "inventory-service"],
        events=[
            ReplayEvent(
                snapshot_id="snap-001", service_id="inventory-service",
                causal_position=0, method="GET", path="/inventory/PRODUCT_X",
                captured_status=200, replay_status=200,
                captured_latency_ms=12.0, replay_latency_ms=15.0, status_match=True,
            ),
            ReplayEvent(
                snapshot_id="snap-002", service_id="inventory-service",
                causal_position=0, method="GET", path="/inventory/PRODUCT_X",
                captured_status=200, replay_status=200,
                captured_latency_ms=13.0, replay_latency_ms=14.0, status_match=True,
            ),
        ],
        db_state_before={"inventory": {"PRODUCT_X": {"stock": 1}}},
        db_state_after={"inventory": {"PRODUCT_X": {"stock": -1}}},
        racing_condition_detected=True,
        racing_snapshot_ids=["snap-001", "snap-002"],
        anomaly_score=-0.42,
    )


class TestRcaChain:
    def test_analyze_returns_response_with_mock_llm(self):
        """Test that chain correctly returns structured LLM output."""
        chain = RcaChain(gemini_api_key="fake-key")
        
        with patch.object(chain, '_structured_invoke', return_value=MOCK_RCA_REPORT):
            trace = make_trace()
            result = chain.analyze(trace)
        
        assert result.rca is not None
        assert result.rca.root_cause.pattern == "TOCTOU_RACE_CONDITION"
        assert result.rca.primary_fix.confidence == 0.95
        assert result.error is None
    
    def test_analyze_returns_none_rca_on_llm_failure(self):
        """Test graceful degradation when LLM fails."""
        chain = RcaChain(gemini_api_key="fake-key")
        
        with patch.object(chain, '_structured_invoke', side_effect=Exception("rate limited")):
            trace = make_trace()
            result = chain.analyze(trace)
        
        assert result.rca is None
        assert result.error is not None
        assert "rate limited" in result.error
