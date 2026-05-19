import type { NormalizedEdit } from '@/lib/fixes/applyEdit';

export type FindingCategory = 'security' | 'bug' | 'logic' | 'quality';
export type FindingSeverity = 'error' | 'warning' | 'info';

export interface ReportFinding {
  file: string;
  line: number | null;
  severity: FindingSeverity;
  ruleId: string | null;
  category: FindingCategory;
  message: string;
  explanation?: {
    problem: string;
    impact: string;
    fix: string;
  };
  edits?: NormalizedEdit[];
}

export interface Report {
  findings: ReportFinding[];
  filesScanned: number;
  totalFiles: number;
  elapsedMs: number;
  warnings: string[];
  noiseScore: number; // 0-1, fraction of findings that are NOT actionable
}
