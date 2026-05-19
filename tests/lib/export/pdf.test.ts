import { describe, it, expect } from 'vitest';
import { reportToPdf } from '@/lib/export/pdf';
import type { Report } from '@/lib/report/types';

describe('reportToPdf', () => {
  it('returns a Blob', () => {
    const report: Report = {
      findings: [
        { file: 'a.py', line: 1, severity: 'error', ruleId: 'r1', category: 'security', message: 'm' },
      ],
      filesScanned: 1, totalFiles: 1, elapsedMs: 100, warnings: [], noiseScore: 0,
    };
    const blob = reportToPdf(report);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
