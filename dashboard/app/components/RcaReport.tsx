import { RcaReport as RcaReportType } from '@/lib/types';
import clsx from 'clsx';

const PATTERN_LABELS: Record<string, string> = {
  TOCTOU_RACE_CONDITION: 'TOCTOU Race Condition',
  DEADLOCK: 'Deadlock',
  MISSING_DISTRIBUTED_LOCK: 'Missing Distributed Lock',
  N_PLUS_ONE_QUERY: 'N+1 Query',
  CASCADING_FAILURE: 'Cascading Failure',
  MISSING_IDEMPOTENCY: 'Missing Idempotency',
  VECTOR_CLOCK_VIOLATION: 'Vector Clock Violation',
  OTHER: 'Other',
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'var(--green)',
  MEDIUM: 'var(--yellow)',
  HIGH: 'var(--amber)',
  CRITICAL: 'var(--red)',
};

function DiffBlock({ diff }: { diff: string }) {
  const lines = diff.split('\n');
  return (
    <pre>
      {lines.map((line, i) => (
        <div
          key={i}
          className={clsx(
            line.startsWith('-') && 'diff-line-removed',
            line.startsWith('+') && 'diff-line-added',
            !line.startsWith('-') && !line.startsWith('+') && 'diff-line-context',
          )}
        >
          {line || ' '}
        </div>
      ))}
    </pre>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--amber)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Confidence</span>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color }}>{pct}%</span>
      </div>
      <div className="confidence-bar">
        <div className="confidence-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function RcaReport({ rca }: { rca: RcaReportType }) {
  return (
    <div>
      {/* Root Cause Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span
            className="badge badge-toctou"
            style={{ fontSize: 13, padding: '4px 12px' }}
          >
            {PATTERN_LABELS[rca.rootCause.pattern] || rca.rootCause.pattern}
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: SEVERITY_COLORS[rca.severity],
              fontWeight: 600,
            }}
          >
            {rca.severity}
          </span>
        </div>
        
        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
          {rca.rootCause.description}
        </p>
        
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {rca.traceSummary}
        </p>
        
        {/* Affected services */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {rca.rootCause.affectedServices.map(svc => (
            <span key={svc} className="service-chip">{svc}</span>
          ))}
        </div>
      </div>

      <div className="grid-2">
        {/* Evidence */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Evidence from Trace</h3>
          <ul className="evidence-list">
            {rca.rootCause.evidence.map((e, i) => (
              <li key={i} className="evidence-item">{e}</li>
            ))}
          </ul>
          
          {rca.contributingFactors.length > 0 && (
            <>
              <h3 style={{ marginTop: 16, marginBottom: 8 }}>Contributing Factors</h3>
              <ul className="evidence-list">
                {rca.contributingFactors.map((f, i) => (
                  <li key={i} className="evidence-item" style={{ opacity: 0.8 }}>{f}</li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Primary Fix */}
        <div className="card">
          <h3 style={{ marginBottom: 4 }}>Suggested Fix</h3>
          <p style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
            {rca.primaryFix.codeLocation}
          </p>
          <p style={{ fontSize: 13, marginBottom: 12 }}>{rca.primaryFix.description}</p>
          <DiffBlock diff={rca.primaryFix.codeDiff} />
          <div style={{ marginTop: 12 }}>
            <ConfidenceMeter value={rca.primaryFix.confidence} />
          </div>
        </div>
      </div>

      {/* Secondary fixes */}
      {rca.secondaryFixes.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Additional Recommendations</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rca.secondaryFixes.map((fix, i) => (
              <div key={i} style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                  {fix.codeLocation}
                </p>
                <p style={{ fontSize: 13 }}>{fix.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
