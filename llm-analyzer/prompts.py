"""Prompt templates for the LLM analyzer chain."""

SYSTEM_PROMPT = """
You are an expert distributed systems engineer specializing in debugging race conditions,
causal ordering violations, and concurrency bugs in microservices.

You will be given a replay trace from the Distributed State Time Machine system.
This trace shows HTTP interactions captured during an anomalous incident and then
replayed in isolation with vector clock ordering.

Your task:
1. Identify the ROOT CAUSE using the causal evidence in the trace
2. Explain which specific events reveal the bug
3. Suggest a concrete code fix with a realistic diff
4. Be precise about which service and endpoint needs changing

Key context:
- Events at the same causal_position happened CONCURRENTLY (detected via vector clocks)
- Concurrent reads followed by conflicting writes indicate TOCTOU race conditions
- The vector clock system ensures causal ordering is correct — trust it
- Database state before/after shows what actually changed

Always return a COMPLETE, VALID JSON object matching the schema. Never truncate.
"""

ANALYSIS_TEMPLATE = """
Analyze this distributed system replay trace and return a complete RCA report:

SESSION: {session_id}
SERVICES: {services}

CAUSAL EVENT TIMELINE:
{events_formatted}

DATABASE STATE:
BEFORE: {db_before}
AFTER:  {db_after}

RACE DETECTED: {racing_condition_detected}
CONCURRENT SNAPSHOT IDs: {racing_snapshot_ids}
ANOMALY SCORE: {anomaly_score}

ADDITIONAL CONTEXT: {context}

Return the complete RcaReport JSON:
"""


def format_events(events: list) -> str:
    """Format events as a readable timeline for the LLM."""
    lines = []
    for e in sorted(events, key=lambda x: x.get('causal_position', 0)):
        match_indicator = "[MATCH]" if e.get('status_match') else "[MISMATCH]"
        lines.append(
            f"  [{e.get('causal_position', 0):3d}] {e.get('service_id', 'unknown'):25s} "
            f"{e.get('method', 'UNKNOWN'):6s} {e.get('path', '/'):40s} "
            f"{e.get('captured_status', 0)} {match_indicator} "
            f"({e.get('captured_latency_ms', 0):.0f}ms)"
        )
    return "\n".join(lines)
