import type { Report } from '@/lib/report/types';
import { reportToSarif } from '@/lib/export/sarif';
import { reportToMarkdown, reportSummary } from '@/lib/export/markdown';
import { reportToPdf } from '@/lib/export/pdf';
import { downloadBlob, downloadText, downloadJson } from '@/lib/export/download';

function isoDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function ExportMenu({ report }: { report: Report }) {
  if (report.findings.length === 0) {
    return <p className="text-sm text-brand-muted italic">Nothing to export yet.</p>;
  }
  const stamp = isoDate();

  const exportPdf = () => {
    const blob = reportToPdf(report);
    downloadBlob(blob, `decodemind-report-${stamp}.pdf`);
  };
  const exportSarif = () => {
    const sarif = reportToSarif(report);
    downloadJson(sarif, `decodemind-report-${stamp}.sarif.json`);
  };
  const exportMarkdown = () => {
    downloadText(reportToMarkdown(report), `decodemind-report-${stamp}.md`, 'text/markdown');
  };
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(reportSummary(report));
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <button onClick={exportPdf} className="bg-brand-primary hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded">
        Export PDF
      </button>
      <button onClick={exportSarif} className="bg-brand-primary hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded">
        Export SARIF
      </button>
      <button onClick={exportMarkdown} className="bg-brand-primary hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded">
        Export Markdown
      </button>
      <button onClick={copySummary} className="bg-brand-card border border-brand-muted hover:border-brand-accent text-white text-sm px-3 py-1.5 rounded">
        Copy summary
      </button>
    </div>
  );
}
