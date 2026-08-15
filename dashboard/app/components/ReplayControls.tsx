import { ReplaySession } from '@/lib/types';
import clsx from 'clsx';

const STEPS = [
  'ACQUIRING_RESOURCES',
  'RESTORING_DATABASE',
  'STARTING_MOCK_LAYER',
  'REPLAYING_EVENTS',
  'COLLECTING_TRACE',
  'ANALYZING',
  'COMPLETE',
];

const STEP_LABELS: Record<string, string> = {
  ACQUIRING_RESOURCES: 'Acquire Resources',
  RESTORING_DATABASE: 'Restore DB',
  STARTING_MOCK_LAYER: 'Start Mocks',
  REPLAYING_EVENTS: 'Replay Events',
  COLLECTING_TRACE: 'Collect Trace',
  ANALYZING: 'Analyze (LLM)',
  COMPLETE: 'Complete',
};

function getStepStatus(step: string, currentStatus: string): 'done' | 'active' | 'pending' {
  const stepIdx = STEPS.indexOf(step);
  const currentIdx = STEPS.indexOf(currentStatus);
  if (currentStatus === 'COMPLETE') return 'done';
  if (currentIdx === -1) return stepIdx < 0 ? 'pending' : 'pending'; // Failed state
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

export function ReplayControls({ session }: { session: ReplaySession }) {
  const isFailed = session.status.startsWith('FAILED');
  const isRunning = !isFailed && session.status !== 'COMPLETE' && session.status !== 'CREATED';
  
  return (
    <div>
      {/* Progress steps */}
      <div className="steps" style={{ marginBottom: 16 }}>
        {STEPS.map(step => {
          const status = getStepStatus(step, session.status);
          return (
            <div
              key={step}
              className={clsx(
                'step',
                status === 'active' && 'step-active',
                status === 'done' && 'step-done',
              )}
            >
              {status === 'active' && <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />}
              {status === 'done' && '[DONE]'}
              {STEP_LABELS[step]}
            </div>
          );
        })}
      </div>
      
      {isFailed && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 6,
          marginBottom: 16,
        }}>
          <div style={{ color: 'var(--red)', fontWeight: 500, marginBottom: 4, fontSize: 13 }}>
            Session Failed: {session.status.replace(/_/g, ' ')}
          </div>
          {session.errorMessage && (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {session.errorMessage}
            </div>
          )}
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
            Saga compensation ran — all resources cleaned up.
          </div>
        </div>
      )}
      
      {isRunning && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pulse" style={{ color: 'var(--accent)' }}>●</span>
          Replay in progress — auto-refreshing every 2s
        </div>
      )}
      
      {/* Session meta */}
      <div style={{ marginTop: 12, display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>Session: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 11 }}>{session.sessionId}</code></span>
        {session.racingConditionDetected && (
          <span style={{ color: 'var(--amber)' }}>Race condition detected</span>
        )}
        <span>Services: {session.services?.join(', ')}</span>
      </div>
    </div>
  );
}
