'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ReplaySession } from '@/lib/types';
import { listSessions, startReplay } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

function StatusBadge({ status }: { status: ReplaySession['status'] }) {
  const isRunning = !['COMPLETE', 'FAILED', 'CREATED',
    'FAILED_RESTORE_VALIDATION', 'FAILED_ORDERING_VIOLATION',
    'FAILED_BRANCH_CREATION', 'FAILED_CAUSAL_CYCLE'].includes(status);
  const isFailed = status.startsWith('FAILED');
  const isComplete = status === 'COMPLETE';
  
  return (
    <span className={clsx('badge',
      isComplete && 'badge-complete',
      isFailed && 'badge-failed',
      isRunning && 'badge-running',
      status === 'CREATED' && 'badge-created',
    )}>
      {isRunning && <span className="pulse">●</span>}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ReplaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listSessions();
        setSessions(data);
      } catch (e) {
        setError('Could not connect to orchestrator at localhost:8090');
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNewReplay = async () => {
    setStarting(true);
    try {
      const result = await startReplay({
        startTraceId: 'latest',
        services: ['order-service', 'payment-service', 'inventory-service'],
      });
      router.push(`/replay/${result.sessionId}`);
    } catch (e) {
      setError('Failed to start replay: ' + String(e));
    } finally {
      setStarting(false);
    }
  };

  const completedSessions = sessions.filter(s => s.status === 'COMPLETE').length;
  const failedSessions = sessions.filter(s => s.status.startsWith('FAILED')).length;
  const racingSessions = sessions.filter(s => s.racingConditionDetected).length;

  return (
    <div>
      <div className="section">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1>Replay Sessions</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
              Causal state capture and deterministic replay for distributed microservices
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleNewReplay}
            disabled={starting}
          >
            {starting ? <><span className="spinner" /> Starting...</> : 'New Replay'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card stat-card">
            <div className="stat-label">Total Sessions</div>
            <div className="stat-value">{sessions.length}</div>
            <div className="stat-sub">{completedSessions} completed</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Race Conditions Detected</div>
            <div className="stat-value" style={{ color: 'var(--amber)' }}>{racingSessions}</div>
            <div className="stat-sub">via vector clocks</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Failed Sessions</div>
            <div className="stat-value" style={{ color: failedSessions > 0 ? 'var(--red)' : 'var(--green)' }}>{failedSessions}</div>
            <div className="stat-sub">saga compensated</div>
          </div>
        </div>

        {error && (
          <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', marginBottom: 16 }}>
            <p style={{ color: 'var(--red)', fontSize: 13 }}>Error: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)' }}>Connecting to orchestrator...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">[STM]</div>
            <div className="empty-state-title">No Replay Sessions Yet</div>
            <div className="empty-state-desc">
              Run <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: 3 }}>./trigger-race.sh</code> to create a race condition, then click New Replay.
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="session-table">
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Status</th>
                  <th>Race Detected</th>
                  <th>Root Cause</th>
                  <th>Services</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.sessionId} onClick={() => router.push(`/replay/${s.sessionId}`)}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>
                        {s.sessionId.substring(0, 12)}...
                      </span>
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      {s.racingConditionDetected
                        ? <span className="badge badge-anomaly">Yes</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td>
                      {s.rcaReport?.rootCause.pattern
                        ? <span className="badge badge-toctou">{s.rcaReport.rootCause.pattern.replace(/_/g, ' ')}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {s.services?.slice(0, 2).map(svc => (
                          <span key={svc} className="service-chip">{svc.replace('-service', '')}</span>
                        ))}
                        {(s.services?.length || 0) > 2 && (
                          <span className="service-chip">+{s.services.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
