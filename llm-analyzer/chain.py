"""LangChain chain for structured RCA output."""
import os
import json
import time
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential

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
        
        self.model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",  # Fast, cheap, structured output
            google_api_key=api_key,
            temperature=0.1,  # Low temperature for structured output
            convert_system_message_to_human=True,
        )
        
        self.parser = PydanticOutputParser(pydantic_object=RcaReport)
        self.format_instructions = self.parser.get_format_instructions()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),  # Handles rate limits
    )
    def _call_llm(self, prompt_text: str) -> str:
        """Call Gemini with retry on rate limit (429) errors."""
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=prompt_text),
        ]
        response = self.model.invoke(messages)
        return response.content
    
    def analyze(self, trace: ReplayTrace, context: str = "") -> AnalysisResponse:
        """Run RCA analysis. Returns AnalysisResponse with rca=None on LLM failure.
        
        The replay session ALWAYS completes — LLM analysis is best-effort.
        Failure returns trace without RCA, never fails the replay.
        """
        start_ms = time.time() * 1000
        
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
            for e in trace.events
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
        prompt += f"\n\nFormat instructions:\n{self.format_instructions}"
        
        try:
            raw = self._call_llm(prompt)
            
            # Try to extract JSON if wrapped in markdown code block
            if '```json' in raw:
                raw = raw.split('```json')[1].split('```')[0].strip()
            elif '```' in raw:
                raw = raw.split('```')[1].split('```')[0].strip()
            
            rca = self.parser.parse(raw)
            
            latency_ms = time.time() * 1000 - start_ms
            log.info("rca_complete",
                session_id=trace.session_id,
                pattern=rca.root_cause.pattern,
                latency_ms=f"{latency_ms:.0f}",
                confidence=rca.primary_fix.confidence)
            
            return AnalysisResponse(
                session_id=trace.session_id,
                rca=rca,
                latency_ms=latency_ms,
                model_used="gemini-2.5-flash",
            )
        
        except Exception as e:
            latency_ms = time.time() * 1000 - start_ms
            log.error("rca_failed", session_id=trace.session_id, error=str(e))
            return AnalysisResponse(
                session_id=trace.session_id,
                rca=None,
                error=str(e),
                latency_ms=latency_ms,
                model_used="gemini-2.5-flash",
            )
