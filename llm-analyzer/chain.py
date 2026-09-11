"""LangChain chain for structured RCA output."""
import os
import sys
import json
import time
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import SystemMessage, HumanMessage
    from langchain_core.output_parsers import PydanticOutputParser
except ImportError:
    ChatGoogleGenerativeAI = None
    SystemMessage = None
    HumanMessage = None
    PydanticOutputParser = None

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models import RcaReport, ReplayTrace, AnalysisResponse
from prompts import SYSTEM_PROMPT, ANALYSIS_TEMPLATE, format_events

try:
    import structlog
    log = structlog.get_logger()
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    log = logging.getLogger("llm-analyzer-chain")


class RcaChain:
    def __init__(self, gemini_api_key: Optional[str] = None):
        api_key = gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            log.warning("no_gemini_api_key_set")
        
        if ChatGoogleGenerativeAI is not None:
            base_model = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",  # Fast, structured output
                google_api_key=api_key,
                temperature=0.1,  # Low temperature for structured output
            )
            self.model = base_model.with_structured_output(RcaReport)
        else:
            self.model = None
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
    )
    def _structured_invoke(self, messages) -> RcaReport:
        """Call Gemini with retry on rate limit (429) errors."""
        if self.model is None:
            raise RuntimeError("Gemini model client not installed")
        return self.model.invoke(messages)
    
    def analyze(self, trace: ReplayTrace, context: str = "") -> AnalysisResponse:
        """Run RCA analysis. Returns AnalysisResponse with rca=None on LLM failure.
        
        The replay session ALWAYS completes - LLM analysis is best-effort.
        Failure returns trace without RCA, never fails the replay.
        """
        start_ms = time.time() * 1000
        
        # Context Pruning / Token Budgeting
        MAX_EVENTS = 50
        raw_events = trace.events
        if len(raw_events) > MAX_EVENTS:
            log.warning("pruning_events", original=len(raw_events), max=MAX_EVENTS)
            anomalies = [e for e in raw_events if not e.status_match or e.replay_status >= 400]
            if len(anomalies) >= MAX_EVENTS:
                raw_events = anomalies[:MAX_EVENTS]
            else:
                normal_allowance = MAX_EVENTS - len(anomalies)
                head = raw_events[:normal_allowance // 2]
                tail = raw_events[-(normal_allowance // 2):]
                # Merge and sort by causal position
                raw_events = sorted(list(set(anomalies + head + tail)), key=lambda x: x.causal_position)
                
        events_list = [
            {
                'causal_position': e.causal_position,
                'service_id': e.service_id,
                'method': e.method,
                'path': e.path,
                'captured_status': e.captured_status,
                'replay_status': e.replay_status,
                'captured_latency_ms': e.captured_latency_ms,
                'status_match': e.status_match,
            }
            for e in raw_events
        ]
        
        prompt = ANALYSIS_TEMPLATE.format(
            session_id=trace.session_id,
            services=', '.join(trace.services),
            events_formatted=format_events(events_list),
            db_before=json.dumps(trace.db_state_before, indent=2),
            db_after=json.dumps(trace.db_state_after, indent=2),
            racing_condition_detected=trace.racing_condition_detected,
            racing_snapshot_ids=trace.racing_snapshot_ids or [],
            anomaly_score=trace.anomaly_score,
            context=context or "None provided",
        )
        
        
        try:
            if self.model is None or SystemMessage is None:
                raise RuntimeError("Gemini model client not installed")
            
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=prompt),
            ]
            rca = self._structured_invoke(messages)
            
            latency_ms = time.time() * 1000 - start_ms
            log.info("rca_complete: session=%s pattern=%s latency=%.0fms confidence=%.2f",
                trace.session_id,
                rca.root_cause.pattern,
                latency_ms,
                rca.primary_fix.confidence)
            
            return AnalysisResponse(
                session_id=trace.session_id,
                rca=rca,
                latency_ms=latency_ms,
                model_used="gemini-2.5-flash",
            )
        
        except Exception as e:
            latency_ms = time.time() * 1000 - start_ms
            log.error("rca_failed: session=%s error=%s", trace.session_id, str(e))
            return AnalysisResponse(
                session_id=trace.session_id,
                rca=None,
                error=str(e),
                latency_ms=latency_ms,
                model_used="gemini-2.5-flash",
            )
