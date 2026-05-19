import { jsPDF } from 'jspdf';
import type { Report, ReportFinding } from '@/lib/report/types';
import { groupByCategory } from '@/lib/report/categorize';

const PAGE_MARGIN_MM = 15;
const LINE_HEIGHT_MM = 5;

function severityLabel(s: ReportFinding['severity']): string {
  if (s === 'error') return 'CRITICAL';
  if (s === 'warning') return 'IMPORTANT';
  return 'MINOR';
}

export function reportToPdf(report: Report, title = 'DecodeMind Report'): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 2 * PAGE_MARGIN_MM;
  let y = PAGE_MARGIN_MM;

  const writeLine = (text: string, opts?: { fontSize?: number; bold?: boolean }) => {
    if (y > pageHeight - PAGE_MARGIN_MM) {
      doc.addPage();
      y = PAGE_MARGIN_MM;
    }
    if (opts?.fontSize) doc.setFontSize(opts.fontSize);
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    const wrapped = doc.splitTextToSize(text, contentWidth);
    for (const line of wrapped) {
      if (y > pageHeight - PAGE_MARGIN_MM) {
        doc.addPage();
        y = PAGE_MARGIN_MM;
      }
      doc.text(line, PAGE_MARGIN_MM, y);
      y += LINE_HEIGHT_MM;
    }
  };

  // Title page
  writeLine(title, { fontSize: 22, bold: true });
  y += 3;
  writeLine(`Generated ${new Date().toISOString()}`, { fontSize: 9 });
  y += 4;
  writeLine(
    `${report.findings.length} findings across ${report.filesScanned} files in ${Math.round(report.elapsedMs)} ms · noise score ${Math.round(report.noiseScore * 100)}%`,
    { fontSize: 10 },
  );
  y += 4;

  const grouped = groupByCategory(report.findings);
  const sectionOrder = ['security', 'bug', 'logic', 'quality'] as const;
  const sectionLabels = { security: 'Security', bug: 'Bugs', logic: 'Logic', quality: 'Quality' };

  for (const cat of sectionOrder) {
    const items = grouped[cat];
    if (items.length === 0) continue;
    y += 3;
    writeLine(`${sectionLabels[cat]} (${items.length})`, { fontSize: 14, bold: true });
    for (const f of items) {
      y += 1;
      const location = f.line != null ? `${f.file}:${f.line}` : f.file;
      writeLine(`[${severityLabel(f.severity)}] ${f.ruleId ?? 'unknown'} — ${location}`, { fontSize: 10, bold: true });
      writeLine(f.message, { fontSize: 9 });
      if (f.explanation) {
        writeLine(`Problem: ${f.explanation.problem}`, { fontSize: 9 });
        writeLine(`Impact: ${f.explanation.impact}`, { fontSize: 9 });
        writeLine(`Fix: ${f.explanation.fix}`, { fontSize: 9 });
      }
    }
  }

  return doc.output('blob');
}
