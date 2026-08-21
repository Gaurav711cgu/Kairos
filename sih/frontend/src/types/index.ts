export type HazardLevel = 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL';
export type WorkflowState = 'ALERT_GENERATED' | 'FIELD_VERIFICATION' | 'AUTHORITY_DECISION' | 'ACTION_EXECUTION' | 'OUTCOME_RECORDED';

export interface VillageImpact {
  name: string;
  population: number;
  structures: number;
  lat: number;
  lng: number;
  distance_to_flow_m: number;
  evacuation_staging_area: string;
}

export interface ConsequenceOutput {
  alert_id: string;
  zone_id: string;
  zone_name: string;
  generated_at: string;
  hazard_level: HazardLevel;
  landslide_probability: number;
  primary_driver: string;
  rainfall_72h_mm: number;
  state_threshold_mm: number;
  threshold_exceedance_pct: number;
  active_deformation: boolean;
  deformation_velocity_mm_yr: number;
  susceptibility_class: string;
  susceptibility_score: number;
  affected_villages: VillageImpact[];
  total_population_at_risk: number;
  buildings_in_impact_zone: number;
  nh10_at_risk: boolean;
  nh10_segment_km: number;
  nh10_closure_probability: number;
  downstream_isolated_villages_count: number;
  downstream_isolated_population: number;
  railway_corridor_exposed_km: number;
  railway_closure_probability: number;
  nearest_hospital_name: string;
  nearest_hospital_dist_km: number;
  nearest_hospital_accessible: boolean;
  alternative_route_name: string;
  alternative_route_passable: boolean;
  alternative_route_viability_hours: number;
  critical_rainfall_rate_mm_hr: number;
  current_rainfall_rate_mm_hr: number;
  recommended_action: string;
  immediate_evacuation_targets: string[];
  field_inspection_priority: string;
  ndrf_staging_point: string;
  notify_departments: string[];
  model_confidence_pct: number;
  evidence_sources_count: number;
  evidence_hash: string;
}

export interface InSARDataPoint {
  date: string;
  displacement_mm: number;
  velocity_mm_yr: number;
  acceleration_sigma: number;
  coherence?: number;
  status?: string;
}

export interface InSARZoneResponse {
  zone_id: string;
  zone_name: string;
  historical_context: string;
  current_velocity_mm_yr: number;
  acceleration_sigma: number;
  status: string;
  time_series: InSARDataPoint[];
}

export interface PersistentScattererPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  velocity_mm_yr: number;
  status: string;
  coherence: number;
}

export interface BlockRecord {
  index: number;
  timestamp: string;
  previous_hash: string;
  alert_id: string;
  workflow_state: WorkflowState;
  signer_role: string;
  signer_id: string;
  evidence_hash: string;
  action_payload: Record<string, any>;
  block_hash: string;
  is_valid: boolean;
  ed25519_signature?: string;
  signer_public_key_hex?: string;
}

export interface LedgerVerificationResult {
  is_valid: boolean;
  total_blocks: number;
  head_block_index?: number;
  head_hash?: string;
  tampered_block_index?: number;
  error_reason?: string;
  verification_status?: string;
}

export interface FieldReport {
  report_id: string;
  alert_id?: string;
  officer_id: string;
  officer_name: string;
  lat: number;
  lng: number;
  observation: string;
  severity: string;
  verification_status: string;
  notes?: string;
  voice_transcript?: string;
  structured_nlp_entities?: Record<string, any>;
  photo_url?: string;
  timestamp: string;
  sync_status: string;
}

export interface CitizenReport {
  report_id: string;
  citizen_name?: string;
  phone?: string;
  report_type: string;
  lat: number;
  lng: number;
  location_desc: string;
  details: string;
  timestamp: string;
}

export interface TelemetryNode {
  node_id: string;
  type: string;
  location: string;
  lat: number;
  lng: number;
  current_rate_mm_hr?: number;
  accum_24h_mm?: number;
  accum_72h_mm?: number;
  volumetric_water_content_pct?: number;
  pore_water_pressure_kpa?: number;
  pitch_deg?: number;
  roll_deg?: number;
  water_level_m?: number;
  status: string;
  battery_pct: number;
}

export interface ReplayStep {
  step_index: number;
  time_label: string;
  hours_to_event: number;
  satellite_status: string;
  sar_cloud_penetration: boolean;
  optical_satellite_usable: boolean;
  rainfall_72h_mm: number;
  rainfall_intensity_mm_hr: number;
  soil_moisture_pct: number;
  insar_los_velocity_mm_yr: number;
  insar_acceleration_sigma: number;
  risk_probability: number;
  hazard_level: HazardLevel;
  system_action: string;
  ledger_event: string;
}
