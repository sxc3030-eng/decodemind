import { describe, it, expect } from 'vitest';
import { reportToMarkdown, reportSummary } from '@/lib/export/markdown';
import type { Report } from '@/lib/report/types';

function makeReport(overrides?: Partial<Report>): Report {
  return {
    findings: [
      { file: 'src/a.py', line: 10, severity: 'error', ruleId: 'injection-eval', category: 'security', message: 'eval is dangerous' },
      { file: 'src/b.ts', line: 5, severity: 'warning', ruleId: 'bug-missing-await', category: 'bug', message: 'Missing await' },
      { file: 'src/c.py', line: 20, severity: 'info', ruleId: 'quality-todo-comment', category: 'quality', message: 'TODO found' },
    ],
    filesScanned: 5,
    totalFiles: 10,
    elapsedMs: 123,
    warnings: [],
    noiseScore: 0.33,
    ...overrides,
  };
}

describe('reportToMarkdown', () => {
  it('includes the default title', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('# DecodeMind Report');
  });

  it('includes a custom title when provided', () => {
    const md = reportToMarkdown(makeReport(), 'My Custom Title');
    expect(md).toContain('# My Custom Title');
  });

  it('includes finding count', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('3 findings');
  });

  it('includes filesScanned count', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('5 files');
  });

  it('includes a Security section header for security findings', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('Security');
  });

  it('includes a Bugs section header for bug findings', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('Bugs');
  });

  it('includes a Quality section header for quality findings', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('Quality');
  });

  it('omits empty category sections', () => {
    const report = makeReport({
      findings: [
        { file: 'a.py', line: 1, severity: 'error', ruleId: 'injection-eval', category: 'security', message: 'eval' },
      ],
    });
    const md = reportToMarkdown(report);
    expect(md).not.toContain('## 🐛 Bugs');
    expect(md).not.toContain('## 🧠 Logic');
    expect(md).not.toContain('## ✨ Quality');
    expect(md).toContain('Security');
  });

  it('includes warnings section when warnings exist', () => {
    const report = makeReport({ warnings: ['file too large', 'parse error'] });
    const md = reportToMarkdown(report);
    expect(md).toContain('## Warnings');
    expect(md).toContain('- file too large');
    expect(md).toContain('- parse error');
  });

  it('omits warnings section when no warnings', () => {
    const md = reportToMarkdown(makeReport({ warnings: [] }));
    expect(md).not.toContain('## Warnings');
  });

  it('includes explanation fields when present', () => {
    const report = makeReport({
      findings: [
        {
          file: 'a.py', line: 1, severity: 'error', ruleId: 'r1', category: 'security', message: 'msg',
          explanation: { problem: 'the problem', impact: 'the impact', fix: 'the fix' },
        },
      ],
    });
    const md = reportToMarkdown(report);
    expect(md).toContain('**Problem:** the problem');
    expect(md).toContain('**Impact:** the impact');
    expect(md).toContain('**Fix:** the fix');
  });

  it('handles null line with just file path', () => {
    const report = makeReport({
      findings: [
        { file: 'a.py', line: null, severity: 'warning', ruleId: 'r1', category: 'quality', message: 'msg' },
      ],
    });
    const md = reportToMarkdown(report);
    expect(md).toContain('`a.py`');
  });
});

describe('reportSummary', () => {
  it('produces a short multi-line summary', () => {
    const report = makeReport();
    const summary = reportSummary(report);
    const lines = summary.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });

  it('includes finding count in the first line', () => {
    const report = makeReport();
    const summary = reportSummary(report);
    expect(summary).toContain('3 findings');
  });

  it('includes per-category counts', () => {
    const report = makeReport();
    const summary = reportSummary(report);
    expect(summary).toContain('Security: 1');
    expect(summary).toContain('Bugs: 1');
    expect(summary).toContain('Logic: 0');
    expect(summary).toContain('Quality: 1');
  });

  it('includes noise percentage', () => {
    const report = makeReport({ noiseScore: 0.5 });
    const summary = reportSummary(report);
    expect(summary).toContain('50% noise');
  });
});
