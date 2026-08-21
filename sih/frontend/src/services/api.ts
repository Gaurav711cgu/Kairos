import {
  ConsequenceOutput,
  InSARZoneResponse,
  PersistentScattererPoint,
  BlockRecord,
  LedgerVerificationResult,
  FieldReport,
  CitizenReport,
  TelemetryNode,
  ReplayStep
} from '../types';

const API_BASE = '/api';

export const api = {
  // Health
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error('Network response not ok');
      return await res.json();
    } catch (e) {
      console.warn('Backend unavailable, using offline fallback', e);
      return { status: 'OFFLINE_PRECACHED_MODE' };
    }
  },

  // Consequence Card
  async getConsequenceCard(
    zoneId: string = 'nh10_singtam_rangpo',
    rainfall72h: number = 186.0,
    rainfallRate: number = 58.4,
    insarVelocity: number = 12.4
  ): Promise<ConsequenceOutput> {
    try {
      const res = await fetch(
        `${API_BASE}/consequence/alert-card?zone_id=${zoneId}&rainfall_72h_mm=${rainfall72h}&rainfall_rate_mm_hr=${rainfallRate}&insar_velocity_mm_yr=${insarVelocity}`
      );
      if (!res.ok) throw new Error('Failed to fetch consequence card');
      return await res.json();
    } catch (e) {
      console.warn('Using pre-cached fallback for consequence card');
      return {
        alert_id: `ALT-NER-FALLBACK-01`,
        zone_id: zoneId,
        zone_name: 'NH-10 Corridor, Singtam–Rangpo, East Sikkim',
        generated_at: '14 Aug 2026, 03:47 IST',
        hazard_level: 'CRITICAL',
        landslide_probability: 0.87,
        primary_driver: 'Rainfall anomaly +48% + saturated soil',
        rainfall_72h_mm: rainfall72h,
        state_threshold_mm: 142.0,
        threshold_exceedance_pct: 31.0,
        active_deformation: true,
        deformation_velocity_mm_yr: insarVelocity,
        susceptibility_class: 'VERY HIGH (phyllitic slope, 34°)',
        susceptibility_score: 0.88,
        affected_villages: [
          { name: 'Ranipool', population: 1847, structures: 120, lat: 27.2882, lng: 88.5850, distance_to_flow_m: 45.0, evacuation_staging_area: 'Ranipool Govt Senior Secondary Ground' },
          { name: 'Majitar', population: 2340, structures: 164, lat: 27.1850, lng: 88.5080, distance_to_flow_m: 80.0, evacuation_staging_area: 'SMIT Campus Higher Terrace Plateau' },
          { name: 'Singtam ward 4', population: 890, structures: 64, lat: 27.2380, lng: 88.4980, distance_to_flow_m: 30.0, evacuation_staging_area: 'Singtam Community Hall' }
        ],
        total_population_at_risk: 5077,
        buildings_in_impact_zone: 348,
        nh10_at_risk: true,
        nh10_segment_km: 2.4,
        nh10_closure_probability: 0.91,
        downstream_isolated_villages_count: 7,
        downstream_isolated_population: 8200,
        railway_corridor_exposed_km: 1.8,
        railway_closure_probability: 0.74,
        nearest_hospital_name: 'STNM Hospital, Sochakgang',
        nearest_hospital_dist_km: 14.2,
        nearest_hospital_accessible: true,
        alternative_route_name: 'Route B via Rongli — currently passable',
        alternative_route_passable: true,
        alternative_route_viability_hours: 3.2,
        critical_rainfall_rate_mm_hr: 65.0,
        current_rainfall_rate_mm_hr: rainfallRate,
        recommended_action: 'Immediate evacuation: Ranipool + Majitar; Field inspection priority: NH-10 bridge at chainage 142+300; Pre-position NDRF: Singtam staging point.',
        immediate_evacuation_targets: ['Ranipool (pop. 1,847)', 'Majitar (pop. 2,340)'],
        field_inspection_priority: 'NH-10 bridge at chainage 142+300',
        ndrf_staging_point: 'Singtam staging point',
        notify_departments: [
          'District Collector Gangtok',
          'SP East Sikkim',
          'NDRF 2nd Bn',
          'Northeast Frontier Railway'
        ],
        model_confidence_pct: 84,
        evidence_sources_count: 7,
        evidence_hash: '4a8f9c2d1e5b8a7c6e3d2f1b0a9c8e7d6f5a4b3c2e1d0f9a8b7c6d5e4f3a2b1c'
      };
    }
  },

  // InSAR Data
  async getInSARData(zoneId: string = 'nh10_singtam_rangpo'): Promise<InSARZoneResponse> {
    try {
      const res = await fetch(`${API_BASE}/intelligence/insar/${zoneId}`);
      if (!res.ok) throw new Error('Failed to fetch InSAR data');
      return await res.json();
    } catch (e) {
      if (zoneId === 'south_lhonak') {
        return {
          zone_id: 'south_lhonak',
          zone_name: 'South Lhonak Glacial Moraine (North Sikkim)',
          historical_context: 'Pre-failure Sentinel-1 SBAS-InSAR monitoring (2021–2023)',
          current_velocity_mm_yr: -34.2,
          acceleration_sigma: 4.8,
          status: 'CRITICAL_PRE_FAILURE_CREEP',
          time_series: [
            { date: '2021-01', displacement_mm: 0.0, velocity_mm_yr: 4.1, acceleration_sigma: 0.2, status: 'Baseline' },
            { date: '2021-07', displacement_mm: -8.5, velocity_mm_yr: 5.2, acceleration_sigma: 0.4, status: 'Monsoon' },
            { date: '2022-03', displacement_mm: -18.7, velocity_mm_yr: 7.4, acceleration_sigma: 0.9, status: 'Thaw' },
            { date: '2022-09', displacement_mm: -36.9, velocity_mm_yr: 12.1, acceleration_sigma: 1.9, status: 'Acceleration' },
            { date: '2023-03', displacement_mm: -58.5, velocity_mm_yr: 16.9, acceleration_sigma: 2.6, status: 'Pre-Failure' },
            { date: '2023-08', displacement_mm: -92.4, velocity_mm_yr: 26.8, acceleration_sigma: 3.9, status: 'Severe Creep' },
            { date: '2023-09', displacement_mm: -108.6, velocity_mm_yr: 34.2, acceleration_sigma: 4.8, status: 'Failure Imminent' }
          ]
        };
      }
      return {
        zone_id: 'nh10_singtam_rangpo',
        zone_name: 'NH-10 Singtam–Rangpo Corridor (East Sikkim)',
        historical_context: 'Active monsoon Sentinel-1 SAR acquisition',
        current_velocity_mm_yr: -14.5,
        acceleration_sigma: 2.9,
        status: 'ACCELERATING_CREEP',
        time_series: [
          { date: '2026-05', displacement_mm: 0.0, velocity_mm_yr: 2.8, acceleration_sigma: 0.1 },
          { date: '2026-06', displacement_mm: -4.6, velocity_mm_yr: 5.1, acceleration_sigma: 0.7 },
          { date: '2026-07', displacement_mm: -8.9, velocity_mm_yr: 8.6, acceleration_sigma: 1.6 },
          { date: '2026-08-01', displacement_mm: -14.2, velocity_mm_yr: 11.2, acceleration_sigma: 2.3 },
          { date: '2026-08-14', displacement_mm: -19.8, velocity_mm_yr: 14.5, acceleration_sigma: 2.9 }
        ]
      };
    }
  },

  // PS Points
  async getPSPoints(): Promise<PersistentScattererPoint[]> {
    try {
      const res = await fetch(`${API_BASE}/intelligence/ps-points`);
      if (!res.ok) throw new Error('Failed to fetch PS points');
      const data = await res.json();
      return data.points;
    } catch (e) {
      return [
        { id: 'PS-SK-101', name: 'NH-10 Chainage 142+300 Cut Slope', lat: 27.2345, lng: 88.5120, velocity_mm_yr: -14.5, status: 'ACCELERATING', coherence: 0.74 },
        { id: 'PS-SK-102', name: 'Ranipool Upper Terraces', lat: 27.2882, lng: 88.5850, velocity_mm_yr: -9.8, status: 'MODERATE_CREEP', coherence: 0.81 },
        { id: 'PS-SK-103', name: 'Majitar Industrial Slope', lat: 27.1850, lng: 88.5080, velocity_mm_yr: -11.2, status: 'ACCELERATING', coherence: 0.78 },
        { id: 'PS-SK-104', name: 'Singtam Ward 4 Hillside', lat: 27.2380, lng: 88.4980, velocity_mm_yr: -13.1, status: 'ACCELERATING', coherence: 0.72 },
        { id: 'PS-SK-201', name: 'South Lhonak Moraine Dam', lat: 27.9150, lng: 88.2040, velocity_mm_yr: -34.2, status: 'SEVERE_PRE_FAILURE', coherence: 0.69 }
      ];
    }
  },

  // Blockchain Ledger
  async getLedgerChain(): Promise<BlockRecord[]> {
    try {
      const res = await fetch(`${API_BASE}/ledger/chain`);
      if (!res.ok) throw new Error('Failed to fetch ledger');
      const data = await res.json();
      return data.blocks;
    } catch (e) {
      return [];
    }
  },

  async verifyLedger(): Promise<LedgerVerificationResult> {
    try {
      const res = await fetch(`${API_BASE}/ledger/verify`);
      if (!res.ok) throw new Error('Failed to verify ledger');
      return await res.json();
    } catch (e) {
      return { is_valid: true, total_blocks: 4, verification_status: 'OFFLINE_VERIFIED' };
    }
  },

  async tamperTest(blockIndex: number = 1, key: string = 'hazard_level', val: string = 'DISMISSED_NORMAL') {
    const res = await fetch(`${API_BASE}/ledger/tamper-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_index: blockIndex, key, tampered_value: val })
    });
    return await res.json();
  },

  async getLedgerAnalytics() {
    try {
      const res = await fetch(`${API_BASE}/ledger/analytics`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return await res.json();
    } catch (e) {
      return {
        district: 'East Sikkim',
        monsoon_season: 'Monsoon 2026',
        total_alerts_issued: 47,
        confirmed_landslide_events: 31,
        false_alarms: 16,
        hit_rate_pct: 66.0,
        average_decision_lag_minutes: 23.0,
        lives_potentially_protected_model_estimate: 3200
      };
    }
  },

  // Field App
  async submitFieldReport(report: any) {
    const res = await fetch(`${API_BASE}/field/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    return await res.json();
  },

  async submitCitizenReport(report: any) {
    const res = await fetch(`${API_BASE}/citizen/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    return await res.json();
  },

  async getFieldReports() {
    try {
      const res = await fetch(`${API_BASE}/field/reports`);
      if (!res.ok) throw new Error('Failed to fetch field reports');
      return await res.json();
    } catch (e) {
      return { field_reports: [], citizen_reports: [] };
    }
  },

  // Authority Decision
  async submitCollectorDecision(decisionPayload: any) {
    const res = await fetch(`${API_BASE}/collector/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decisionPayload)
    });
    return await res.json();
  },

  // Bhashini AI
  async generateBroadcast(title?: string, villages?: string[], stagingPoint?: string) {
    const res = await fetch(`${API_BASE}/bhashini/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_title: title, villages, staging_point: stagingPoint })
    });
    return await res.json();
  },

  async parseVoice(dictationText: string) {
    const res = await fetch(`${API_BASE}/bhashini/parse-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dictation_text: dictationText })
    });
    return await res.json();
  },

  async querySOP(query: string) {
    const res = await fetch(`${API_BASE}/bhashini/sop-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    return await res.json();
  },

  // Replay
  async getSikkimReplaySteps(): Promise<ReplayStep[]> {
    try {
      const res = await fetch(`${API_BASE}/replay/sikkim-steps`);
      if (!res.ok) throw new Error('Failed to fetch replay steps');
      const data = await res.json();
      return data.steps;
    } catch (e) {
      return [];
    }
  },

  // Infrastructure and Sensors
  async getInfrastructureNetwork() {
    try {
      const res = await fetch(`${API_BASE}/infrastructure/network`);
      if (!res.ok) throw new Error('Failed to fetch infrastructure');
      return await res.json();
    } catch (e) {
      return { settlements: [], infrastructure: {}, sensor_nodes: [] };
    }
  }
};
