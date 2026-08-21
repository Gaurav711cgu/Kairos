"""
Unit and Integration Tests for SAHAYAK Production Upgrades
Validates:
1. Real GradientBoostingClassifier ML Susceptibility Inference
2. Mathematical Regional I-D Power-Law Trigger Thresholds
3. InSAR Deformation Data Ingestion & DAI
4. Dynamic NetworkX Graph Routing & Dijkstra Detour Calculation
5. Ed25519 Asymmetric Cryptographic Signing, Verification & Tamper Rejection
6. Vector Semantic RAG with TF-IDF and Cosine Similarity
7. Bhashini Multilingual Broadcast & Voice Dictation NLP Parser
8. Dynamic On-Chain District Analytics Recalculation
9. Sikkim 2023 GLOF Timeline Replay Stepper
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from services.intelligence_engine import intelligence_engine
from services.consequence_engine import consequence_engine
from services.ledger_engine import decision_ledger, key_manager
from services.bhashini_service import bhashini_service
from services.replay_engine import replay_engine
from models.schemas import SusceptibilityVector, DynamicTriggerInput, WorkflowState

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPERATIONAL"
    assert data["engines"]["engine_1_intelligence"] == "READY"
    assert data["engines"]["engine_3_blockchain_ledger"] == "SECURED (SHA-256)"

def test_susceptibility_ml_inference():
    # Verify model artifact is loaded
    assert intelligence_engine.ml_artifact is not None
    features = SusceptibilityVector(
        slope_deg=38.5,
        lithology_class="Phyllitic / Daling Series",
        twi=9.2,
        tri=22.0,
        ndvi=0.35,
        dist_to_road_m=35.0
    )
    score, class_name, importances = intelligence_engine.compute_static_susceptibility(features)
    assert 0.0 <= score <= 1.0
    assert score > 0.50 # High slope and phyllite should produce high susceptibility
    assert "HIGH" in class_name or "Phyllitic" in class_name
    assert len(importances) >= 4

def test_dynamic_trigger_threshold():
    trigger_in = DynamicTriggerInput(
        region_id="sikkim_east_nh10",
        rainfall_72h_mm=190.0,
        soil_moisture_anomaly=0.22
    )
    result = intelligence_engine.compute_dynamic_trigger(trigger_in)
    assert result["trigger_probability"] > 0.60
    assert result["threshold_exceedance_pct"] > 0
    assert len(result["confidence_interval"]) == 2

def test_insar_data_retrieval():
    res = client.get("/api/intelligence/insar/south_lhonak")
    assert res.status_code == 200
    data = res.json()
    assert data["zone_id"] == "south_lhonak"
    assert len(data["time_series"]) > 5
    assert data["current_velocity_mm_yr"] < -30.0

def test_consequence_alert_card():
    card = consequence_engine.generate_consequence_card(
        zone_id="nh10_singtam_rangpo",
        custom_rainfall_72h=186.0,
        custom_rainfall_rate=58.4,
        custom_insar_velocity=12.4
    )
    assert card.landslide_probability >= 0.80
    assert card.total_population_at_risk > 4000
    assert card.nh10_closure_probability > 0.85
    assert card.downstream_isolated_villages_count == 7
    assert card.alternative_route_viability_hours > 0

def test_networkx_graph_routing():
    # Test baseline intact route
    intact_res = consequence_engine.compute_network_routing_and_isolation(sever_nh10=False)
    assert intact_res["baseline_time_mins"] < 90

    # Test severed NH-10 with dynamic Dijkstra rerouting
    severed_res = consequence_engine.compute_network_routing_and_isolation(sever_nh10=True)
    assert severed_res["nh10_severed"] is True
    assert "RONGLI" in severed_res["detour_path"] or "RHENOCK" in severed_res["detour_path"]
    assert severed_res["delay_penalty_mins"] > 0
    assert severed_res["isolated_settlements_count"] == 7

def test_ed25519_blockchain_signatures():
    # 1. Verify ledger integrity
    integrity = decision_ledger.verify_ledger_integrity()
    assert integrity["is_valid"] is True
    assert "Ed25519" in integrity["cryptography_standard"]

    # 2. Verify authentic signature on Block 0
    gen_block = decision_ledger.chain[0]
    gen_sig = decision_ledger.signatures[0]
    is_valid_sig = key_manager.verify_signature("ROOT_AUTHORITY", gen_block.block_hash, gen_sig)
    assert is_valid_sig is True

    # 3. Verify signature tampering rejection
    tamper_res = decision_ledger.simulate_tampering(1, "hazard_level", "FAKE_TAMPERED_SAFE")
    assert tamper_res["action"] == "TAMPER_INJECTED"
    
    # Ledger should catch payload / signature inconsistency
    invalid_integrity = decision_ledger.verify_ledger_integrity()
    assert invalid_integrity["is_valid"] is False

    # Restore legitimate state
    decision_ledger.chain[1].action_payload["hazard_level"] = "CRITICAL"
    decision_ledger.chain[1].is_valid = True
    assert decision_ledger.verify_ledger_integrity()["is_valid"] is True

def test_dynamic_ledger_analytics():
    # Verify live on-chain metrics aggregation
    analytics = decision_ledger.get_district_performance_analytics()
    assert analytics["total_blocks_on_chain"] >= 4
    assert analytics["total_alerts_issued"] >= 1
    assert analytics["average_decision_lag_minutes"] > 0.0
    assert analytics["audit_compliance_score_pct"] == 100.0

def test_vector_semantic_rag():
    query = "What is the protocol for NH-10 road closure and vehicle diversion?"
    res = bhashini_service.query_sop_knowledge_base(query)
    assert "NDMA-SOP-LS-01" in res["matched_sop_id"]
    assert res["cosine_similarity"] > 0.15
    assert "CRITICAL CLOSURE TIMELINE" in res["answer_markdown"]

def test_bhashini_multilingual_broadcast():
    broadcast = bhashini_service.generate_multilingual_broadcast(
        alert_title="TEST EVACUATION ORDER",
        villages=["Ranipool", "Majitar"]
    )
    assert "ne" in broadcast["translations"]
    assert "hi" in broadcast["translations"]
    assert "bn" in broadcast["translations"]
    assert "as" in broadcast["translations"]
    assert "en" in broadcast["translations"]
    assert "रानीपूल" in broadcast["translations"]["ne"]["body_text"]

def test_voice_nlp_entity_extraction():
    dictation = "NH-10 near Rangpo completely blocked, large debris mudslide, water seepage bubbling, no injuries visible."
    nlp = bhashini_service.extract_nlp_entities_from_voice(dictation)
    assert "Rangpo" in nlp["extracted_entities"]["location"]
    assert nlp["extracted_entities"]["severity"] == "Extreme"
    assert "No casualties" in nlp["extracted_entities"]["injury_status"]

def test_sikkim_replay_timeline():
    steps = replay_engine.get_all_steps()
    assert len(steps) == 5
    assert steps[0]["hours_to_event"] == -72
    assert steps[4]["hours_to_event"] == 0
