import { useState } from 'react';
import type { Report, FindingCategory } from '@/lib/report/types';
import { groupByCategory, sortBySeverity } from '@/lib/report/categorize';
import { FindingCard } from './FindingCard';

const SECTION_META: Record<FindingCategory, { icon: string; label: string; defaultOpen: boolean }> = {
  security: { icon: '🔒', label: 'Security', defaultOpen: true },
  bug:      { icon: '🐛', label: 'Bugs',     defaultOpen: true },
  logic:    { icon: '🧠', label: 'Logic',    defaultOpen: false },
  quality:  { icon: '✨', label: 'Quality',  defaultOpen: false },
};

export function SectionedReport({
  report,
  onApplyFinding,
}: {
  report: Report;
  onApplyFinding?: (finding: import('@/lib/report/types').ReportFinding) => Promise<void>;
}) {
  const grouped = groupByCategory(report.findings);
  const [openSections, setOpenSections] = useState<Record<FindingCategory, boolean>>({
    security: SECTION_META.security.defaultOpen,
    bug:      SECTION_META.bug.defaultOpen,
    logic:    SECTION_META.logic.defaultOpen,
    quality:  SECTION_META.quality.defaultOpen,
  });

  const toggle = (k: FindingCategory) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));

  const noisePct = Math.round(report.noiseScore * 100);
  const totalActionable = grouped.security.length + grouped.bug.length + grouped.logic.length;

  return (
    <div className="space-y-4">
      <header className="bg-brand-card rounded-lg p-4">
        <h2 className="text-xl font-semibold">Report</h2>
        <div className="text-sm text-brand-muted mt-1">
          {report.findings.length} findings · {totalActionable} actionable · noise score {noisePct}%
          {' · '}
          {report.filesScanned} files scanned in {Math.round(report.elapsedMs)} ms
        </div>
        {noisePct >= 60 && (
          <div className="mt-2 p-2 rounded bg-brand-warn/10 border border-brand-warn text-sm">
            Most findings are style. Consider adding noisy directories to <code>.decodemind-ignore</code>.
          </div>
        )}
        {report.warnings.length > 0 && (
          <ul className="mt-2 text-xs text-brand-muted space-y-0.5">
            {report.warnings.map((w, i) => <li key={i}>· {w}</li>)}
          </ul>
        )}
      </header>

      {(['security', 'bug', 'logic', 'quality'] as FindingCategory[]).map((cat) => {
        const meta = SECTION_META[cat];
        const items = sortBySeverity(grouped[cat]);
        const open = openSections[cat];
        return (
          <section key={cat} className="bg-brand-card rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(cat)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-brand-surface/30"
              aria-expanded={open}
            >
              <div className="flex items-center gap-2 font-semibold">
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="text-sm text-brand-muted">({items.length})</span>
              </div>
              <span className="text-brand-muted">{open ? '−' : '+'}</span>
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-2">
                {items.length === 0 ? (
                  <p className="text-sm text-brand-muted italic">
                    {cat === 'security' ? 'No security findings 🎉' : 'No findings'}
                  </p>
                ) : (
                  items.map((f, i) => (
                    <FindingCard
                      key={i}
                      finding={f}
                      onApply={onApplyFinding ? () => onApplyFinding(f) : undefined}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
