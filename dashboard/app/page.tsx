"use client";

import { useEffect, useRef } from 'react';
import { animate, stagger, set } from 'animejs';
import dynamic from 'next/dynamic';
import AuditTimeline from './components/AuditTimeline';
import AgentRcaPanel from './components/AgentRcaPanel';
import { Cpu, TerminalSquare, Activity, Server } from 'lucide-react';

// Dynamically import Three.js scene to avoid SSR issues
const ThreeScene = dynamic(() => import('./components/ThreeScene'), { ssr: false });

export default function Dashboard() {
  const headerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (headerRef.current) {
      set(headerRef.current, { translateY: -60, opacity: 0 });
      animate(headerRef.current, {
        translateY: 0,
        opacity: 1,
        ease: 'spring(1, 80, 10, 0)',
        duration: 1000,
        delay: 100
      });
    }
    if (leftColRef.current) {
      const cards = leftColRef.current.querySelectorAll('.context-card');
      set(cards, { translateX: -40, opacity: 0 });
      animate(cards, {
        translateX: 0,
        opacity: 1,
        ease: 'spring(1, 80, 10, 0)',
        duration: 1000,
        delay: stagger(150, { start: 300 })
      });
    }
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col p-5 overflow-hidden">
      {/* 3D Background — vector clock orb network */}
      <ThreeScene />

      {/* Foreground */}
      <div className="relative z-10 flex flex-col h-full max-w-[1700px] mx-auto w-full flex-1 gap-5">

        {/* ── Header ── */}
        <header ref={headerRef}
          className="flex justify-between items-center px-5 py-3 rounded-2xl border border-agentic-border"
          style={{ background: 'rgba(10,10,12,0.7)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-agentic-cyan border"
              style={{ background: 'rgba(0,240,255,0.08)', borderColor: 'rgba(0,240,255,0.2)', boxShadow: '0 0 12px rgba(0,240,255,0.15)' }}>
              <Cpu className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-widest text-agentic-text">
                KAIROS<span className="text-agentic-cyan">.AUDITOR</span>
              </h1>
              <p className="text-[10px] text-agentic-dim uppercase tracking-[0.25em] font-mono leading-none">
                Agentic Actions &amp; Vector Clock Replay
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-agentic-dim">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-agentic-cyan" /> 5 events
              </span>
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-agentic-purple" /> 3 services
              </span>
            </div>
            <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-lg border border-agentic-border">
              <span className="w-2 h-2 rounded-full bg-agentic-cyan"
                style={{ boxShadow: '0 0 8px rgba(0,240,255,0.9)', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
              <span className="text-xs font-mono text-agentic-dim">SYS.ONLINE</span>
            </div>
          </div>
        </header>

        {/* ── Main Grid ── */}
        <div className="flex-1 flex gap-5 min-h-0" style={{ height: 'calc(100vh - 100px)' }}>

          {/* Left: Context & Logs */}
          <div ref={leftColRef} className="w-64 shrink-0 flex flex-col gap-4">

            {/* Trace context card */}
            <div className="context-card glass-panel p-4">
              <div className="flex items-center gap-2 mb-4 text-agentic-dim">
                <TerminalSquare className="w-3.5 h-3.5" />
                <h3 className="text-xs font-mono uppercase tracking-[0.15em]">Trace Context</h3>
              </div>
              <div className="space-y-3 font-mono text-xs">
                {[
                  { label: 'Trace ID', value: 'tr_8f92a1', color: 'text-agentic-cyan' },
                  { label: 'Session', value: 'ses_001', color: 'text-agentic-text' },
                  { label: 'Env', value: 'production', color: 'text-agentic-text' },
                  { label: 'Racing', value: 'detected ⚠', color: 'text-red-400' },
                  { label: 'Latency P99', value: '120ms', color: 'text-agentic-text' },
                  { label: 'Anomaly Score', value: '-0.42', color: 'text-agentic-purple' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-baseline gap-2">
                    <span className="text-agentic-dim shrink-0">{label}</span>
                    <span className={`${color} truncate text-right`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Orchestrator log card */}
            <div className="context-card glass-panel p-4 flex-1 overflow-hidden"
              style={{ background: 'linear-gradient(to bottom, rgba(15,15,17,0.8), rgba(176,38,255,0.03))' }}>
              <h3 className="text-xs font-mono uppercase tracking-[0.15em] text-agentic-dim mb-4">Orchestrator Log</h3>
              <div className="text-[11px] font-mono space-y-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
                {[
                  { t: '00:00:00', msg: '> Session ses_001 initialized', c: 'text-agentic-dim' },
                  { t: '00:00:01', msg: '> Replaying 5 causal events...', c: 'text-agentic-dim' },
                  { t: '00:00:01', msg: '> Vector clocks converging...', c: 'text-agentic-dim' },
                  { t: '00:00:02', msg: '> DIVERGENCE at causal pos 0', c: 'text-red-400' },
                  { t: '00:00:02', msg: '> DB state: stock went to -1', c: 'text-red-400' },
                  { t: '00:00:03', msg: '> Triggering LLM Analyzer...', c: 'text-agentic-cyan' },
                  { t: '00:00:05', msg: '> RCA complete. Confidence 95%', c: 'text-green-400' },
                ].map(({ t, msg, c }, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-agentic-border shrink-0">{t}</span>
                    <span className={c}>{msg}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Middle: Causal Audit Timeline */}
          <div className="flex-1 min-w-0">
            <AuditTimeline />
          </div>

          {/* Right: AI Agent RCA */}
          <div className="w-72 shrink-0">
            <AgentRcaPanel />
          </div>

        </div>
      </div>
    </div>
  );
}
