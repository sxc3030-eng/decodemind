import { useState } from 'react';
import type { ReportFinding } from '@/lib/report/types';

const SEVERITY_STYLES = {
  error: { bg: 'bg-red-900/20', border: 'border-brand-danger', dot: 'bg-brand-danger', label: 'Critical' },
  warning: { bg: 'bg-amber-900/20', border: 'border-brand-warn', dot: 'bg-brand-warn', label: 'Important' },
  info: { bg: 'bg-slate-700/20', border: 'border-brand-muted', dot: 'bg-brand-muted', label: 'Minor' },
};

export interface FindingCardProps {
  finding: ReportFinding;
  onIgnore?: () => void;
}

export function FindingCard({ finding, onIgnore }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const s = SEVERITY_STYLES[finding.severity];

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

      {onIgnore && (
        <div className="flex justify-end">
          <button onClick={onIgnore} className="text-xs text-brand-muted hover:text-white">
            Ignore
          </button>
        </div>
      )}
    </div>
  );
}
