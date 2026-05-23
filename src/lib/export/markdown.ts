import type { Report, ReportFinding } from '@/lib/report/types';
import { groupByCategory } from '@/lib/report/categorize';

const SECTION_ICONS = {
  security: '🔒',
  bug: '🐛',
  logic: '🧠',
  quality: '✨',
} as const;

const SECTION_LABELS = {
  security: 'Security',
  bug: 'Bugs',
  logic: 'Logic',
  quality: 'Quality',
} as const;

function findingToMarkdown(f: ReportFinding): string {
  const severityBadge = f.severity === 'error' ? '🔴' : f.severity === 'warning' ? '🟠' : '🟡';
  const location = f.line != null ? `${f.file}:${f.line}` : f.file;
  const lines: string[] = [];
  lines.push(`### ${severityBadge} ${f.ruleId ?? 'unknown'} — \`${location}\``);
  lines.push('');
  lines.push(f.message);
  if (f.explanation) {
    lines.push('');
    lines.push(`**Problem:** ${f.explanation.problem}`);
    lines.push('');
    lines.push(`**Impact:** ${f.explanation.impact}`);
    lines.push('');
    lines.push(`**Fix:** ${f.explanation.fix}`);
  }
  return lines.join('\n');
}

export function reportToMarkdown(report: Report, title = 'DecodeMind Report'): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push('');
  lines.push(
    `**${report.findings.length} findings** across **${report.filesScanned} files** in ${Math.round(report.elapsedMs)} ms · noise score ${Math.round(report.noiseScore * 100)}%`,
  );
  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    for (const w of report.warnings) lines.push(`- ${w}`);
  }
  const grouped = groupByCategory(report.findings);
  for (const cat of ['security', 'bug', 'logic', 'quality'] as const) {
    const items = grouped[cat];
    if (items.length === 0) continue;
    lines.push('');
    lines.push(`## ${SECTION_ICONS[cat]} ${SECTION_LABELS[cat]} (${items.length})`);
    lines.push('');
    for (const f of items) {
      lines.push(findingToMarkdown(f));
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function reportSummary(report: Report): string {
  const grouped = groupByCategory(report.findings);
  return [
    `DecodeMind Report — ${report.findings.length} findings (${Math.round(report.noiseScore * 100)}% noise)`,
    `🔒 Security: ${grouped.security.length}`,
    `🐛 Bugs: ${grouped.bug.length}`,
    `🧠 Logic: ${grouped.logic.length}`,
    `✨ Quality: ${grouped.quality.length}`,
  ].join('\n');
}
