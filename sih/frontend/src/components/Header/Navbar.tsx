import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Radar,
  Radio,
  FileText,
  Volume2,
  BookOpen,
  BarChart3,
  Smartphone,
  CheckCircle2,
  Lock,
  Clock
} from 'lucide-react';
import { DemoPresetSelector } from './DemoPresetSelector';

interface NavbarProps {
  onSelectPreset: (presetId: 'DEMO_A' | 'DEMO_B' | 'DEMO_C' | 'REPLAY') => void;
  activePreset: string;
  activeTab: 'GIS' | 'INSAR' | 'CONSEQUENCE' | 'LEDGER' | 'ANALYTICS';
  setActiveTab: (tab: 'GIS' | 'INSAR' | 'CONSEQUENCE' | 'LEDGER' | 'ANALYTICS') => void;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (open: boolean) => void;
  openBroadcastModal: () => void;
  openSOPModal: () => void;
  openProofModal: () => void;
  openReplayModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSelectPreset,
  activePreset,
  activeTab,
  setActiveTab,
  isMobileDrawerOpen,
  setIsMobileDrawerOpen,
  openBroadcastModal,
  openSOPModal,
  openProofModal,
  openReplayModal
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' · ' +
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) +
        ' IST'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-tactical-950 border-b border-tactical-800 sticky top-0 z-40 px-4 py-2">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        {/* Brand & Authority Sub-label */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded bg-crimson-950/80 border border-crimson-600/80 shadow-sm flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-crimson-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-1.5">
                SAHAYAK <span className="text-[10px] px-1.5 py-0.5 rounded bg-crimson-950 text-crimson-400 border border-crimson-800 font-mono font-bold">PS 26001</span>
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-radar-950 text-radar-400 border border-radar-800 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ED25519 SECURED
              </span>
            </div>
            <p className="text-[11px] text-tactical-400 font-mono">
              Himalayan Decision-Support & Cryptographic Accountability Core
            </p>
          </div>
        </div>

        {/* Demo Preset Bar */}
        <DemoPresetSelector onSelectPreset={onSelectPreset} activePreset={activePreset} />

        {/* Navigation Tabs & Tool Triggers */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main View Tabs */}
          <div className="flex items-center p-0.5 bg-tactical-900 border border-tactical-800 rounded">
            <button
              onClick={() => setActiveTab('GIS')}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase rounded transition-all ${
                activeTab === 'GIS'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-tactical-300 hover:text-white hover:bg-tactical-800/60'
              }`}
            >
              GIS Ops
            </button>
            <button
              onClick={() => setActiveTab('INSAR')}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase rounded transition-all ${
                activeTab === 'INSAR'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-tactical-300 hover:text-white hover:bg-tactical-800/60'
              }`}
            >
              InSAR Satellite
            </button>
            <button
              onClick={() => setActiveTab('CONSEQUENCE')}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase rounded transition-all ${
                activeTab === 'CONSEQUENCE'
                  ? 'bg-crimson-600 text-white font-bold shadow-sm'
                  : 'text-tactical-300 hover:text-white hover:bg-tactical-800/60'
              }`}
            >
              Consequence
            </button>
            <button
              onClick={() => setActiveTab('LEDGER')}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase rounded transition-all flex items-center gap-1 ${
                activeTab === 'LEDGER'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-tactical-300 hover:text-white hover:bg-tactical-800/60'
              }`}
            >
              <Lock className="w-3 h-3 text-amber-400" />
              Ledger
            </button>
            <button
              onClick={() => setActiveTab('ANALYTICS')}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase rounded transition-all flex items-center gap-1 ${
                activeTab === 'ANALYTICS'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-tactical-300 hover:text-white hover:bg-tactical-800/60'
              }`}
            >
              <BarChart3 className="w-3 h-3 text-telemetry-400" />
              Analytics
            </button>
          </div>

          {/* Quick Modals */}
          <button
            onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
            className={`px-2.5 py-1.5 text-xs font-mono rounded border flex items-center gap-1.5 transition-all ${
              isMobileDrawerOpen
                ? 'bg-amber-600 border-amber-500 text-white shadow-md font-bold'
                : 'bg-tactical-900 border-tactical-700 text-tactical-200 hover:bg-tactical-800'
            }`}
            title="Toggle Field Officer / Citizen Mobile PWA Simulator"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline uppercase tracking-wider text-[11px]">Field App</span>
          </button>

          <button
            onClick={openBroadcastModal}
            className="px-2.5 py-1.5 text-xs font-mono bg-tactical-900 border border-tactical-700 hover:bg-tactical-800 text-tactical-200 rounded flex items-center gap-1.5 transition-all"
            title="Bhashini Multilingual Emergency Broadcast"
          >
            <Volume2 className="w-3.5 h-3.5 text-radar-400" />
            <span className="hidden sm:inline uppercase tracking-wider text-[11px]">Bhashini</span>
          </button>

          <button
            onClick={openSOPModal}
            className="px-2.5 py-1.5 text-xs font-mono bg-tactical-900 border border-tactical-700 hover:bg-tactical-800 text-tactical-200 rounded flex items-center gap-1.5 transition-all"
            title="NDMA / SDMA SOP Assistant (Vector RAG)"
          >
            <BookOpen className="w-3.5 h-3.5 text-telemetry-400" />
            <span className="hidden sm:inline uppercase tracking-wider text-[11px]">SOP RAG</span>
          </button>

          <button
            onClick={openProofModal}
            className="px-2.5 py-1.5 text-xs font-mono bg-tactical-900 border border-amber-800/80 hover:bg-tactical-800 text-amber-300 rounded flex items-center gap-1.5 transition-all"
            title="Scientific Rationale, Proofs & Disaster Autopsies"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span className="uppercase tracking-wider text-[11px] font-semibold">Proofs</span>
          </button>

          {/* Live Clock Badge */}
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-900 border border-tactical-800 text-[11px] font-mono text-tactical-300">
            <Clock className="w-3 h-3 text-telemetry-400" />
            <span>{timeStr}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
