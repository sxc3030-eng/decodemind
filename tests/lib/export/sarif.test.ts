import { describe, it, expect } from 'vitest';
import { reportToSarif } from '@/lib/export/sarif';
import type { Report } from '@/lib/report/types';

function makeReport(overrides?: Partial<Report>): Report {
  return {
    findings: [
      { file: 'src/a.py', line: 10, severity: 'error', ruleId: 'injection-eval', category: 'security', message: 'eval is dangerous' },
      { file: 'src/b.ts', line: 5, severity: 'warning', ruleId: 'crypto-md5', category: 'security', message: 'MD5 is weak' },
      { file: 'src/c.py', line: null, severity: 'info', ruleId: 'quality-todo-comment', category: 'quality', message: 'TODO found' },
    ],
    filesScanned: 3,
    totalFiles: 3,
    elapsedMs: 250,
    warnings: [],
    noiseScore: 0.33,
    ...overrides,
  };
}

describe('reportToSarif', () => {
  it('emits $schema and version 2.1.0', () => {
    const sarif = reportToSarif(makeReport());
    expect(sarif.$schema).toContain('sarif-2.1.0');
    expect(sarif.version).toBe('2.1.0');
  });

  it('emits one run with tool.driver.name = DecodeMind', () => {
    const sarif = reportToSarif(makeReport());
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe('DecodeMind');
  });

  it('emits one result per finding', () => {
    const report = makeReport();
    const sarif = reportToSarif(report);
    expect(sarif.runs[0].results).toHaveLength(report.findings.length);
  });

  it('maps severity info to SARIF level note', () => {
    const sarif = reportToSarif(makeReport());
    const infoResult = sarif.runs[0].results.find((r) => r.ruleId === 'quality-todo-comment');
    expect(infoResult?.level).toBe('note');
  });

  it('maps severity error to SARIF level error', () => {
    const sarif = reportToSarif(makeReport());
    const errorResult = sarif.runs[0].results.find((r) => r.ruleId === 'injection-eval');
    expect(errorResult?.level).toBe('error');
  });

  it('maps severity warning to SARIF level warning', () => {
    const sarif = reportToSarif(makeReport());
    const warnResult = sarif.runs[0].results.find((r) => r.ruleId === 'crypto-md5');
    expect(warnResult?.level).toBe('warning');
  });

  it('builds unique rules in tool.driver.rules', () => {
    const report = makeReport({
      findings: [
        { file: 'a.py', line: 1, severity: 'error', ruleId: 'r1', category: 'security', message: 'm1' },
        { file: 'b.py', line: 2, severity: 'warning', ruleId: 'r1', category: 'security', message: 'm2' },
        { file: 'c.py', line: 3, severity: 'info', ruleId: 'r2', category: 'quality', message: 'm3' },
      ],
    });
    const sarif = reportToSarif(report);
    const rules = sarif.runs[0].tool.driver.rules;
    expect(rules).toHaveLength(2);
    const ids = rules.map((r) => r.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('r2');
  });

  it('uses unknown as ruleId when finding.ruleId is null', () => {
    const report = makeReport({
      findings: [
        { file: 'a.py', line: 1, severity: 'warning', ruleId: null, category: 'quality', message: 'no rule' },
      ],
    });
    const sarif = reportToSarif(report);
    expect(sarif.runs[0].results[0].ruleId).toBe('unknown');
    expect(sarif.runs[0].tool.driver.rules[0].id).toBe('unknown');
  });

  it('uses line 1 when finding.line is null', () => {
    const report = makeReport({
      findings: [
        { file: 'a.py', line: null, severity: 'info', ruleId: 'r1', category: 'quality', message: 'm' },
      ],
    });
    const sarif = reportToSarif(report);
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine).toBe(1);
  });

  it('respects toolVersion parameter', () => {
    const sarif = reportToSarif(makeReport(), '1.2.3');
    expect(sarif.runs[0].tool.driver.version).toBe('1.2.3');
  });
});
