import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Header/Navbar';
import { GISViewer } from './components/Map/GISViewer';
import { ConsequenceCard } from './components/Consequence/ConsequenceCard';
import { InSARDeformationViewer } from './components/InSAR/InSARDeformationViewer';
import { DecisionLedgerExplorer } from './components/Ledger/DecisionLedgerExplorer';
import { FieldAppSimulator } from './components/FieldApp/FieldAppSimulator';
import { AccountabilityDashboard } from './components/Analytics/AccountabilityDashboard';
import { BhashiniBroadcastModal } from './components/Bhashini/BhashiniBroadcastModal';
import { SOPAssistantModal } from './components/Bhashini/SOPAssistantModal';
import { ScientificProofModal } from './components/Docs/ScientificProofModal';
import { EventReplayModal } from './components/Replay/EventReplayModal';
import { api } from './services/api';
import { ConsequenceOutput, PersistentScattererPoint, TelemetryNode } from './types';
import { ShieldAlert, Activity, Lock, Smartphone, Layers, Radio, Sparkles, Volume2 } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GIS' | 'INSAR' | 'CONSEQUENCE' | 'LEDGER' | 'ANALYTICS'>('GIS');
  const [activePreset, setActivePreset] = useState<string>('DEMO_A');
  const [selectedLocation, setSelectedLocation] = useState<'NH10' | 'LHONAK' | 'GANGTOK' | 'WAYANAD'>('NH10');

  // Sliders for dynamic hazard simulation
  const [rainfall72h, setRainfall72h] = useState<number>(186.0);
  const [insarVelocity, setInsarVelocity] = useState<number>(12.4);

  // Data states
  const [consequence, setConsequence] = useState<ConsequenceOutput | null>(null);
  const [psPoints, setPsPoints] = useState<PersistentScattererPoint[]>([]);
  const [telemetryNodes, setTelemetryNodes] = useState<TelemetryNode[]>([]);

  // Modals & Drawers
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isSOPModalOpen, setIsSOPModalOpen] = useState(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [isReplayModalOpen, setIsReplayModalOpen] = useState(false);

  // Load Consequence Card dynamically
  useEffect(() => {
    async function loadConsequence() {
      const zone = selectedLocation === 'LHONAK' ? 'sikkim_north_lhonak' : (
        selectedLocation === 'WAYANAD' ? 'wayanad_chooralmala' : 'nh10_singtam_rangpo'
      );
      const data = await api.getConsequenceCard(zone, rainfall72h, 58.4, insarVelocity);
      setConsequence(data);
    }
    loadConsequence();
  }, [rainfall72h, insarVelocity, selectedLocation]);

  // Load GIS layers
  useEffect(() => {
    api.getPSPoints().then((pts) => setPsPoints(pts));
    api.getInfrastructureNetwork().then((net) => {
      if (net.sensor_nodes) setTelemetryNodes(net.sensor_nodes);
    });
  }, []);

  // Demo Preset Handlers
  function handleSelectPreset(presetId: 'DEMO_A' | 'DEMO_B' | 'DEMO_C' | 'REPLAY') {
    setActivePreset(presetId);

    if (presetId === 'DEMO_A') {
      // Demo A: Consequence on NH-10
      setSelectedLocation('NH10');
      setRainfall72h(186.0);
      setInsarVelocity(12.4);
      setActiveTab('GIS');
    } else if (presetId === 'DEMO_B') {
      // Demo B: Decision Chain & Mobile Field App
      setIsMobileDrawerOpen(true);
      setActiveTab('LEDGER');
    } else if (presetId === 'DEMO_C') {
      // Demo C: InSAR Revelation over South Lhonak
      setSelectedLocation('LHONAK');
      setActiveTab('INSAR');
    } else if (presetId === 'REPLAY') {
      // Sikkim GLOF Timeline Replay
      setIsReplayModalOpen(true);
    }
  }

  // Trigger Action / Evacuation Workflow from Card
  async function handleTriggerDecisionWorkflow() {
    if (!consequence) return;
    // Simulate Collector Signing
    const res = await api.submitCollectorDecision({
      alert_id: consequence.alert_id,
      collector_id: 'DC-EAST-SIKKIM-01',
      collector_name: 'District Magistrate / Collector Gangtok',
      decision: 'EVACUATE',
      reasoning_notes: 'Critical 87% landslide probability on NH-10 corridor confirmed by field officer report. Ordering immediate pre-emptive evacuation of Ranipool & Majitar.',
      evacuate_villages: ['Ranipool', 'Majitar'],
      trigger_multilingual_broadcast: true,
      dispatch_ndrf: true,
      close_nh10_segment: true
    });

    setIsBroadcastModalOpen(true);
    setActiveTab('LEDGER');
  }

  return (
    <div className="min-h-screen bg-tactical-950 text-slate-100 flex flex-col font-sans">
      {/* Command Center Navbar */}
      <Navbar
        onSelectPreset={handleSelectPreset}
        activePreset={activePreset}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileDrawerOpen={isMobileDrawerOpen}
        setIsMobileDrawerOpen={setIsMobileDrawerOpen}
        openBroadcastModal={() => setIsBroadcastModalOpen(true)}
        openSOPModal={() => setIsSOPModalOpen(true)}
        openProofModal={() => setIsProofModalOpen(true)}
        openReplayModal={() => setIsReplayModalOpen(true)}
      />

      {/* Main Dashboard Workspace */}
      <main className="flex-1 p-4 flex flex-col gap-4 max-w-[1780px] w-full mx-auto">
        {/* VIEW 1: GIS COMMAND CENTER (SPLIT MAP + CONSEQUENCE) */}
        {activeTab === 'GIS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
            {/* Left Col: Interactive Geospatial GIS Viewer */}
            <div className="lg:col-span-7 flex flex-col min-h-[620px]">
              <GISViewer
                psPoints={psPoints}
                telemetryNodes={telemetryNodes}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
                landslideProb={consequence?.landslide_probability || 0.87}
              />
            </div>

            {/* Right Col: Consequence Output Card & Live Simulator */}
            <div className="lg:col-span-5 flex flex-col">
              <ConsequenceCard
                consequence={consequence}
                rainfall72h={rainfall72h}
                setRainfall72h={setRainfall72h}
                insarVelocity={insarVelocity}
                setInsarVelocity={setInsarVelocity}
                onTriggerDecision={handleTriggerDecisionWorkflow}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: INSAR SATELLITE VIEWER */}
        {activeTab === 'INSAR' && (
          <div className="space-y-4">
            <InSARDeformationViewer
              initialZone={selectedLocation === 'LHONAK' ? 'south_lhonak' : 'nh10_singtam_rangpo'}
            />
          </div>
        )}

        {/* VIEW 3: FULL CONSEQUENCE CARD ONLY */}
        {activeTab === 'CONSEQUENCE' && (
          <div className="max-w-4xl mx-auto w-full">
            <ConsequenceCard
              consequence={consequence}
              rainfall72h={rainfall72h}
              setRainfall72h={setRainfall72h}
              insarVelocity={insarVelocity}
              setInsarVelocity={setInsarVelocity}
              onTriggerDecision={handleTriggerDecisionWorkflow}
            />
          </div>
        )}

        {/* VIEW 4: BLOCKCHAIN DECISION LEDGER EXPLORER */}
        {activeTab === 'LEDGER' && (
          <div className="space-y-4">
            <DecisionLedgerExplorer />
          </div>
        )}

        {/* VIEW 5: DISTRICT COLLECTOR ACCOUNTABILITY DASHBOARD */}
        {activeTab === 'ANALYTICS' && (
          <div className="space-y-4">
            <AccountabilityDashboard />
          </div>
        )}
      </main>

      {/* Floating Field App Drawer (Right side) */}
      {isMobileDrawerOpen && (
        <aside className="fixed bottom-4 right-4 z-40 max-w-sm w-full bg-tactical-950 border border-tactical-700 rounded-3xl shadow-2xl p-2 animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between px-3 py-1 mb-1">
            <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" />
              FIELD DEVICE SIMULATOR
            </span>
            <button
              onClick={() => setIsMobileDrawerOpen(false)}
              className="text-xs text-tactical-400 hover:text-white px-2 py-0.5"
            >
              ✕ Minimize
            </button>
          </div>
          <FieldAppSimulator
            onReportSubmitted={() => {
              // Switch to ledger if open
            }}
          />
        </aside>
      )}

      {/* Modals */}
      <BhashiniBroadcastModal
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
      />

      <SOPAssistantModal
        isOpen={isSOPModalOpen}
        onClose={() => setIsSOPModalOpen(false)}
      />

      <ScientificProofModal
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
      />

      <EventReplayModal
        isOpen={isReplayModalOpen}
        onClose={() => setIsReplayModalOpen(false)}
      />

      {/* Footer Status Bar */}
      <footer className="bg-tactical-950 border-t border-tactical-800 px-4 py-2 font-mono text-[11px] text-tactical-400 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-radar-400">
            <span className="w-2 h-2 rounded-full bg-radar-400 animate-ping" />
            NODE: GANGTOK-HQ-01
          </span>
          <span>•</span>
          <span>SENTINEL-1 C-SAR ORBIT: DESCENDING (IW)</span>
          <span>•</span>
          <span>CONSENSUS: PoA PERMISSIONED LEDGER (4 NODES)</span>
        </div>

        <div className="flex items-center gap-2">
          <span>SMART INDIA HACKATHON 2026</span>
          <span>•</span>
          <span className="text-amber-400 font-semibold">PS 26001: SAHAYAK</span>
        </div>
      </footer>
    </div>
  );
};
