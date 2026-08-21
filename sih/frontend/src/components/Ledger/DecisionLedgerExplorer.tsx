import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Layers,
  FileCheck,
  Zap,
  Flame,
  ArrowDown,
  Key,
  RotateCcw,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../../services/api';
import { BlockRecord, LedgerVerificationResult } from '../../types';

export const DecisionLedgerExplorer: React.FC = () => {
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [verificationResult, setVerificationResult] = useState<LedgerVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tamperSuccessMsg, setTamperSuccessMsg] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  async function loadChain() {
    setLoading(true);
    const chain = await api.getLedgerChain();
    setBlocks(chain);
    const vRes = await api.verifyLedger();
    setVerificationResult(vRes);
    setLoading(false);
  }

  useEffect(() => {
    loadChain();
  }, []);

  async function handleVerifyLedger() {
    setLoading(true);
    const vRes = await api.verifyLedger();
    setVerificationResult(vRes);
    setLoading(false);
  }

  async function handleTamperDemo() {
    // Deliberately alter Block 1 to show detection
    await api.tamperTest(1, 'hazard_level', 'ALTERED_TO_SAFE_AFTER_DISASTER');
    setTamperSuccessMsg('Deliberate payload modification injected into Block #1. Notice hash mismatch and broken Ed25519 signature.');
    await loadChain();
  }

  async function handleRestoreLegitimate() {
    await api.tamperTest(1, 'hazard_level', 'CRITICAL');
    setTamperSuccessMsg(null);
    await loadChain();
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="bg-tactical-950 border border-tactical-800 rounded-lg p-5 shadow-2xl flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-tactical-800 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold font-mono text-white uppercase tracking-wider">
              [ SECTION 04 // DECISION CHAIN-OF-CUSTODY (ED25519 + SHA-256) ]
            </h2>
          </div>
          <p className="text-xs text-tactical-400 font-mono mt-0.5">
            Permissioned Proof-of-Authority (PoA) Consortium Ledger • Section 30 Disaster Management Act Compliance
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleVerifyLedger}
            disabled={loading}
            className="px-3 py-1.5 bg-tactical-900 hover:bg-tactical-800 text-radar-400 border border-radar-800 rounded font-mono text-xs tracking-wider uppercase flex items-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Ledger Integrity</span>
          </button>

          {verificationResult && !verificationResult.is_valid ? (
            <button
              onClick={handleRestoreLegitimate}
              className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded font-mono text-xs tracking-wider uppercase flex items-center gap-1.5 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Valid State</span>
            </button>
          ) : (
            <button
              onClick={handleTamperDemo}
              className="px-3 py-1.5 bg-crimson-950 hover:bg-crimson-900 text-crimson-300 border border-crimson-700/80 rounded font-mono text-xs tracking-wider uppercase flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
              title="Inject Tampering to prove Blockchain Detection"
            >
              <Flame className="w-4 h-4 text-crimson-400" />
              <span>Simulate Tamper Test</span>
            </button>
          )}
        </div>
      </div>

      {/* Verification Status Banner */}
      {verificationResult && (
        <div
          className={`p-3 rounded border font-mono text-xs flex items-center justify-between ${
            verificationResult.is_valid
              ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
              : 'bg-crimson-950/60 border-crimson-600 text-crimson-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {verificationResult.is_valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-crimson-400 flex-shrink-0 animate-bounce" />
            )}
            <div>
              <span className="font-bold">
                {verificationResult.is_valid
                  ? 'LEDGER VERIFIED: 100% SHA-256 HASH CHAINS & ED25519 SIGNATURES VALID'
                  : 'CRYPTOGRAPHIC TAMPER DETECTED! NON-REPUDIATION VIOLATION IDENTIFIED'}
              </span>
              {verificationResult.error_reason && (
                <div className="text-[11px] text-crimson-200 mt-0.5 font-sans">
                  {verificationResult.error_reason}
                </div>
              )}
            </div>
          </div>
          <div className="text-right text-[11px] font-mono opacity-80 hidden sm:block">
            <span>CHAIN HEIGHT: #{blocks.length - 1}</span>
          </div>
        </div>
      )}

      {/* Tamper Success Alert Message */}
      {tamperSuccessMsg && (
        <div className="p-2.5 bg-amber-950/40 border border-amber-800 rounded font-mono text-xs text-amber-300 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{tamperSuccessMsg}</span>
        </div>
      )}

      {/* Interactive Blockchain Explorer Feed */}
      <div className="space-y-3 mt-1">
        {blocks.map((block, idx) => {
          const isTampered = verificationResult && !verificationResult.is_valid && verificationResult.tampered_block_index === block.index;

          return (
            <div
              key={block.index}
              className={`p-4 rounded border transition-all ${
                isTampered
                  ? 'bg-crimson-950/40 border-crimson-500 border-l-4 border-l-crimson-500'
                  : 'bg-tactical-900/90 border-tactical-800 border-l-4 border-l-slate-700'
              }`}
            >
              {/* Block Header */}
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-tactical-800 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-tactical-950 border border-tactical-700 text-amber-400 font-mono font-bold text-xs rounded">
                    BLOCK #{block.index}
                  </span>
                  <span className="font-mono text-xs text-white font-semibold">
                    {block.workflow_state}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono text-tactical-400">
                  <span>ALERT: <strong className="text-white">{block.alert_id}</strong></span>
                  <span>|</span>
                  <span>{block.timestamp}</span>
                </div>
              </div>

              {/* Signer & Cryptographic Keys */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono mb-3 bg-tactical-950 p-2.5 rounded border border-tactical-800">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-tactical-500 uppercase tracking-wider text-[10px]">Signer Role:</span>
                  <span className="text-radar-400 font-bold">{block.signer_role}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-tactical-500 uppercase tracking-wider text-[10px]">Authority ID:</span>
                  <span className="text-white">{block.signer_id}</span>
                </div>
              </div>

              {/* Payload Data Breakdown */}
              <div className="bg-tactical-950 p-3 rounded border border-tactical-800 font-mono text-xs text-slate-200 mb-3 space-y-1 overflow-x-auto">
                <div className="text-[10px] text-tactical-500 uppercase tracking-widest mb-1.5">Action Payload:</div>
                {Object.entries(block.action_payload).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <span className="text-amber-400 font-semibold w-48 flex-shrink-0">{k}:</span>
                    <span className="text-slate-300 break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))}
              </div>

              {/* Cryptographic Hash Bar */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 pt-2 border-t border-tactical-800 text-[11px] font-mono text-tactical-400">
                <div className="flex items-center justify-between bg-tactical-950 p-1.5 px-2.5 rounded border border-tactical-800">
                  <span className="text-tactical-500 uppercase text-[10px]">Prev Hash:</span>
                  <span className="truncate max-w-[200px] text-slate-400">{block.previous_hash}</span>
                  <button onClick={() => handleCopy(block.previous_hash)} className="text-tactical-500 hover:text-white ml-1">
                    {copiedHash === block.previous_hash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-tactical-950 p-1.5 px-2.5 rounded border border-tactical-800">
                  <span className="text-tactical-500 uppercase text-[10px]">Block Hash:</span>
                  <span className="truncate max-w-[200px] text-amber-300 font-bold">{block.block_hash}</span>
                  <button onClick={() => handleCopy(block.block_hash)} className="text-tactical-500 hover:text-white ml-1">
                    {copiedHash === block.block_hash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
