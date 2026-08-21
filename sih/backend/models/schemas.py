from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime

class HazardLevel(str, Enum):
    NORMAL = "NORMAL"
    WATCH = "WATCH"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

class WorkflowState(str, Enum):
    ALERT_GENERATED = "ALERT_GENERATED"
    FIELD_VERIFICATION = "FIELD_VERIFICATION"
    AUTHORITY_DECISION = "AUTHORITY_DECISION"
    ACTION_EXECUTION = "ACTION_EXECUTION"
    OUTCOME_RECORDED = "OUTCOME_RECORDED"

class AuthorityDecisionType(str, Enum):
    EVACUATE = "EVACUATE"
    INSPECT = "INSPECT"
    MONITOR = "MONITOR"
    DISMISS = "DISMISS"

class ObservationType(str, Enum):
    CRACKS = "Cracks"
    WATER_SEEPAGE = "Water seepage"
    ROAD_UNSTABLE = "Road unstable"
    DEBRIS_VISIBLE = "Debris visible"
    ROAD_BLOCKED = "Road blocked"
    ALL_CLEAR = "All clear"

class SeverityLevel(str, Enum):
    MINOR = "Minor"
    SIGNIFICANT = "Significant"
    EXTREME = "Extreme"

class SusceptibilityVector(BaseModel):
    # Topographic (11)
    elevation_m: float = 1420.0
    slope_deg: float = 34.5
    aspect_deg: float = 142.0
    profile_curvature: float = 0.08
    plan_curvature: float = -0.04
    relief_amplitude_m: float = 680.0
    tri: float = 18.4
    tpi: float = 4.2
    twi: float = 8.6
    spi: float = 24.1
    sti: float = 15.3
    # Hydrological (4)
    dist_to_drainage_m: float = 180.0
    drainage_density: float = 3.4
    flow_accumulation: float = 8400.0
    watershed_zone: str = "Teesta Upper Basin"
    # Geological (4)
    lithology_class: str = "Phyllitic / Daling Series"
    dist_to_lineament_m: float = 220.0
    lineament_density: float = 2.8
    geomorphology: str = "Steep Denudo-Structural Ridge"
    # Land / Infrastructure (3)
    lulc_class: str = "Degraded Forest / Scrub"
    ndvi: float = 0.42
    dist_to_road_m: float = 45.0

class DynamicTriggerInput(BaseModel):
    region_id: str = "sikkim_east_nh10"
    state: str = "Sikkim"
    lithology_group: str = "phyllitic"
    rainfall_1h_mm: float = 24.0
    rainfall_6h_mm: float = 68.0
    rainfall_24h_mm: float = 112.0
    rainfall_72h_mm: float = 186.0
    rainfall_7d_mm: float = 320.0
    forecast_24h_mm: float = 95.0
    soil_moisture_surface: float = 0.44
    soil_moisture_rootzone: float = 0.52
    soil_moisture_anomaly: float = 0.18 # SMAP anomaly
    antecedent_condition: str = "saturated"

class InSARDeformationData(BaseModel):
    zone_id: str = "nh10_singtam_rangpo"
    zone_name: str = "NH-10 Singtam–Rangpo Corridor"
    los_velocity_mm_yr: float = 12.4
    historical_baseline_mm_yr: float = 3.2
    acceleration_index: float = 2.88 # sigma acceleration
    is_accelerating: bool = True
    coherence: float = 0.72
    sar_backscatter_delta_db: float = -3.4
    acquisition_date: str = "2026-08-18"
    time_series: List[Dict[str, Any]] = []

class VillageImpact(BaseModel):
    name: str
    population: int
    structures: int
    lat: float
    lng: float
    distance_to_flow_m: float
    evacuation_staging_area: str

class ConsequenceOutput(BaseModel):
    alert_id: str
    zone_id: str
    zone_name: str
    generated_at: str
    hazard_level: HazardLevel
    landslide_probability: float
    primary_driver: str
    rainfall_72h_mm: float
    state_threshold_mm: float
    threshold_exceedance_pct: float
    active_deformation: bool
    deformation_velocity_mm_yr: float
    susceptibility_class: str
    susceptibility_score: float
    
    # Impact
    affected_villages: List[VillageImpact]
    total_population_at_risk: int
    buildings_in_impact_zone: int
    
    # Infrastructure
    nh10_at_risk: bool
    nh10_segment_km: float
    nh10_closure_probability: float
    downstream_isolated_villages_count: int
    downstream_isolated_population: int
    railway_corridor_exposed_km: float
    railway_closure_probability: float
    nearest_hospital_name: str
    nearest_hospital_dist_km: float
    nearest_hospital_accessible: bool
    
    # Alternative Routing
    alternative_route_name: str
    alternative_route_passable: bool
    alternative_route_viability_hours: float
    critical_rainfall_rate_mm_hr: float
    current_rainfall_rate_mm_hr: float
    
    # Recommendations
    recommended_action: str
    immediate_evacuation_targets: List[str]
    field_inspection_priority: str
    ndrf_staging_point: str
    notify_departments: List[str]
    model_confidence_pct: int
    evidence_sources_count: int
    evidence_hash: str

class BlockRecord(BaseModel):
    index: int
    timestamp: str
    previous_hash: str
    alert_id: str
    workflow_state: WorkflowState
    signer_role: str # SYSTEM, FIELD_OFFICER, DISTRICT_COLLECTOR, NDRF_DISPATCH
    signer_id: str
    evidence_hash: str
    action_payload: Dict[str, Any]
    block_hash: str
    is_valid: bool = True

class FieldObservationSubmit(BaseModel):
    alert_id: Optional[str] = "ALT-2026-0814-01"
    officer_id: str = "OFFICER-SK-042"
    officer_name: str = "Sub-Inspector T. Norbu"
    lat: float = 27.2345
    lng: float = 88.5120
    observation: ObservationType = ObservationType.CRACKS
    severity: SeverityLevel = SeverityLevel.EXTREME
    verification_status: str = "CONFIRMED" # CONFIRMED / CANNOT_VERIFY / DENIED
    notes: Optional[str] = "Visible tension cracks widening along NH-10 slope near chainage 142+300. Water seepage actively bubbling."
    voice_transcript: Optional[str] = None
    structured_nlp_entities: Optional[Dict[str, Any]] = None
    photo_url: Optional[str] = "/assets/evidence/crack_slope_sample.jpg"
    offline_cached_at: Optional[str] = None

class CitizenReportSubmit(BaseModel):
    citizen_name: Optional[str] = "Local Resident"
    phone: Optional[str] = "+91 98765 43210"
    report_type: str # "I SEE SOMETHING WRONG" / "ROAD IS BLOCKED" / "WE NEED HELP"
    lat: float = 27.2380
    lng: float = 88.5145
    location_desc: str = "Near Singtam Bazaar lower bridge"
    details: str = "Small mudslide sliding onto lower road, water muddy and heavy."
    photo_url: Optional[str] = None

class CollectorDecisionSubmit(BaseModel):
    alert_id: str
    collector_id: str = "DC-EAST-SIKKIM-01"
    collector_name: str = "District Magistrate / Collector"
    decision: AuthorityDecisionType = AuthorityDecisionType.EVACUATE
    reasoning_notes: str = "Field report confirmed active slope failure and water seepage. Ordering immediate pre-emptive evacuation for Ranipool and Majitar."
    evacuate_villages: List[str] = ["Ranipool", "Majitar"]
    trigger_multilingual_broadcast: bool = True
    dispatch_ndrf: bool = True
    close_nh10_segment: bool = True

class OutcomeRecordSubmit(BaseModel):
    alert_id: str
    recorded_by: str = "DDMA-EVALUATOR-03"
    actual_event_occurred: bool = True
    event_timestamp: str = "2026-08-14T05:22:00+05:30"
    landslide_volume_m3: float = 14500.0
    casualties: int = 0
    lives_protected_estimate: int = 4187
    nh10_blocked_duration_hours: float = 18.5
    lead_time_actual_hours: float = 5.4
    decision_lag_minutes: float = 19.0
    post_event_notes: str = "Evacuation completed 80 mins prior to main debris runout. Zero casualties recorded."
