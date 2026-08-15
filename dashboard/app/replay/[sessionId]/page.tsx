'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSession } from '@/lib/api';
import { ReplaySession } from '@/lib/types';
import { Timeline } from '@/app/components/Timeline';
import { RcaReport } from '@/app/components/RcaReport';
import { DbDiff } from '@/app/components/DbDiff';
import { ReplayControls } from '@/app/components/ReplayControls';

export default function ReplayDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<ReplaySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'diff' | 'rca'>('timeline');

  const isTerminal = (s: ReplaySession) =>
    s.status === 'COMPLETE' || s.status.startsWith('FAILED');

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const load = async () => {
      try {
        const data = await getSession(params.sessionId);
        setSession(data);
        if (isTerminal(data)) {
          clearInterval(intervalId);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };

    load();
    intervalId = setInterval(load, 2000);
    return () => clearInterval(intervalId);
  }, [params.sessionId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32, borderWidth: 3 }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading replay session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
        <p style={{ color: 'var(--red)' }}>Error: {error || 'Session not found'}</p>
        <button className="btn btn-ghost" onClick={() => router.push('/')} style={{ marginTop: 12 }}>← Back</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => router.push('/')} style={{ padding: '6px 12px' }}>
          ← Back
        </button>
        <div>
          <h1 style={{ fontSize: 18 }}>Replay Session</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
            {session.sessionId}
          </p>
        </div>
      </div>

      {/* Progress / Controls */}
      <div className="card section">
        <ReplayControls session={session} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: 'var(--surface)', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {(['timeline', 'diff', 'rca'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="btn"
            style={{
              padding: '6px 16px',
              background: activeTab === tab ? 'var(--surface-2)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
              border: 'none',
              fontSize: 13,
            }}
          >
            {tab === 'timeline' && 'Timeline'}
            {tab === 'diff' && 'DB Diff'}
            {tab === 'rca' && 'Root Cause'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'timeline' && (
        <div className="card section">
          <div className="card-header">
            <h2>Causal Event Timeline</h2>
            {session.racingConditionDetected && (
              <span className="badge badge-anomaly">Race Detected</span>
            )}
          </div>
          {session.events && session.events.length > 0 ? (
            <Timeline events={session.events} />
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
              {session.status === 'COMPLETE' ? 'No events captured' : 'Waiting for replay events...'}
            </div>
          )}
          
          {/* Event legend */}
          {session.events && session.events.length > 0 && (
            <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>● Events are plotted by <strong style={{ color: 'var(--text)' }}>causal position</strong> (vector clock order), not wall clock</span>
              <span style={{ color: 'var(--amber)' }}>│ Amber vertical line = concurrent events (potential race)</span>
              <span style={{ color: 'var(--green)' }}>○ Green ring = status matched original</span>
              <span style={{ color: 'var(--red)' }}>○ Red ring = status diverged from original</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'diff' && (
        <div className="card section">
          <div className="card-header">
            <h2>Database State Diff</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Before vs. after replay</span>
          </div>
          <DbDiff diffs={session.dbDiffs} />
        </div>
      )}

      {activeTab === 'rca' && (
        <div className="section">
          <div style={{ marginBottom: 16 }}>
            <h2>Root Cause Analysis</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Generated by Gemini 2.5 Flash from replay trace — structured output, not free-form text
            </p>
          </div>
          {session.rcaReport ? (
            <RcaReport rca={session.rcaReport} />
          ) : session.status === 'ANALYZING' ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32, borderWidth: 3 }} />
              <p style={{ color: 'var(--text-muted)' }}>Gemini 2.5 Flash is analyzing the trace...</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>Typically < 2 seconds p50</p>
            </div>
          ) : (
            <div className="card empty-state">
              <div className="empty-state-icon">[RCA]</div>
              <div className="empty-state-title">No Analysis Yet</div>
              <div className="empty-state-desc">Analysis runs after replay completes.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
