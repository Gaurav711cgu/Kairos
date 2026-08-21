import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Wifi,
  WifiOff,
  Mic,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  Sparkles,
  MapPin,
  Clock,
  Shield,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api';

interface FieldAppSimulatorProps {
  onReportSubmitted?: () => void;
}

export const FieldAppSimulator: React.FC<FieldAppSimulatorProps> = ({ onReportSubmitted }) => {
  const [appMode, setAppMode] = useState<'OFFICER' | 'CITIZEN'>('OFFICER');
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  // Officer 3-Tap State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedObservation, setSelectedObservation] = useState<string>('Cracks');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('Extreme');
  const [officerNotes, setOfficerNotes] = useState('Visible tension cracks widening along NH-10 slope near chainage 142+300. Water seepage actively bubbling.');
  const [voiceDictation, setVoiceDictation] = useState('NH-10 near Rangpo completely blocked, large debris, water seepage bubbling, no injuries visible.');
  const [isDictating, setIsDictating] = useState(false);
  const [nlpEntities, setNlpEntities] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Citizen Mode State
  const [citizenReportType, setCitizenReportType] = useState<string | null>(null);
  const [citizenDetails, setCitizenDetails] = useState('Small mudslide sliding onto lower road near Singtam Bazaar bridge.');

  const observations = [
    { label: 'Cracks', icon: '⚡' },
    { label: 'Water seepage', icon: '💧' },
    { label: 'Road unstable', icon: '⚠️' },
    { label: 'Debris visible', icon: '🪨' },
    { label: 'Road blocked', icon: '🛑' },
    { label: 'All clear', icon: '✅' }
  ];

  const severities = [
    { label: 'Minor', color: 'border-tactical-600 text-tactical-300' },
    { label: 'Significant', color: 'border-amber-500 text-amber-400 bg-amber-950/40' },
    { label: 'Extreme', color: 'border-crimson-500 text-crimson-400 bg-crimson-950/60 font-bold' }
  ];

  async function handleVoiceDictateNLP() {
    setIsDictating(true);
    try {
      const res = await api.parseVoice(voiceDictation);
      setNlpEntities(res.extracted_entities);
    } catch (e) {
      console.warn(e);
    }
    setIsDictating(false);
  }

  async function handleOfficerSubmit() {
    setSubmitting(true);
    const payload = {
      alert_id: 'ALT-2026-0814-01',
      officer_id: 'OFFICER-SK-042',
      officer_name: 'Sub-Inspector T. Norbu',
      lat: 27.2345,
      lng: 88.5120,
      observation: selectedObservation,
      severity: selectedSeverity,
      verification_status: 'CONFIRMED',
      notes: officerNotes,
      voice_transcript: voiceDictation,
      structured_nlp_entities: nlpEntities,
      photo_url: '/assets/evidence/crack_slope_sample.jpg',
      offline_cached_at: isOnline ? undefined : new Date().toISOString()
    };

    if (!isOnline) {
      // Queue locally in offline storage
      const updated = [...offlineQueue, payload];
      setOfflineQueue(updated);
      setSubmitSuccess('Offline: Report queued in local encrypted storage. Will sync when online.');
    } else {
      try {
        await api.submitFieldReport(payload);
        setSubmitSuccess('Success: Verification cryptographically recorded onto Blockchain Ledger!');
        if (onReportSubmitted) onReportSubmitted();
      } catch (e) {
        setSubmitSuccess('Error submitting report to backend.');
      }
    }

    setSubmitting(false);
    setTimeout(() => {
      setSubmitSuccess(null);
      setStep(1);
    }, 4000);
  }

  async function syncOfflineReports() {
    if (offlineQueue.length === 0) return;
    setSubmitting(true);
    for (const item of offlineQueue) {
      await api.submitFieldReport(item);
    }
    setOfflineQueue([]);
    setSubmitting(false);
    setSubmitSuccess(`Synced ${offlineQueue.length} offline reports to blockchain ledger!`);
    if (onReportSubmitted) onReportSubmitted();
    setTimeout(() => setSubmitSuccess(null), 3000);
  }

  async function handleCitizenSubmit() {
    if (!citizenReportType) return;
    setSubmitting(true);
    await api.submitCitizenReport({
      citizen_name: 'Pemba Lepcha',
      phone: '+91 98765 43210',
      report_type: citizenReportType,
      lat: 27.2380,
      lng: 88.5145,
      location_desc: 'Near Singtam Bazaar lower bridge',
      details: citizenDetails
    });
    setSubmitting(false);
    setSubmitSuccess('Citizen SOS report received and clustered for field verification!');
    setTimeout(() => {
      setSubmitSuccess(null);
      setCitizenReportType(null);
    }, 3000);
  }

  return (
    <div className="w-full max-w-sm mx-auto bg-tactical-950 border-4 border-tactical-700 rounded-[36px] overflow-hidden shadow-2xl p-2.5 flex flex-col font-mono text-xs">
      {/* Smartphone Notch & Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 text-[10px] text-tactical-400 border-b border-tactical-800/80">
        <span className="font-bold text-white">03:47 IST</span>
        <div className="w-16 h-3.5 bg-tactical-800 rounded-full mx-auto" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              const next = !isOnline;
              setIsOnline(next);
              if (next && offlineQueue.length > 0) syncOfflineReports();
            }}
            className="cursor-pointer text-tactical-300 hover:text-white"
            title="Toggle Online/Offline connectivity to test offline queue"
          >
            {isOnline ? (
              <span className="flex items-center text-radar-400 gap-0.5">
                <Wifi className="w-3 h-3" />
                <span>4G</span>
              </span>
            ) : (
              <span className="flex items-center text-amber-400 gap-0.5">
                <WifiOff className="w-3 h-3" />
                <span>OFFLINE</span>
              </span>
            )}
          </button>
          <span>98%</span>
        </div>
      </div>

      {/* App Header & Mode Switcher */}
      <div className="p-3 bg-tactical-900 border-b border-tactical-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white tracking-wide">SAHAYAK FIELD PWA</span>
          </div>

          <div className="flex items-center gap-1 bg-tactical-950 p-0.5 rounded border border-tactical-700">
            <button
              onClick={() => setAppMode('OFFICER')}
              className={`px-2 py-0.5 text-[10px] rounded ${
                appMode === 'OFFICER' ? 'bg-amber-600 text-white font-bold' : 'text-tactical-400'
              }`}
            >
              Officer
            </button>
            <button
              onClick={() => setAppMode('CITIZEN')}
              className={`px-2 py-0.5 text-[10px] rounded ${
                appMode === 'CITIZEN' ? 'bg-radar-600 text-white font-bold' : 'text-tactical-400'
              }`}
            >
              Citizen
            </button>
          </div>
        </div>

        {!isOnline && (
          <div className="mt-2 p-1.5 bg-amber-950/60 border border-amber-700/80 rounded text-[10px] text-amber-300 flex items-center justify-between">
            <span>OFFLINE SENSING MODE ACTIVE</span>
            <span>Queued: {offlineQueue.length}</span>
          </div>
        )}
      </div>

      {/* App Body */}
      <div className="p-3.5 flex-1 min-h-[460px] overflow-y-auto space-y-3.5 bg-tactical-950">
        {submitSuccess && (
          <div className="p-3 bg-radar-950 border border-radar-600 rounded-lg text-radar-300 text-[11px] animate-pulse">
            {submitSuccess}
          </div>
        )}

        {appMode === 'OFFICER' ? (
          /* OFFICER MODE */
          <div className="space-y-3">
            {/* Active Alerts in Zone */}
            <div className="bg-tactical-900 p-2.5 rounded-lg border border-tactical-800">
              <div className="text-[10px] text-tactical-400 font-semibold mb-1">ASSIGNED ZONE ALERTS</div>
              <div className="space-y-1.5">
                <div className="p-2 bg-crimson-950/70 border border-crimson-600/80 rounded text-crimson-300 flex items-center justify-between">
                  <div>
                    <div className="font-bold">🔴 CRITICAL — NH-10 Area</div>
                    <div className="text-[10px] text-crimson-400/90">Chainage 142+300 Cut Slope</div>
                  </div>
                  <span className="text-[10px] bg-crimson-900 px-1.5 py-0.5 rounded">VERIFY NOW</span>
                </div>
              </div>
            </div>

            {/* 3-Tap Quick Report Card */}
            <div className="bg-tactical-900 p-3 rounded-lg border border-tactical-700">
              <div className="flex items-center justify-between pb-2 border-b border-tactical-800 text-[11px]">
                <span className="font-bold text-amber-400">3-TAP SENSING REPORT</span>
                <span className="text-tactical-400">Step {step} of 3</span>
              </div>

              {/* Step 1: What do you see? */}
              {step === 1 && (
                <div className="pt-2 space-y-2">
                  <div className="text-[11px] text-slate-300 font-semibold">Step 1: What do you see?</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {observations.map((obs) => (
                      <button
                        key={obs.label}
                        onClick={() => setSelectedObservation(obs.label)}
                        className={`p-2 rounded border text-left flex items-center gap-1.5 transition-all ${
                          selectedObservation === obs.label
                            ? 'bg-amber-600/30 border-amber-500 text-white font-bold'
                            : 'bg-tactical-950 border-tactical-800 text-tactical-300 hover:border-tactical-700'
                        }`}
                      >
                        <span>{obs.icon}</span>
                        <span className="text-[11px]">{obs.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setStep(2)}
                    className="w-full mt-2 py-2 bg-tactical-800 hover:bg-tactical-700 text-white font-bold rounded flex items-center justify-center gap-1.5"
                  >
                    <span>Next: Severity</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Step 2: Severity */}
              {step === 2 && (
                <div className="pt-2 space-y-2">
                  <div className="text-[11px] text-slate-300 font-semibold">Step 2: How severe?</div>
                  <div className="space-y-1.5">
                    {severities.map((sev) => (
                      <button
                        key={sev.label}
                        onClick={() => setSelectedSeverity(sev.label)}
                        className={`w-full p-2 rounded border text-left flex items-center justify-between transition-all ${
                          selectedSeverity === sev.label
                            ? 'border-crimson-500 bg-crimson-950/80 text-white font-bold shadow-md'
                            : 'bg-tactical-950 border-tactical-800 text-tactical-300'
                        }`}
                      >
                        <span>{sev.label}</span>
                        {selectedSeverity === sev.label && <CheckCircle2 className="w-3.5 h-3.5 text-crimson-400" />}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setStep(1)}
                      className="px-3 py-2 bg-tactical-800 text-tactical-300 rounded"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="flex-1 py-2 bg-amber-600 text-white font-bold rounded flex items-center justify-center gap-1.5"
                    >
                      <span>Next: Submit</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Voice / Photo Evidence */}
              {step === 3 && (
                <div className="pt-2 space-y-2.5">
                  <div className="text-[11px] text-slate-300 font-semibold">Step 3: Confirm & Submit</div>
                  
                  <div className="p-2 bg-tactical-950 rounded border border-tactical-800 space-y-1 text-[11px]">
                    <div>Observation: <strong className="text-white">{selectedObservation}</strong></div>
                    <div>Severity: <strong className="text-crimson-400">{selectedSeverity}</strong></div>
                    <div className="text-[10px] text-tactical-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-radar-400" />
                      GPS: 27.2345°N, 88.5120°E (Locked)
                    </div>
                  </div>

                  {/* Bhashini Voice Dictation */}
                  <div className="p-2 bg-tactical-950 rounded border border-tactical-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-radar-400 flex items-center gap-1">
                        <Mic className="w-3 h-3 text-radar-400" />
                        Bhashini Voice Dictation:
                      </span>
                      <button
                        onClick={handleVoiceDictateNLP}
                        disabled={isDictating}
                        className="text-amber-400 hover:underline flex items-center gap-0.5"
                      >
                        <Sparkles className="w-3 h-3" />
                        Extract NLP
                      </button>
                    </div>

                    <textarea
                      value={voiceDictation}
                      onChange={(e) => setVoiceDictation(e.target.value)}
                      rows={2}
                      className="w-full p-1.5 bg-tactical-900 border border-tactical-700 rounded text-slate-200 text-[10px] focus:outline-none"
                    />

                    {nlpEntities && (
                      <div className="p-1.5 bg-radar-950/60 border border-radar-700 rounded text-[10px] text-radar-300">
                        <div>Extracted: <strong className="text-white">{nlpEntities.location}</strong></div>
                        <div>Status: {nlpEntities.event_type} • {nlpEntities.injury_status}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(2)}
                      className="px-3 py-2 bg-tactical-800 text-tactical-300 rounded"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleOfficerSubmit}
                      disabled={submitting}
                      className="flex-1 py-2 bg-crimson-600 hover:bg-crimson-500 text-white font-bold rounded flex items-center justify-center gap-1.5 shadow-lg glow-crimson"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isOnline ? 'Sign & Record to Chain' : 'Queue Offline'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* CITIZEN MODE */
          <div className="space-y-3">
            <div className="text-[11px] text-tactical-300 font-semibold text-center mb-2">
              EMERGENCY COMMUNITY CITIZEN REPORT
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setCitizenReportType('I SEE SOMETHING WRONG')}
                className={`w-full p-3.5 rounded-xl border text-left font-bold flex items-center gap-2.5 transition-all ${
                  citizenReportType === 'I SEE SOMETHING WRONG'
                    ? 'bg-amber-600 border-amber-400 text-white shadow-md'
                    : 'bg-tactical-900 border-tactical-700 text-tactical-200 hover:bg-tactical-800'
                }`}
              >
                <span className="text-xl">⚠️</span>
                <div>
                  <div>I SEE SOMETHING WRONG</div>
                  <div className="text-[10px] font-normal opacity-80">Mud sliding, cracks in ground, strange water flow</div>
                </div>
              </button>

              <button
                onClick={() => setCitizenReportType('ROAD IS BLOCKED')}
                className={`w-full p-3.5 rounded-xl border text-left font-bold flex items-center gap-2.5 transition-all ${
                  citizenReportType === 'ROAD IS BLOCKED'
                    ? 'bg-crimson-600 border-crimson-400 text-white shadow-md'
                    : 'bg-tactical-900 border-tactical-700 text-tactical-200 hover:bg-tactical-800'
                }`}
              >
                <span className="text-xl">🛑</span>
                <div>
                  <div>ROAD IS BLOCKED</div>
                  <div className="text-[10px] font-normal opacity-80">Debris on highway, vehicles unable to pass</div>
                </div>
              </button>

              <button
                onClick={() => setCitizenReportType('WE NEED HELP')}
                className={`w-full p-3.5 rounded-xl border text-left font-bold flex items-center gap-2.5 transition-all ${
                  citizenReportType === 'WE NEED HELP'
                    ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                    : 'bg-tactical-900 border-tactical-700 text-tactical-200 hover:bg-tactical-800'
                }`}
              >
                <span className="text-xl">🆘</span>
                <div>
                  <div>WE NEED HELP</div>
                  <div className="text-[10px] font-normal opacity-80">House in danger, evacuation assistance requested</div>
                </div>
              </button>
            </div>

            {citizenReportType && (
              <div className="p-3 bg-tactical-900 rounded-lg border border-tactical-700 space-y-2 mt-3">
                <div className="text-[11px] font-semibold text-slate-200">Describe what you see:</div>
                <textarea
                  value={citizenDetails}
                  onChange={(e) => setCitizenDetails(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-tactical-950 border border-tactical-800 rounded text-slate-200 text-xs focus:outline-none"
                />
                <button
                  onClick={handleCitizenSubmit}
                  disabled={submitting}
                  className="w-full py-2 bg-radar-600 hover:bg-radar-500 text-white font-bold rounded flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send SOS with GPS</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Smartphone Bottom Home Bar */}
      <div className="py-2 flex justify-center border-t border-tactical-800">
        <div className="w-28 h-1 bg-tactical-600 rounded-full" />
      </div>
    </div>
  );
};
