import React from 'react';
import { Play, ShieldAlert, Cpu, Sparkles, Activity } from 'lucide-react';

interface DemoPresetSelectorProps {
  onSelectPreset: (presetId: 'DEMO_A' | 'DEMO_B' | 'DEMO_C' | 'REPLAY') => void;
  activePreset: string;
}

export const DemoPresetSelector: React.FC<DemoPresetSelectorProps> = ({ onSelectPreset, activePreset }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-tactical-900 border border-tactical-700 rounded-lg shadow-inner">
      <span className="text-[11px] font-mono uppercase tracking-wider text-tactical-400 flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
        SIH Demo Presets:
      </span>

      <button
        onClick={() => onSelectPreset('DEMO_A')}
        className={`px-2.5 py-1 text-xs font-mono rounded flex items-center gap-1.5 transition-all ${
          activePreset === 'DEMO_A'
            ? 'bg-crimson-600 text-white font-semibold shadow-md glow-crimson'
            : 'bg-tactical-800 text-tactical-300 hover:bg-tactical-700 hover:text-white'
        }`}
        title="Demo A: NH-10 Consequence Output (5 min)"
      >
        <ShieldAlert className="w-3.5 h-3.5 text-crimson-400" />
        <span>Demo A: Consequence</span>
      </button>

      <button
        onClick={() => onSelectPreset('DEMO_B')}
        className={`px-2.5 py-1 text-xs font-mono rounded flex items-center gap-1.5 transition-all ${
          activePreset === 'DEMO_B'
            ? 'bg-amber-600 text-white font-semibold shadow-md glow-amber'
            : 'bg-tactical-800 text-tactical-300 hover:bg-tactical-700 hover:text-white'
        }`}
        title="Demo B: Decision Chain & Blockchain (5 min)"
      >
        <Cpu className="w-3.5 h-3.5 text-amber-400" />
        <span>Demo B: Decision Chain</span>
      </button>

      <button
        onClick={() => onSelectPreset('DEMO_C')}
        className={`px-2.5 py-1 text-xs font-mono rounded flex items-center gap-1.5 transition-all ${
          activePreset === 'DEMO_C'
            ? 'bg-radar-600 text-white font-semibold shadow-md glow-radar'
            : 'bg-tactical-800 text-tactical-300 hover:bg-tactical-700 hover:text-white'
        }`}
        title="Demo C: Sentinel-1 InSAR Pre-Failure Revelation (5 min)"
      >
        <Activity className="w-3.5 h-3.5 text-radar-400" />
        <span>Demo C: InSAR Revelation</span>
      </button>

      <div className="h-4 w-px bg-tactical-700 mx-1" />

      <button
        onClick={() => onSelectPreset('REPLAY')}
        className={`px-2.5 py-1 text-xs font-mono rounded flex items-center gap-1.5 transition-all ${
          activePreset === 'REPLAY'
            ? 'bg-telemetry-600 text-white font-semibold shadow-md glow-cyan'
            : 'bg-tactical-800 text-telemetry-400 hover:bg-tactical-700 hover:text-white'
        }`}
        title="Full Sikkim 2023 GLOF Timeline Replay (T-72h to T-0)"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>T-72h Sikkim Replay</span>
      </button>
    </div>
  );
};
