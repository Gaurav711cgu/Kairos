import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  X,
  Sparkles,
  CloudRain,
  Activity,
  ShieldAlert,
  Lock,
  Layers
} from 'lucide-react';
import { api } from '../../services/api';
import { ReplayStep } from '../../types';

interface EventReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EventReplayModal: React.FC<EventReplayModalProps> = ({ isOpen, onClose }) => {
  const [steps, setSteps] = useState<ReplayStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getSikkimReplaySteps().then((data) => setSteps(data));
      setCurrentStepIdx(0);
      setIsPlaying(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && steps.length > 0) {
      timer = setInterval(() => {
        setCurrentStepIdx((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, steps]);

  if (!isOpen || steps.length === 0) return null;

  const current = steps[currentStepIdx];
  const isCritical = current.hazard_level === 'CRITICAL';
  const isWarning = current.hazard_level === 'WARNING';

  const badgeColor = isCritical
    ? 'bg-crimson-950 text-crimson-400 border-crimson-700'
    : isWarning
    ? 'bg-amber-950 text-amber-400 border-amber-700'
    : 'bg-radar-950 text-radar-400 border-radar-700';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-tactical-900 border-2 border-telemetry-500/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col gap-4 font-mono text-xs glow-cyan">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-tactical-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Play className="w-6 h-6 text-telemetry-400 fill-current" />
            <div>
              <h3 className="text-base font-bold text-white">
                HISTORICAL EVENT REPLAY: SIKKIM SOUTH LHONAK GLOF (OCTOBER 2023)
              </h3>
              <p className="text-[11px] text-tactical-400">
                Evaluating lead-time evolution from T-72 Hours to Event Inception (Oct 1–4, 2023)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-tactical-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline Navigation Bar */}
        <div className="flex items-center justify-between gap-1 p-1 bg-tactical-950 rounded-xl border border-tactical-800">
          {steps.map((st, i) => (
            <button
              key={i}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStepIdx(i);
              }}
              className={`flex-1 py-2 px-1 rounded-lg text-center font-bold text-[11px] transition-all ${
                i === currentStepIdx
                  ? 'bg-telemetry-600 text-white shadow-lg'
                  : i < currentStepIdx
                  ? 'bg-tactical-800 text-slate-300'
                  : 'text-tactical-500 hover:text-tactical-300'
              }`}
            >
              {st.hours_to_event === 0 ? 'T-0 (Event)' : `T${st.hours_to_event}h`}
            </button>
          ))}
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentStepIdx((p) => Math.max(0, p - 1))}
            className="p-2 bg-tactical-800 hover:bg-tactical-700 text-white rounded-lg"
            title="Previous Step"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 bg-telemetry-600 hover:bg-telemetry-500 text-white font-bold rounded-lg flex items-center gap-2 shadow-md"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'Pause Replay' : 'Auto Play Simulation'}</span>
          </button>
          <button
            onClick={() => setCurrentStepIdx((p) => Math.min(steps.length - 1, p + 1))}
            className="p-2 bg-tactical-800 hover:bg-tactical-700 text-white rounded-lg"
            title="Next Step"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIdx(0);
            }}
            className="p-2 bg-tactical-800 hover:bg-tactical-700 text-tactical-400 hover:text-white rounded-lg"
            title="Reset to T-72h"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Current State Detailed Card */}
        <div className="bg-tactical-950 p-4 rounded-xl border border-tactical-800 space-y-3">
          <div className="flex items-center justify-between border-b border-tactical-800 pb-2">
            <span className="text-base font-bold text-white">{current.time_label}</span>
            <span className={`px-2.5 py-0.5 rounded border font-bold ${badgeColor}`}>
              RISK: {current.hazard_level} ({Math.round(current.risk_probability * 100)}%)
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            <div className="p-2.5 bg-tactical-900 rounded border border-tactical-800">
              <div className="text-tactical-400">72H RAINFALL</div>
              <div className="text-sm font-bold text-amber-400 mt-0.5">{current.rainfall_72h_mm} mm</div>
              <div className="text-tactical-500 text-[10px]">Rate: {current.rainfall_intensity_mm_hr} mm/hr</div>
            </div>

            <div className="p-2.5 bg-tactical-900 rounded border border-tactical-800">
              <div className="text-tactical-400">SOIL MOISTURE</div>
              <div className="text-sm font-bold text-amber-400 mt-0.5">{current.soil_moisture_pct}%</div>
              <div className="text-tactical-500 text-[10px]">Root-zone saturation</div>
            </div>

            <div className="p-2.5 bg-tactical-900 rounded border border-tactical-800">
              <div className="text-tactical-400">InSAR LOS VELOCITY</div>
              <div className="text-sm font-bold text-radar-400 mt-0.5">{current.insar_los_velocity_mm_yr} mm/yr</div>
              <div className="text-tactical-500 text-[10px]">Accel: {current.insar_acceleration_sigma}σ</div>
            </div>

            <div className="p-2.5 bg-tactical-900 rounded border border-tactical-800">
              <div className="text-tactical-400">C-BAND SAR STATUS</div>
              <div className="text-sm font-bold text-radar-400 mt-0.5">PENETRATING CLOUDS</div>
              <div className="text-tactical-500 text-[10px]">Optical sat: {current.optical_satellite_usable ? 'Clear' : 'Blocked (100%)'}</div>
            </div>
          </div>

          {/* System Action */}
          <div className="p-3 bg-tactical-900 rounded-lg border border-tactical-800 space-y-1">
            <div className="text-tactical-400 font-semibold text-[10px] uppercase">Automated System Action:</div>
            <div className="text-slate-200 text-xs leading-relaxed">{current.system_action}</div>
          </div>

          {/* Blockchain Ledger Entry */}
          <div className="p-2.5 bg-purple-950/40 rounded border border-purple-800 text-purple-300 text-[11px] flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span>{current.ledger_event}</span>
          </div>
        </div>

        {/* Lead Time Claim Defense */}
        <div className="p-3 bg-tactical-950 rounded-lg border border-tactical-800 text-tactical-300 text-xs">
          <strong className="text-amber-300">★ Key Hackathon Takeaway:</strong>
          <span className="ml-1 text-slate-300">
            SAHAYAK provided <strong>at least 72 hours of lead-time</strong> prior to moraine breach by operationalizing Sentinel-1 SBAS-InSAR deformation signals that optical sensors completely missed due to monsoon cloud cover.
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-tactical-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-tactical-800 hover:bg-tactical-700 text-tactical-300 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
