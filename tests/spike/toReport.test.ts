import { describe, it, expect } from 'vitest';
import { toReport } from '@/spike/toReport';
import type { FolderScanReport } from '@/spike/folderScan';

describe('toReport', () => {
  it('routes findings to categories', () => {
    const scan: FolderScanReport = {
      filesScanned: 1,
      filesSkipped: 0,
      totalFiles: 1,
      elapsedMs: 100,
      warnings: [],
      findings: [
        { file: 'a.py', line: 1, severity: 'error', ruleId: 'injection-shell-true', message: 'shell injection' },
        { file: 'b.ts', line: 2, severity: 'warning', ruleId: 'E501', message: 'too long' },
      ],
    };
    const report = toReport(scan);
    expect(report.findings).toHaveLength(2);
    expect(report.findings[0].category).toBe('security');
    expect(report.findings[1].category).toBe('quality');
    expect(report.noiseScore).toBeGreaterThan(0); // half the findings are quality
  });

  it('attaches edits when present', () => {
    const scan: FolderScanReport = {
      filesScanned: 1, filesSkipped: 0, totalFiles: 1, elapsedMs: 100, warnings: [],
      findings: [
        {
          file: 'a.py',
          line: 1,
          severity: 'error',
          ruleId: 'F841',
          message: 'unused',
          edits: [{ startLine: 1, startColumn: 1, endLine: 1, endColumn: 10, replacement: '' }],
        },
      ],
    };
    const report = toReport(scan);
    expect(report.findings[0].edits).toBeDefined();
    expect(report.findings[0].edits?.length).toBe(1);
  });

  it('attaches explanation when ruleId has one in EN dictionary', () => {
    const scan: FolderScanReport = {
      filesScanned: 1, filesSkipped: 0, totalFiles: 1, elapsedMs: 100, warnings: [],
      findings: [
        { file: 'a.py', line: 1, severity: 'error', ruleId: 'injection-shell-true', message: 'shell' },
      ],
    };
    const report = toReport(scan);
    expect(report.findings[0].explanation).toBeDefined();
    expect(report.findings[0].explanation?.problem).toBeTruthy();
  });
});
