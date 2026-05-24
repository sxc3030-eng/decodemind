import type { AggregatedFinding, FolderScanReport } from './folderScan';
import type { Report, ReportFinding } from '@/lib/report/types';
import { categorizeFinding, computeNoiseScore } from '@/lib/report/categorize';
import enExplanations from '@/lib/rules/explanations.en.json';

interface ExplanationEntry {
  problem: string;
  impact: string;
  fix: string;
}

// V1 explanations (60 rules from the original rule library)
const V1_EXPL = enExplanations as Record<string, ExplanationEntry>;

// V2 explanations live in `src/lib/rules/explanations/<lang>.en.json` —
// one file per language family (Java, Kotlin, Swift, Dart, C#, PHP, Go, Ruby,
// Bash, Dockerfile, YAML). Vite's `import.meta.glob` with `eager: true` bundles
// them at build time into a single map. We merge them into one EN dictionary
// so finding lookup is a flat O(1) by rule id.
//
// The query string `?json` tells Vite to import the JSON as a parsed module.
// Use a relative path — Vite's `@/` alias is unreliable inside import.meta.glob
// (the static analyzer doesn't always resolve aliases, returning {} silently).
const v2ExplGlob = import.meta.glob<Record<string, ExplanationEntry>>(
  '../lib/rules/explanations/*.en.json',
  { eager: true, import: 'default' },
);

function mergeExplanations(): Record<string, ExplanationEntry> {
  const out: Record<string, ExplanationEntry> = { ...V1_EXPL };
  for (const mod of Object.values(v2ExplGlob)) {
    Object.assign(out, mod);
  }
  return out;
}

const EN_EXPL = mergeExplanations();

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
