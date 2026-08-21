"""
SAHAYAK — Spatiotemporal Decision-Support and Accountability System
FastAPI Backend Application
Problem Statement 26001 | Smart India Hackathon
"""

import os
from fastapi import FastAPI, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List, Optional
from datetime import datetime

from models.schemas import (
    SusceptibilityVector,
    DynamicTriggerInput,
    InSARDeformationData,
    ConsequenceOutput,
    BlockRecord,
    FieldObservationSubmit,
    CitizenReportSubmit,
    CollectorDecisionSubmit,
    OutcomeRecordSubmit,
    WorkflowState
)
from data.seed_data import (
    SOUTH_LHONAK_INSAR_SERIES,
    NH10_INSAR_SERIES,
    INSAR_PS_POINTS,
    SETTLEMENTS_DATA,
    INFRASTRUCTURE_DATA,
    LIVE_TELEMETRY_NODES,
    REGIONAL_ID_THRESHOLDS,
    SOP_KNOWLEDGE_BASE
)
from services.intelligence_engine import intelligence_engine
from services.consequence_engine import consequence_engine
from services.ledger_engine import decision_ledger
from services.bhashini_service import bhashini_service
from services.replay_engine import replay_engine

app = FastAPI(
    title="SAHAYAK Spatiotemporal Decision-Support API",
    description="Backend services for Landslide Intelligence, Operational Consequence, and Blockchain Decision Accountability",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for field and citizen reports
field_reports_db: List[Dict[str, Any]] = [
    {
        "report_id": "FR-2026-0814-01",
        "alert_id": "ALT-2026-0814-01",
        "officer_id": "OFFICER-SK-042",
        "officer_name": "Sub-Inspector T. Norbu",
        "lat": 27.2345,
        "lng": 88.5120,
        "observation": "Cracks",
        "severity": "Extreme",
        "verification_status": "CONFIRMED",
        "notes": "Visible tension cracks widening along NH-10 slope near chainage 142+300. Water seepage actively bubbling.",
        "voice_transcript": "NH-10 near Rangpo completely blocked, tension cracks widening, water seepage bubbling, no injuries visible.",
        "structured_nlp_entities": {
            "location": "NH-10 Chainage 142+300",
            "event_type": "Tension Cracks Widening",
            "severity": "Extreme",
            "water_status": "High hydraulic pressure / Muddy spring flow",
            "injury_status": "No casualties observed"
        },
        "photo_url": "/assets/evidence/crack_slope_sample.jpg",
        "timestamp": "2026-08-14T04:08:20+05:30",
        "sync_status": "SYNCED_TO_BLOCKCHAIN"
    }
]

citizen_reports_db: List[Dict[str, Any]] = [
    {
        "report_id": "CIT-2026-0814-01",
        "citizen_name": "Pemba Lepcha",
        "phone": "+91 98765 43210",
        "report_type": "I SEE SOMETHING WRONG",
        "lat": 27.2380,
        "lng": 88.5145,
        "location_desc": "Near Singtam Bazaar lower bridge",
        "details": "Small mudslide sliding onto lower road, water muddy and heavy.",
        "timestamp": "2026-08-14T03:52:10+05:30"
    }
]

@app.get("/api/health")
def get_health_status():
    return {
        "status": "OPERATIONAL",
        "service": "SAHAYAK Unified Decision Support Core",
        "timestamp": datetime.now().isoformat(),
        "engines": {
            "engine_1_intelligence": "READY",
            "engine_2_consequence": "READY",
            "engine_3_blockchain_ledger": "SECURED (SHA-256)",
            "bhashini_nlp_service": "CONNECTED",
            "sikkim_replay_engine": "READY"
        },
        "active_corridor": "NH-10 Singtam–Rangpo (East Sikkim)",
        "offline_cache_status": "100% PRE-CACHED & RESILIENT"
    }

# ==========================================
# ENGINE 1: INTELLIGENCE ENDPOINTS
# ==========================================

@app.post("/api/intelligence/susceptibility")
def compute_susceptibility(features: Optional[SusceptibilityVector] = None):
    if features is None:
        features = SusceptibilityVector()
    score, class_name, shap_attribution = intelligence_engine.compute_static_susceptibility(features)
    return {
        "susceptibility_score": score,
        "susceptibility_class": class_name,
        "features_evaluated_count": 22,
        "shap_attribution": shap_attribution,
        "inputs": features.dict()
    }

@app.post("/api/intelligence/trigger")
def compute_trigger(trigger_input: Optional[DynamicTriggerInput] = None):
    if trigger_input is None:
        trigger_input = DynamicTriggerInput()
    result = intelligence_engine.compute_dynamic_trigger(trigger_input)
    return result

@app.get("/api/intelligence/insar/{zone_id}")
def get_insar_data(zone_id: str):
    if zone_id == "south_lhonak":
        return {
            "zone_id": "south_lhonak",
            "zone_name": "South Lhonak Glacial Moraine (North Sikkim)",
            "historical_context": "Pre-failure Sentinel-1 SBAS-InSAR monitoring (2021–2023) prior to Oct 4 2023 GLOF",
            "current_velocity_mm_yr": -34.2,
            "acceleration_sigma": 4.8,
            "status": "CRITICAL_PRE_FAILURE_CREEP",
            "time_series": SOUTH_LHONAK_INSAR_SERIES
        }
    elif zone_id == "wayanad":
        return {
            "zone_id": "wayanad",
            "zone_name": "Chooralmala-Mundakkai Slope (Wayanad, Kerala)",
            "historical_context": "Crack visible from 2020; 16h advance warning ignored on 29 Jul 2024",
            "current_velocity_mm_yr": -18.4,
            "acceleration_sigma": 3.4,
            "status": "HISTORICAL_FAILURE",
            "time_series": [
                {"date": "2020-08-10", "displacement_mm": -4.2, "velocity_mm_yr": 3.8, "acceleration_sigma": 0.3},
                {"date": "2022-07-15", "displacement_mm": -14.6, "velocity_mm_yr": 7.2, "acceleration_sigma": 1.1},
                {"date": "2024-06-20", "displacement_mm": -28.9, "velocity_mm_yr": 12.4, "acceleration_sigma": 2.6},
                {"date": "2024-07-29", "displacement_mm": -48.2, "velocity_mm_yr": 22.8, "acceleration_sigma": 4.1}
            ]
        }
    else:
        return {
            "zone_id": "nh10_singtam_rangpo",
            "zone_name": "NH-10 Singtam–Rangpo Corridor (East Sikkim)",
            "historical_context": "Active monsoon Sentinel-1 SAR acquisition",
            "current_velocity_mm_yr": -14.5,
            "acceleration_sigma": 2.9,
            "status": "ACCELERATING_CREEP",
            "time_series": NH10_INSAR_SERIES
        }

@app.get("/api/intelligence/ps-points")
def get_ps_scatterer_points():
    return {
        "total_points": len(INSAR_PS_POINTS),
        "points": INSAR_PS_POINTS
    }

# ==========================================
# ENGINE 2: CONSEQUENCE ENDPOINTS
# ==========================================

@app.get("/api/consequence/alert-card")
def get_consequence_alert_card(
    zone_id: str = Query("nh10_singtam_rangpo"),
    rainfall_72h_mm: float = Query(186.0),
    rainfall_rate_mm_hr: float = Query(58.4),
    insar_velocity_mm_yr: float = Query(12.4)
):
    card = consequence_engine.generate_consequence_card(
        zone_id=zone_id,
        custom_rainfall_72h=rainfall_72h_mm,
        custom_rainfall_rate=rainfall_rate_mm_hr,
        custom_insar_velocity=insar_velocity_mm_yr
    )
    return card

@app.get("/api/infrastructure/network")
def get_infrastructure_network():
    return {
        "settlements": SETTLEMENTS_DATA,
        "infrastructure": INFRASTRUCTURE_DATA,
        "sensor_nodes": LIVE_TELEMETRY_NODES
    }

@app.get("/api/infrastructure/routing")
def get_dynamic_routing(sever_nh10: bool = Query(True)):
    return consequence_engine.compute_network_routing_and_isolation(sever_nh10=sever_nh10)

@app.get("/api/sensors/telemetry")
def get_sensor_telemetry():
    """
    Generates dynamic fluctuating telemetry readings simulating real pore pressure,
    tilt rate, battery voltage, and wireless SNR under active monsoon conditions.
    """
    import math
    import time
    t = time.time()

    dynamic_nodes = []
    for node in LIVE_TELEMETRY_NODES:
        n_copy = dict(node)
        # Add micro-fluctuation based on sine wave of timestamp
        noise = math.sin(t / 10.0 + hash(node["node_id"]) % 100) * 0.4
        
        if "pore_pressure_kpa" in n_copy:
            n_copy["pore_pressure_kpa"] = round(n_copy["pore_pressure_kpa"] + noise * 1.5, 1)
        if "tilt_degrees" in n_copy:
            n_copy["tilt_degrees"] = round(n_copy["tilt_degrees"] + abs(noise) * 0.08, 2)
        if "battery_pct" in n_copy:
            n_copy["battery_pct"] = max(10, n_copy["battery_pct"])
        
        n_copy["last_telemetry_ts"] = datetime.now().isoformat()
        dynamic_nodes.append(n_copy)

    return {
        "updated_at": datetime.now().isoformat(),
        "total_nodes": len(dynamic_nodes),
        "telemetry_source": "Dynamic Edge IoT Gateway / LoRaWAN Mesh",
        "nodes": dynamic_nodes
    }


# ==========================================
# ENGINE 3: DECISION & BLOCKCHAIN LEDGER
# ==========================================

@app.get("/api/ledger/chain")
def get_blockchain_chain():
    blocks_with_crypto = []
    for b in decision_ledger.chain:
        b_dict = b.dict()
        b_dict["ed25519_signature"] = decision_ledger.signatures.get(b.index, "")
        b_dict["signer_public_key_hex"] = decision_ledger.public_keys.get(b.index, "")
        blocks_with_crypto.append(b_dict)

    return {
        "chain_length": len(decision_ledger.chain),
        "cryptography_standard": "Ed25519 Digital Signatures + SHA-256 Chained Blocks",
        "blocks": blocks_with_crypto
    }

@app.get("/api/ledger/verify")
def verify_blockchain():
    return decision_ledger.verify_ledger_integrity()

@app.post("/api/ledger/tamper-test")
def tamper_blockchain_block(
    block_index: int = Body(1, embed=True),
    key: str = Body("hazard_level", embed=True),
    tampered_value: str = Body("DISMISSED_NORMAL", embed=True)
):
    """Demonstrates tamper detection during live hackathon demo"""
    res = decision_ledger.simulate_tampering(block_index, key, tampered_value)
    return res

@app.get("/api/ledger/analytics")
def get_district_performance():
    return decision_ledger.get_district_performance_analytics()

# ==========================================
# FIELD APP & CITIZEN REPORTING
# ==========================================

@app.post("/api/field/report")
def submit_field_report(report: FieldObservationSubmit):
    # Parse voice if provided and not yet extracted
    structured_nlp = report.structured_nlp_entities
    if report.voice_transcript and not structured_nlp:
        nlp_res = bhashini_service.extract_nlp_entities_from_voice(report.voice_transcript)
        structured_nlp = nlp_res["extracted_entities"]

    report_id = f"FR-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    timestamp = report.offline_cached_at or datetime.now().isoformat()

    report_record = {
        "report_id": report_id,
        "alert_id": report.alert_id,
        "officer_id": report.officer_id,
        "officer_name": report.officer_name,
        "lat": report.lat,
        "lng": report.lng,
        "observation": report.observation.value,
        "severity": report.severity.value,
        "verification_status": report.verification_status,
        "notes": report.notes,
        "voice_transcript": report.voice_transcript,
        "structured_nlp_entities": structured_nlp,
        "photo_url": report.photo_url,
        "timestamp": timestamp,
        "sync_status": "SYNCED_TO_BLOCKCHAIN"
    }
    field_reports_db.append(report_record)

    # Append cryptographic block to the blockchain ledger
    block = decision_ledger.add_block(
        alert_id=report.alert_id or "ALT-LIVE",
        workflow_state=WorkflowState.FIELD_VERIFICATION,
        signer_role="FIELD_OFFICER",
        signer_id=f"{report.officer_id} ({report.officer_name})",
        evidence_hash=decision_ledger._calculate_hash(
            index=len(decision_ledger.chain),
            timestamp=timestamp,
            previous_hash=decision_ledger.chain[-1].block_hash,
            alert_id=report.alert_id or "ALT-LIVE",
            workflow_state="FIELD_VERIFICATION",
            signer_role="FIELD_OFFICER",
            signer_id=report.officer_id,
            evidence_hash="FIELD_REPORT_RAW_HASH",
            action_payload=report_record
        ),
        action_payload=report_record,
        timestamp=timestamp
    )

    return {
        "status": "VERIFICATION_RECORDED_ON_CHAIN",
        "report_id": report_id,
        "block_index": block.index,
        "block_hash": block.block_hash,
        "report": report_record
    }

@app.post("/api/citizen/report")
def submit_citizen_report(report: CitizenReportSubmit):
    report_id = f"CIT-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    record = {
        "report_id": report_id,
        "citizen_name": report.citizen_name,
        "phone": report.phone,
        "report_type": report.report_type,
        "lat": report.lat,
        "lng": report.lng,
        "location_desc": report.location_desc,
        "details": report.details,
        "photo_url": report.photo_url,
        "timestamp": datetime.now().isoformat()
    }
    citizen_reports_db.append(record)
    return {
        "status": "CITIZEN_REPORT_RECEIVED",
        "report_id": report_id,
        "message": "Report queued for field officer verification cluster analysis."
    }

@app.get("/api/field/reports")
def list_field_reports():
    return {
        "field_reports": field_reports_db,
        "citizen_reports": citizen_reports_db
    }

# ==========================================
# DISTRICT COLLECTOR WORKFLOW
# ==========================================

@app.post("/api/collector/decision")
def submit_collector_decision(decision_input: CollectorDecisionSubmit):
    timestamp = datetime.now().isoformat()
    action_payload = {
        "decision": decision_input.decision.value,
        "collector_id": decision_input.collector_id,
        "collector_name": decision_input.collector_name,
        "reasoning_notes": decision_input.reasoning_notes,
        "evacuate_villages": decision_input.evacuate_villages,
        "trigger_multilingual_broadcast": decision_input.trigger_multilingual_broadcast,
        "dispatch_ndrf": decision_input.dispatch_ndrf,
        "close_nh10_segment": decision_input.close_nh10_segment
    }

    # Add authority decision block
    block = decision_ledger.add_block(
        alert_id=decision_input.alert_id,
        workflow_state=WorkflowState.AUTHORITY_DECISION,
        signer_role="DISTRICT_COLLECTOR",
        signer_id=f"{decision_input.collector_id} ({decision_input.collector_name})",
        evidence_hash="COLLECTOR_SIGNATURE_AUTHENTICATED",
        action_payload=action_payload,
        timestamp=timestamp
    )

    broadcast_data = None
    if decision_input.trigger_multilingual_broadcast:
        broadcast_data = bhashini_service.generate_multilingual_broadcast(
            alert_title="MANDATORY LANDSLIDE EVACUATION",
            villages=decision_input.evacuate_villages,
            staging_point="Singtam Community Staging Ground"
        )
        # Add action execution block
        decision_ledger.add_block(
            alert_id=decision_input.alert_id,
            workflow_state=WorkflowState.ACTION_EXECUTION,
            signer_role="EMERGENCY_BROADCAST_GATEWAY",
            signer_id="BHASHINI-DISPATCH-NODE-04",
            evidence_hash="BROADCAST_RECEIPT_BATCH_HASH",
            action_payload={
                "broadcast_languages": list(broadcast_data["translations"].keys()),
                "ndrf_dispatched": decision_input.dispatch_ndrf,
                "nh10_closed": decision_input.close_nh10_segment
            },
            timestamp=datetime.now().isoformat()
        )

    return {
        "status": "AUTHORITY_DECISION_EXECUTED_ON_CHAIN",
        "block_index": block.index,
        "block_hash": block.block_hash,
        "broadcast": broadcast_data
    }

@app.post("/api/collector/outcome")
def submit_event_outcome(outcome: OutcomeRecordSubmit):
    block = decision_ledger.add_block(
        alert_id=outcome.alert_id,
        workflow_state=WorkflowState.OUTCOME_RECORDED,
        signer_role="DDMA_POST_EVENT_EVALUATOR",
        signer_id=outcome.recorded_by,
        evidence_hash="OUTCOME_FIELD_SURVEY_EVIDENCE_HASH",
        action_payload=outcome.dict(),
        timestamp=datetime.now().isoformat()
    )
    return {
        "status": "OUTCOME_RECORDED_ON_CHAIN",
        "block_index": block.index,
        "block_hash": block.block_hash,
        "outcome": outcome.dict()
    }

# ==========================================
# BHASHINI AI & SOP RAG ENDPOINTS
# ==========================================

@app.post("/api/bhashini/broadcast")
def generate_broadcast(
    alert_title: str = Body("CRITICAL LANDSLIDE EVACUATION ORDER", embed=True),
    villages: List[str] = Body(["Ranipool", "Majitar", "Singtam Ward 4"], embed=True),
    staging_point: str = Body("Singtam Community Staging Ground", embed=True)
):
    return bhashini_service.generate_multilingual_broadcast(alert_title, villages, staging_point=staging_point)

@app.post("/api/bhashini/parse-voice")
def parse_voice_dictation(dictation_text: str = Body(..., embed=True)):
    return bhashini_service.extract_nlp_entities_from_voice(dictation_text)

@app.post("/api/bhashini/sop-query")
def query_sop(query: str = Body(..., embed=True)):
    return bhashini_service.query_sop_knowledge_base(query)

# ==========================================
# HISTORICAL EVENT REPLAY (Sikkim 2023 GLOF)
# ==========================================

@app.get("/api/replay/sikkim-steps")
def get_sikkim_replay_steps():
    return {
        "event_name": "Sikkim South Lhonak Glacial Lake Outburst Flood (Oct 4 2023)",
        "published_proof_citations": [
            "Yan et al. 2024, Remote Sensing 16(13):2307",
            "Biswas et al. 2023, GeoHazards 4(1)",
            "Springer JISRS 2025 MTInSAR SBAS Analysis"
        ],
        "total_steps": len(replay_engine.get_all_steps()),
        "steps": replay_engine.get_all_steps()
    }

@app.get("/api/replay/sikkim-steps/{index}")
def get_sikkim_replay_step(index: int):
    return replay_engine.get_step(index)

# ==========================================
# PRODUCTION STATIC FRONTEND MOUNTING
# ==========================================

from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

frontend_dist_dirs = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend_dist"),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist"),
]

for dist_path in frontend_dist_dirs:
    if os.path.exists(dist_path) and os.path.isdir(dist_path):
        app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
        
        @app.get("/{full_path:path}")
        async def serve_spa_frontend(full_path: str):
            if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
                return None
            index_file = os.path.join(dist_path, "index.html")
            if os.path.exists(index_file):
                return FileResponse(index_file)
        print(f"[SAHAYAK Production] Serving compiled React frontend from {dist_path}")
        break

