import { DbDiff as DbDiffType } from '@/lib/types';

export function DbDiff({ diffs }: { diffs: DbDiffType[] }) {
  if (!diffs || diffs.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>
        No database changes recorded
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {diffs.map((diff, i) => (
        <div key={i}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            TABLE: {diff.tableName}
          </div>
          <table className="diff-table">
            <thead>
              <tr>
                <td className="diff-key" style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, paddingBottom: 4 }}>KEY</td>
                <td style={{ color: 'var(--red)', fontSize: 10, fontWeight: 600, paddingBottom: 4 }}>BEFORE</td>
                <td style={{ color: 'var(--green)', fontSize: 10, fontWeight: 600, paddingBottom: 4 }}>AFTER</td>
              </tr>
            </thead>
            <tbody>
              {Object.keys({ ...diff.before, ...diff.after }).map(key => {
                const before = diff.before[key];
                const after = diff.after[key];
                const changed = JSON.stringify(before) !== JSON.stringify(after);
                return (
                  <tr key={key}>
                    <td className="diff-key">{key}</td>
                    <td className={changed ? 'diff-removed' : ''}>
                      {JSON.stringify(before) ?? '—'}
                    </td>
                    <td className={changed ? 'diff-added' : ''}>
                      {JSON.stringify(after) ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
