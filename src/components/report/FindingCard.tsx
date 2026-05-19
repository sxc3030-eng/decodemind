import { useState } from 'react';
import type { ReportFinding } from '@/lib/report/types';

const SEVERITY_STYLES = {
  error: { bg: 'bg-red-900/20', border: 'border-brand-danger', dot: 'bg-brand-danger', label: 'Critical' },
  warning: { bg: 'bg-amber-900/20', border: 'border-brand-warn', dot: 'bg-brand-warn', label: 'Important' },
  info: { bg: 'bg-slate-700/20', border: 'border-brand-muted', dot: 'bg-brand-muted', label: 'Minor' },
};

type ApplyState = 'idle' | 'applying' | 'applied' | 'error';

export interface FindingCardProps {
  finding: ReportFinding;
  onIgnore?: () => void;
  onApply?: () => Promise<void> | void;
}

export function FindingCard({ finding, onIgnore, onApply }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showEdits, setShowEdits] = useState(false);
  const [applyState, setApplyState] = useState<ApplyState>('idle');
  const [applyError, setApplyError] = useState<string | null>(null);
  const s = SEVERITY_STYLES[finding.severity];

  const hasEdits = finding.edits && finding.edits.length > 0;

  async function handleApplyClick() {
    if (!onApply) return;
    setApplyState('applying');
    setApplyError(null);
    try {
      await onApply();
      setApplyState('applied');
    } catch (err) {
      setApplyState('error');
      setApplyError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className={`rounded-lg border-l-4 ${s.border} ${s.bg} p-3 space-y-2`}>
      <div className="flex items-start gap-2">
        <span className={`inline-block w-2 h-2 rounded-full mt-1.5 ${s.dot}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="text-sm">
            <span className="font-medium">{s.label}</span>
            {finding.ruleId && (
              <span className="text-brand-muted font-mono text-xs ml-2">{finding.ruleId}</span>
            )}
          </div>
          <div className="text-sm text-brand-muted font-mono truncate">
            {finding.file}
            {finding.line != null && `:${finding.line}`}
          </div>
          <div className="text-sm mt-1">{finding.message}</div>
        </div>
      </div>

      {finding.explanation && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-brand-accent hover:underline"
          >
            {expanded ? 'Hide details' : 'Why it matters & how to fix'}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2 text-sm pl-2 border-l-2 border-brand-muted/30">
              <p><strong>Problem:</strong> {finding.explanation.problem}</p>
              <p><strong>Impact:</strong> {finding.explanation.impact}</p>
              <p><strong>Fix:</strong> {finding.explanation.fix}</p>
            </div>
          )}
        </div>
      )}

      {hasEdits && (
        <div>
          <button
            onClick={() => setShowEdits(!showEdits)}
            className="text-xs text-brand-accent hover:underline"
          >
            {showEdits ? 'Hide edits' : 'Preview fix'}
          </button>
          {showEdits && (
            <div className="mt-2 font-mono text-xs bg-brand-surface rounded p-2 space-y-2 overflow-x-auto">
              {finding.edits!.map((edit, i) => (
                <div key={i}>
                  <div className="text-brand-muted mb-1">
                    Edit {i + 1}: line {edit.startLine}:{edit.startColumn} → {edit.endLine}:{edit.endColumn}
                  </div>
                  <div className="text-brand-danger line-through opacity-60">
                    — (original text at those coordinates)
                  </div>
                  <div className="text-green-400">
                    + {edit.replacement === '' ? '(delete)' : JSON.stringify(edit.replacement)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {applyState === 'error' && applyError && (
        <p className="text-xs text-brand-danger">{applyError}</p>
      )}

      {(onIgnore || (hasEdits && onApply)) && (
        <div className="flex justify-end gap-2">
          {hasEdits && onApply && (
            <button
              onClick={handleApplyClick}
              disabled={applyState === 'applying' || applyState === 'applied'}
              className="text-xs px-2 py-0.5 rounded bg-brand-primary hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {applyState === 'idle' && 'Apply fix'}
              {applyState === 'applying' && 'Applying…'}
              {applyState === 'applied' && 'Applied'}
              {applyState === 'error' && 'Retry fix'}
            </button>
          )}
          {onIgnore && (
            <button onClick={onIgnore} className="text-xs text-brand-muted hover:text-white">
              Ignore
            </button>
          )}
        </div>
      )}
      {applyState === 'applied' && (
        <div className="text-xs text-brand-accent mt-1">
          Fix applied to disk. Click &quot;Re-scan to refresh&quot; at the top to refresh the report.
        </div>
      )}
    </div>
  );
}
