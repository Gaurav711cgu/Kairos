"use client";

import { useEffect, useRef } from 'react';
import { animate, stagger, set, createTimeline } from 'animejs';
import { Activity, ArrowRight, ShieldAlert, GitCommitVertical } from 'lucide-react';

interface CausalEvent {
  id: string;
  service: string;
  method: string;
  path: string;
  latency: number;
  isAnomaly: boolean;
  vectorClock: string;
}

const MOCK_EVENTS: CausalEvent[] = [
  { id: 'ev-1', service: 'gateway-svc', method: 'POST', path: '/api/v1/orders', latency: 45, isAnomaly: false, vectorClock: '{"gateway": 1}' },
  { id: 'ev-2', service: 'auth-svc', method: 'GET', path: '/validate', latency: 12, isAnomaly: false, vectorClock: '{"gateway": 1, "auth": 1}' },
  { id: 'ev-3', service: 'inventory-svc', method: 'GET', path: '/stock/PRODUCT_X', latency: 8, isAnomaly: false, vectorClock: '{"gateway": 1, "auth": 1, "inventory": 1}' },
  { id: 'ev-4', service: 'inventory-svc', method: 'GET', path: '/stock/PRODUCT_X', latency: 15, isAnomaly: true, vectorClock: '{"gateway": 2, "inventory": 2}' },
  { id: 'ev-5', service: 'order-svc', method: 'POST', path: '/create', latency: 120, isAnomaly: true, vectorClock: '{"gateway": 1, "inventory": 2, "order": 1}' },
];

export default function AuditTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const elements = containerRef.current.querySelectorAll('.timeline-node');

      set(elements, { translateY: 50, opacity: 0, scale: 0.95 });

      animate(elements, {
        translateY: 0,
        opacity: 1,
        scale: 1,
        delay: stagger(150, { start: 500 }),
        ease: 'spring(1, 80, 10, 0)',
        duration: 1200
      });
    }
  }, []);

  return (
    <div className="glass-panel p-6 flex-1 flex flex-col h-full relative overflow-hidden" ref={containerRef}>
      <div className="flex items-center gap-3 mb-8">
        <Activity className="text-agentic-cyan w-5 h-5" />
        <h2 className="text-xl font-medium tracking-wide">Causal Audit Trail</h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 relative">
        {/* Vertical timeline line */}
        <div className="absolute left-7 top-4 bottom-4 w-px bg-agentic-border z-0" />

        <div className="flex flex-col gap-6 relative z-10">
          {MOCK_EVENTS.map((ev) => (
            <div key={ev.id} className="timeline-node flex gap-4 items-start group cursor-pointer">
              <div className={[
                "w-14 h-14 shrink-0 rounded-full flex items-center justify-center border transition-all duration-300",
                ev.isAnomaly
                  ? "bg-agentic-purple/10 border-agentic-purple text-agentic-purple shadow-[0_0_15px_rgba(176,38,255,0.2)]"
                  : "bg-agentic-dark border-agentic-border text-agentic-dim group-hover:border-agentic-cyan group-hover:text-agentic-cyan group-hover:shadow-[0_0_10px_rgba(0,240,255,0.15)]"
              ].join(' ')}>
                {ev.isAnomaly ? <ShieldAlert className="w-5 h-5" /> : <GitCommitVertical className="w-5 h-5" />}
              </div>

              <div className="flex-1 pt-1">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-agentic-text">{ev.service}</span>
                    <ArrowRight className="w-3 h-3 text-agentic-dim flex-shrink-0" />
                    <span className="text-agentic-cyan font-mono text-sm">{ev.method}</span>
                  </div>
                  <span className={[
                    "text-xs font-mono ml-2 shrink-0",
                    ev.latency > 100 ? "text-red-400" : "text-agentic-dim"
                  ].join(' ')}>{ev.latency}ms</span>
                </div>

                <div className="text-sm text-agentic-dim mb-2 font-mono truncate max-w-[260px]">
                  {ev.path}
                </div>

                <div className="inline-flex px-2 py-1 rounded bg-black/50 border border-agentic-border text-xs font-mono text-agentic-dim overflow-x-auto max-w-full">
                  VC: {ev.vectorClock}
                </div>

                {ev.isAnomaly && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-agentic-purple/10 border border-agentic-purple/30 text-agentic-purple text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-agentic-purple animate-pulse" />
                    Causal anomaly detected
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
