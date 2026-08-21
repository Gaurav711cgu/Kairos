import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Users,
  Home,
  Truck,
  Activity,
  Building2,
  Clock,
  Send,
  Sliders,
  CheckCircle2,
  Lock,
  Compass,
  Copy,
  Check
} from 'lucide-react';
import { ConsequenceOutput } from '../../types';

interface ConsequenceCardProps {
  consequence: ConsequenceOutput | null;
  rainfall72h: number;
  setRainfall72h: (val: number) => void;
  insarVelocity: number;
  setInsarVelocity: (val: number) => void;
  onTriggerDecision: () => void;
}

export const ConsequenceCard: React.FC<ConsequenceCardProps> = ({
  consequence,
  rainfall72h,
  setRainfall72h,
  insarVelocity,
  setInsarVelocity,
  onTriggerDecision
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  if (!consequence) {
    return (
      <div className="p-8 bg-tactical-950 border border-tactical-800 rounded-lg flex items-center justify-center font-mono text-tactical-400">
        Computing real-time consequence model...
      </div>
    );
  }

  const isCritical = consequence.hazard_level === 'CRITICAL';
  const probPct = Math.round(consequence.landslide_probability * 100);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(consequence.evidence_hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="bg-tactical-950 border border-tactical-800 rounded-lg overflow-hidden shadow-2xl flex flex-col border-l-4 border-l-crimson-600">
      {/* Alert Header Banner */}
      <div className="bg-tactical-900 border-b border-tactical-800 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crimson-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-crimson-500"></span>
            </span>
            <span className="font-mono font-bold text-xs tracking-widest text-crimson-400 uppercase">
              [ SECTION 02 // OPERATIONAL CONSEQUENCE ALERT — {consequence.hazard_level} ]
            </span>
          </div>
          <span className="text-[11px] font-mono text-tactical-300 bg-tactical-950 px-2.5 py-1 rounded border border-tactical-800">
            {consequence.generated_at}
          </span>
        </div>
        <div className="text-xs text-slate-300 font-mono mt-1.5 flex items-center gap-1.5">
          <span className="text-tactical-400 uppercase tracking-wider text-[10px]">Zone:</span>
          <span className="text-white font-semibold">{consequence.zone_name}</span>
        </div>
      </div>

      {/* Hero Metric Readout Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-tactical-900/60 border-b border-tactical-800">
        <div className="p-3 bg-tactical-950 border border-tactical-800 rounded">
          <div className="text-[10px] font-mono uppercase tracking-wider text-tactical-400">Landslide Risk</div>
          <div className="text-2xl font-mono font-bold text-crimson-400 mt-0.5">{probPct}%</div>
          <div className="w-full bg-tactical-800 h-1 mt-1.5 rounded-none overflow-hidden">
            <div className="bg-crimson-500 h-full" style={{ width: `${probPct}%` }} />
          </div>
        </div>

        <div className="p-3 bg-tactical-950 border border-tactical-800 rounded">
          <div className="text-[10px] font-mono uppercase tracking-wider text-tactical-400">Population at Risk</div>
          <div className="text-2xl font-mono font-bold text-white mt-0.5">
            {consequence.total_population_at_risk.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-tactical-400 mt-1">In Direct Runout Zone</div>
        </div>

        <div className="p-3 bg-tactical-950 border border-tactical-800 rounded">
          <div className="text-[10px] font-mono uppercase tracking-wider text-tactical-400">Isolated Population</div>
          <div className="text-2xl font-mono font-bold text-amber-400 mt-0.5">
            {consequence.downstream_isolated_population.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-tactical-400 mt-1">7 Downstream Settlements</div>
        </div>

        <div className="p-3 bg-tactical-950 border border-tactical-800 rounded">
          <div className="text-[10px] font-mono uppercase tracking-wider text-tactical-400">Route B Viability</div>
          <div className="text-2xl font-mono font-bold text-telemetry-400 mt-0.5">
            ~{consequence.alternative_route_viability_hours}h
          </div>
          <div className="text-[10px] font-mono text-tactical-400 mt-1">Decay at &gt;65 mm/hr</div>
        </div>
      </div>

      {/* Live Simulation Sliders */}
      <div className="bg-tactical-950 border-b border-tactical-800 p-3 px-4 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-2 text-tactical-400">
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] uppercase tracking-wider">Scenario Stress-Test:</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-tactical-300 text-[11px]">72h Cumulative Rain:</span>
          <input
            type="range"
            min="60"
            max="300"
            step="5"
            value={rainfall72h}
            onChange={(e) => setRainfall72h(parseFloat(e.target.value))}
            className="w-28 accent-crimson-500 cursor-pointer"
          />
          <span className="font-mono font-bold text-amber-400 w-14 text-xs">{rainfall72h} mm</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-tactical-300 text-[11px]">InSAR Velocity:</span>
          <input
            type="range"
            min="1"
            max="35"
            step="1"
            value={insarVelocity}
            onChange={(e) => setInsarVelocity(parseFloat(e.target.value))}
            className="w-28 accent-radar-500 cursor-pointer"
          />
          <span className="font-mono font-bold text-radar-400 w-16 text-xs">{insarVelocity} mm/yr</span>
        </div>
      </div>

      {/* Card Content - Monospace High-Density Telemetry */}
      <div className="p-4 font-mono space-y-3.5 text-xs">
        {/* Section 1: HAZARD */}
        <div className="bg-tactical-900/80 p-3.5 rounded border border-tactical-800">
          <div className="text-crimson-400 font-bold tracking-widest text-[11px] mb-2 flex items-center justify-between">
            <span>[1] GEOLOGICAL & CLIMATIC HAZARD</span>
            <span className="text-tactical-500 font-normal">MODEL: GBM-PROD-v1.0</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-slate-200">
            <div>
              Landslide Probability (6h):{' '}
              <span className="text-crimson-400 font-bold">{probPct}% (Calibrated)</span>
            </div>
            <div>
              Primary Trigger Driver:{' '}
              <span className="text-amber-300 font-medium">{consequence.primary_driver}</span>
            </div>
            <div>
              72h Rainfall Total:{' '}
              <span className="text-white font-bold">{consequence.rainfall_72h_mm} mm</span>{' '}
              <span className="text-tactical-400 text-[11px]">(Critical: {consequence.state_threshold_mm} mm, +{consequence.threshold_exceedance_pct}%)</span>
            </div>
            <div>
              Sentinel-1 InSAR Deformation:{' '}
              <span className="text-radar-400 font-bold">
                {consequence.deformation_velocity_mm_yr} mm/yr LOS (Tertiary Acceleration)
              </span>
            </div>
            <div className="md:col-span-2">
              Terrain Susceptibility Class:{' '}
              <span className="text-amber-400">{consequence.susceptibility_class}</span>
            </div>
          </div>
        </div>

        {/* Section 2: CONSEQUENCE & POPULATION */}
        <div className="bg-tactical-900/80 p-3.5 rounded border border-tactical-800">
          <div className="text-amber-400 font-bold tracking-widest text-[11px] mb-2 flex items-center justify-between">
            <span>[2] CIVILIAN EXPOSURE & STAGING AREAS</span>
            <span className="text-tactical-500 font-normal">CENSUS 2011 + WORLDPOP</span>
          </div>
          <div className="space-y-2">
            <div className="text-slate-300">
              Villages in Direct Debris Path:{' '}
              <span className="text-amber-300 font-bold">{consequence.affected_villages.length} Sectors</span>
            </div>
            <div className="pl-3 border-l-2 border-amber-600/60 space-y-1.5">
              {consequence.affected_villages.map((v, i) => (
                <div key={i} className="text-slate-300 flex items-center justify-between flex-wrap gap-1">
                  <span>→ <strong className="text-white">{v.name}</strong> (pop. {v.population.toLocaleString()}, {v.structures} buildings)</span>
                  <span className="text-[11px] text-tactical-400 bg-tactical-950 px-2 py-0.5 rounded border border-tactical-800">
                    Staging: {v.evacuation_staging_area}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: INFRASTRUCTURE */}
        <div className="bg-tactical-900/80 p-3.5 rounded border border-tactical-800">
          <div className="text-telemetry-400 font-bold tracking-widest text-[11px] mb-2 flex items-center justify-between">
            <span>[3] INFRASTRUCTURE CUTOFF & TOPOLOGY ROUTING</span>
            <span className="text-tactical-500 font-normal">NETWORKX DIJKSTRA SOLVER</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-slate-200">
            <div>
              NH-10 Highway Segment at Risk:{' '}
              <span className="text-crimson-400 font-bold">2.4 km (Chainage 142+300)</span>
            </div>
            <div>
              NH-10 Closure Probability:{' '}
              <span className="text-crimson-400 font-bold">
                {Math.round(consequence.nh10_closure_probability * 100)}%
              </span>
            </div>
            <div className="md:col-span-2">
              Downstream Settlements Cut Off from Capital:{' '}
              <span className="text-amber-400 font-bold">
                {consequence.downstream_isolated_villages_count} Settlements ({consequence.downstream_isolated_population.toLocaleString()} Citizens)
              </span>
            </div>
            <div>
              Nearest Multi-Speciality Hospital:{' '}
              <span className="text-radar-400 font-semibold">{consequence.nearest_hospital_name} (14.2 km)</span>
            </div>
            <div>
              Sivok-Rangpo Rail Corridor Exposure:{' '}
              <span className="text-purple-400 font-bold">1.8 km</span> (Closure: {Math.round(consequence.railway_closure_probability * 100)}%)
            </div>
            <div className="md:col-span-2 p-2.5 bg-tactical-950 rounded border border-tactical-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">Alternative Evacuation Artery:</span>
                <span className="text-radar-400 font-bold">{consequence.alternative_route_name}</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-slate-400 text-[11px]">
                <span>Saturation Viability Window:</span>
                <span className="text-amber-300 font-bold">
                  ~{consequence.alternative_route_viability_hours} hours remaining (at {consequence.current_rainfall_rate_mm_hr} mm/hr)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: RECOMMENDED ACTION */}
        <div className="bg-crimson-950/30 p-3.5 rounded border border-crimson-700/80">
          <div className="text-crimson-400 font-bold tracking-widest text-[11px] mb-2 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-crimson-400" />
            <span>[4] MANDATORY DISTRICT COLLECTOR DIRECTIVES</span>
          </div>
          <div className="space-y-1.5 text-slate-200">
            <div>
              • <strong className="text-white">Immediate Mandatory Evacuation:</strong>{' '}
              <span className="text-crimson-300">Ranipool & Majitar settlements</span>
            </div>
            <div>
              • <strong className="text-white">Field Inspection Deployment:</strong>{' '}
              <span className="text-amber-300">{consequence.field_inspection_priority}</span>
            </div>
            <div>
              • <strong className="text-white">Pre-Position NDRF / SDRF:</strong>{' '}
              <span className="text-radar-400">{consequence.ndrf_staging_point}</span>
            </div>
          </div>
        </div>

        {/* Footer Meta & Large Authority CTA Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 text-[11px] text-tactical-400 border-t border-tactical-800">
          <div className="flex items-center gap-2">
            <span>MODEL CONFIDENCE: <strong className="text-white">{consequence.model_confidence_pct}%</strong></span>
            <span>|</span>
            <button
              onClick={handleCopyHash}
              className="flex items-center gap-1 font-mono text-[10px] text-tactical-400 hover:text-white transition-colors bg-tactical-900 px-2 py-0.5 rounded border border-tactical-800"
              title="Click to copy SHA-256 evidence hash"
            >
              {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedHash ? 'COPIED' : `HASH: ${consequence.evidence_hash.substring(0, 12)}...`}</span>
            </button>
          </div>

          <button
            onClick={onTriggerDecision}
            className="w-full sm:w-auto px-5 py-2.5 bg-crimson-600 hover:bg-crimson-500 active:scale-[0.98] text-white font-bold rounded font-mono text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-lg border border-crimson-500"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>AUTHORIZE EVACUATION ORDER (ED25519 SIGN)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
