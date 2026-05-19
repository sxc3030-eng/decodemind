import type { FolderScanReport } from './folderScan';

const DISPLAY_LIMIT = 200;

function severityClass(s: 'error' | 'warning' | 'info') {
  if (s === 'error') return 'text-brand-danger';
  if (s === 'warning') return 'text-brand-warn';
  return 'text-brand-muted';
}

export function FolderScanResults({
  report,
  displayLimit = DISPLAY_LIMIT,
}: {
  report: FolderScanReport;
  displayLimit?: number;
}) {
  const shown = report.findings.slice(0, displayLimit);
  const overflow = report.findings.length - shown.length;

  return (
    <div className="space-y-3">
      {/* ── Summary header ── */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          <span className="text-brand-muted">Files scanned:</span>{' '}
          <span className="font-semibold">{report.filesScanned}</span>
        </span>
        {report.filesSkipped > 0 && (
          <span>
            <span className="text-brand-muted">Skipped:</span>{' '}
            <span className="font-semibold text-brand-warn">{report.filesSkipped}</span>
          </span>
        )}
        <span>
          <span className="text-brand-muted">Findings:</span>{' '}
          <span className="font-semibold">{report.findings.length}</span>
        </span>
        <span>
          <span className="text-brand-muted">Time:</span>{' '}
          <span className="font-semibold">{report.elapsedMs.toLocaleString()} ms</span>
        </span>
      </div>

      {/* ── Warnings ── */}
      {report.warnings.length > 0 && (
        <ul className="text-xs text-brand-warn space-y-1">
          {report.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}

      {/* ── Findings table ── */}
      {report.findings.length === 0 ? (
        <p className="text-sm text-brand-accent">No findings — all scanned files look clean.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border border-brand-card">
              <thead className="bg-brand-surface">
                <tr>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Rule</th>
                  <th className="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((f, i) => (
                  <tr key={i} className="border-t border-brand-card">
                    <td className="px-3 py-1 text-brand-muted max-w-[14rem] truncate" title={f.file}>
                      {f.file}
                    </td>
                    <td className="px-3 py-1 tabular-nums">{f.line ?? '—'}</td>
                    <td className={`px-3 py-1 font-semibold ${severityClass(f.severity)}`}>
                      {f.severity}
                    </td>
                    <td className="px-3 py-1 text-brand-muted">{f.ruleId ?? '—'}</td>
                    <td className="px-3 py-1 max-w-[24rem] truncate" title={f.message}>
                      {f.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {overflow > 0 && (
            <p className="text-xs text-brand-warn">
              {overflow} more finding{overflow === 1 ? '' : 's'} not shown (display limit is {displayLimit}).
            </p>
          )}
        </>
      )}
    </div>
  );
}
