"use client";

import { useEffect, useRef } from 'react';
import { animate, set, stagger } from 'animejs';
import { Bot, Zap, CheckCircle2, Code2, ChevronRight } from 'lucide-react';

export default function AgentRcaPanel() {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelRef.current) {
      // Magic Animator-inspired elastic entrance
      set(panelRef.current, { scale: 0.88, opacity: 0, translateY: 40 });

      animate(panelRef.current, {
        scale: 1,
        opacity: 1,
        translateY: 0,
        ease: 'spring(1, 80, 12, 0)',
        duration: 1600,
        delay: 900
      });

      const sections = panelRef.current.querySelectorAll('.rca-section');
      set(sections, { opacity: 0, translateX: 24 });

      animate(sections, {
        opacity: 1,
        translateX: 0,
        ease: 'easeOutExpo',
        duration: 700,
        delay: stagger(130, { start: 1400 })
      });
    }
  }, []);

  return (
    <div ref={panelRef}
      className="glass-panel flex-1 flex flex-col h-full overflow-hidden"
      style={{ borderColor: 'rgba(176, 38, 255, 0.25)', boxShadow: '0 0 50px rgba(176,38,255,0.04)' }}
    >
      {/* Header */}
      <div className="p-5 border-b border-agentic-border flex items-center gap-3"
        style={{ background: 'linear-gradient(to right, rgba(176,38,255,0.08), transparent)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-agentic-purple border"
          style={{ background: 'rgba(176,38,255,0.12)', borderColor: 'rgba(176,38,255,0.3)' }}>
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-wide">LLM Agent RCA</h2>
          <p className="text-xs text-agentic-dim">
            Confidence: <span className="text-agentic-cyan">95%</span>
            {' · '}
            Model: <span className="text-agentic-text">gemini-2.5-flash</span>
          </p>
        </div>
        <div className="ml-auto px-2.5 py-1 rounded-full text-xs font-mono flex items-center gap-1.5"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgb(248,113,113)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          CRITICAL
        </div>
      </div>

      <div className="p-5 flex-1 overflow-y-auto space-y-6">

        {/* Root Cause */}
        <div className="rca-section">
          <h3 className="text-xs uppercase tracking-widest text-agentic-dim mb-3 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-agentic-purple" />
            Root Cause Pattern
          </h3>
          <div className="p-4 rounded-xl bg-black/40 border border-agentic-border">
            <div className="text-agentic-cyan font-mono text-base mb-2 font-semibold">
              TOCTOU_RACE_CONDITION
            </div>
            <p className="text-agentic-dim text-sm leading-relaxed">
              Two concurrent reads of inventory both saw{' '}
              <code className="text-agentic-text bg-black/50 px-1 rounded">stock=1</code>.
              Both proceeded. Both decremented. Stock went to{' '}
              <code className="text-red-400 bg-black/50 px-1 rounded">-1</code>.
            </p>
          </div>
        </div>

        {/* Affected Services */}
        <div className="rca-section">
          <h3 className="text-xs uppercase tracking-widest text-agentic-dim mb-3">
            Affected Services
          </h3>
          <div className="flex gap-2 flex-wrap">
            {['order-service', 'inventory-service'].map(svc => (
              <div key={svc}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border"
                style={{ background: 'rgba(0,240,255,0.05)', borderColor: 'rgba(0,240,255,0.2)', color: '#00f0ff' }}>
                <ChevronRight className="w-3 h-3" />
                {svc}
              </div>
            ))}
          </div>
        </div>

        {/* Code Fix */}
        <div className="rca-section">
          <h3 className="text-xs uppercase tracking-widest text-agentic-dim mb-3 flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5 text-green-400" />
            Suggested Fix — Confidence 95%
          </h3>
          <div className="rounded-xl overflow-hidden border border-agentic-border">
            <div className="px-4 py-2 border-b border-agentic-border bg-black/60 text-xs font-mono text-agentic-dim">
              inventory-service › GET /inventory/{'{'}<span className="text-agentic-cyan">productId</span>{'}'}
            </div>
            <pre className="p-4 text-sm font-mono overflow-x-auto bg-black/30 leading-6">
              <code className="block text-red-400">- SELECT stock FROM inventory</code>
              <code className="block text-red-400">    WHERE id = ?</code>
              <code className="block text-green-400">+ SELECT stock FROM inventory</code>
              <code className="block text-green-400">    WHERE id = ? FOR UPDATE</code>
            </pre>
          </div>
        </div>

        {/* CTA */}
        <div className="rca-section">
          <button className="w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 text-agentic-purple border hover:shadow-[0_0_24px_rgba(176,38,255,0.2)] active:scale-95"
            style={{ background: 'rgba(176,38,255,0.12)', borderColor: 'rgba(176,38,255,0.4)' }}>
            <CheckCircle2 className="w-4 h-4" />
            Apply Fix & Re-Replay Session
          </button>
        </div>

      </div>
    </div>
  );
}
