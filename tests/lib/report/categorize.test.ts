import { describe, it, expect } from 'vitest';
import {
  categorizeFinding,
  computeNoiseScore,
  groupByCategory,
  sortBySeverity,
} from '@/lib/report/categorize';
import type { ReportFinding } from '@/lib/report/types';

describe('categorizeFinding', () => {
  it('routes ws-auth- prefix to security', () => {
    expect(categorizeFinding('ws-auth-no-origin-check')).toBe('security');
  });
  it('routes crypto- prefix to security', () => {
    expect(categorizeFinding('crypto-md5')).toBe('security');
  });
  it('routes injection- prefix to security', () => {
    expect(categorizeFinding('injection-shell-true')).toBe('security');
  });
  it('routes xss- prefix to security', () => {
    expect(categorizeFinding('xss-direct-innerhtml')).toBe('security');
  });
  it('routes Ruff S6xx to security', () => {
    expect(categorizeFinding('S605')).toBe('security');
  });
  it('routes Ruff F to bug', () => {
    expect(categorizeFinding('F841')).toBe('bug');
  });
  it('routes Ruff E5xx (line-too-long etc.) to quality', () => {
    expect(categorizeFinding('E501')).toBe('quality');
  });
  it('routes ESLint no-* to bug', () => {
    expect(categorizeFinding('no-undef')).toBe('bug');
  });
  it('routes eqeqeq to bug', () => {
    expect(categorizeFinding('eqeqeq')).toBe('bug');
  });
  it('routes llm- prefix (hallucinations + deprecated APIs) to bug', () => {
    expect(categorizeFinding('llm-fake-pandas-method')).toBe('bug');
    expect(categorizeFinding('llm-deprecated-react-lifecycle')).toBe('bug');
  });
  it('routes bug- prefix to bug', () => {
    expect(categorizeFinding('bug-missing-await')).toBe('bug');
  });
  it('routes logic- prefix to logic', () => {
    expect(categorizeFinding('logic-lock-without-unlock')).toBe('logic');
  });
  it('routes quality- prefix to quality', () => {
    expect(categorizeFinding('quality-magic-number')).toBe('quality');
  });
  it('null ruleId falls back to quality', () => {
    expect(categorizeFinding(null)).toBe('quality');
  });
  it('unknown prefix falls back to quality', () => {
    expect(categorizeFinding('some-random-rule-id')).toBe('quality');
  });
});

describe('computeNoiseScore', () => {
  function mk(category: 'security' | 'bug' | 'logic' | 'quality'): ReportFinding {
    return { file: 'a', line: 1, severity: 'warning', ruleId: 'r', category, message: 'm' };
  }

  it('returns 0 for empty findings', () => {
    expect(computeNoiseScore([])).toBe(0);
  });
  it('returns 0 when all findings are actionable (security)', () => {
    expect(computeNoiseScore([mk('security'), mk('security')])).toBe(0);
  });
  it('returns 1 when all findings are quality', () => {
    expect(computeNoiseScore([mk('quality'), mk('quality')])).toBe(1);
  });
  it('returns 0.5 when half are actionable', () => {
    expect(computeNoiseScore([mk('security'), mk('quality')])).toBe(0.5);
  });
});

describe('groupByCategory', () => {
  it('always returns all 4 keys', () => {
    const groups = groupByCategory([]);
    expect(Object.keys(groups).sort()).toEqual(['bug', 'logic', 'quality', 'security']);
  });
  it('routes findings to their category bucket', () => {
    const a: ReportFinding = { file: 'a', line: 1, severity: 'warning', ruleId: 'r', category: 'security', message: 'm' };
    const b: ReportFinding = { file: 'b', line: 1, severity: 'warning', ruleId: 'r', category: 'bug', message: 'm' };
    const groups = groupByCategory([a, b]);
    expect(groups.security.length).toBe(1);
    expect(groups.bug.length).toBe(1);
    expect(groups.logic.length).toBe(0);
    expect(groups.quality.length).toBe(0);
  });
});

describe('sortBySeverity', () => {
  it('sorts errors before warnings before info', () => {
    const findings: ReportFinding[] = [
      { file: 'a', line: 1, severity: 'info', ruleId: 'r', category: 'quality', message: 'm' },
      { file: 'b', line: 1, severity: 'error', ruleId: 'r', category: 'security', message: 'm' },
      { file: 'c', line: 1, severity: 'warning', ruleId: 'r', category: 'bug', message: 'm' },
    ];
    const sorted = sortBySeverity(findings);
    expect(sorted.map((f) => f.severity)).toEqual(['error', 'warning', 'info']);
  });
  it('secondary sort by file path', () => {
    const findings: ReportFinding[] = [
      { file: 'z.py', line: 1, severity: 'error', ruleId: 'r', category: 'security', message: 'm' },
      { file: 'a.py', line: 1, severity: 'error', ruleId: 'r', category: 'security', message: 'm' },
    ];
    const sorted = sortBySeverity(findings);
    expect(sorted.map((f) => f.file)).toEqual(['a.py', 'z.py']);
  });
});
