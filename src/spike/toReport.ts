import type { AggregatedFinding, FolderScanReport } from './folderScan';
import type { Report, ReportFinding } from '@/lib/report/types';
import { categorizeFinding, computeNoiseScore } from '@/lib/report/categorize';
import enExplanations from '@/lib/rules/explanations.en.json';

interface ExplanationEntry {
  problem: string;
  impact: string;
  fix: string;
}

const EN_EXPL = enExplanations as Record<string, ExplanationEntry>;

export function toReport(scan: FolderScanReport): Report {
  try {
    const findings: ReportFinding[] = scan.findings.map((f: AggregatedFinding) => ({
      file: f.file,
      line: f.line,
      severity: f.severity,
      ruleId: f.ruleId,
      category: categorizeFinding(f.ruleId),
      message: f.message,
      explanation: f.ruleId && EN_EXPL[f.ruleId] ? EN_EXPL[f.ruleId] : undefined,
      edits: f.edits,
    }));

    return {
      findings,
      filesScanned: scan.filesScanned,
      totalFiles: scan.totalFiles,
      elapsedMs: scan.elapsedMs,
      warnings: scan.warnings,
      noiseScore: computeNoiseScore(findings),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('toReport failed:', err);
    return {
      findings: scan.findings.map((f) => ({
        file: f.file,
        line: f.line,
        severity: f.severity,
        ruleId: f.ruleId,
        category: 'quality' as const,
        message: f.message,
      })),
      filesScanned: scan.filesScanned,
      totalFiles: scan.totalFiles,
      elapsedMs: scan.elapsedMs,
      warnings: [...(scan.warnings || []), `toReport failed: ${(err as Error).message}`],
      noiseScore: 1,
    };
  }
}
