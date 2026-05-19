import type { ReportFinding, FindingCategory } from './types';

const CATEGORY_PREFIXES: Record<string, FindingCategory> = {
  // Security
  'ws-auth-': 'security',
  'crypto-': 'security',
  'injection-': 'security',
  'xss-': 'security',
  'integrity-': 'security',
  // Ruff S* codes are bandit-equivalent security
  'S6': 'security',
  'S1': 'security',
  // Bugs
  'F': 'bug',           // Ruff F-codes (pyflakes)
  'B': 'bug',           // Ruff B-codes (bugbear)
  'bug-': 'bug',        // DecodeMind bug-* rules
  'llm-': 'bug',        // DecodeMind llm-* rules (hallucinations, deprecated APIs)
  // Logic
  'logic-': 'logic',
  // Quality
  'E5': 'quality',      // E501 line too long etc.
  'UP': 'quality',
  'C9': 'quality',
  'quality-': 'quality',
};

export function categorizeFinding(ruleId: string | null): FindingCategory {
  if (!ruleId) return 'quality';
  for (const prefix of Object.keys(CATEGORY_PREFIXES)) {
    if (ruleId.startsWith(prefix)) return CATEGORY_PREFIXES[prefix];
  }
  // Default: ruleId like 'no-unused-vars' or 'eqeqeq' from ESLint → bug/quality
  if (ruleId.startsWith('no-')) return 'bug';
  if (ruleId === 'eqeqeq') return 'bug';
  return 'quality';
}

export function computeNoiseScore(findings: ReportFinding[]): number {
  if (findings.length === 0) return 0;
  const actionable = findings.filter(
    (f) => f.category === 'security' || f.category === 'bug' || f.category === 'logic',
  ).length;
  return 1 - actionable / findings.length;
}

export function groupByCategory(findings: ReportFinding[]): Record<FindingCategory, ReportFinding[]> {
  const groups: Record<FindingCategory, ReportFinding[]> = {
    security: [],
    bug: [],
    logic: [],
    quality: [],
  };
  for (const f of findings) groups[f.category].push(f);
  return groups;
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

export function sortBySeverity(findings: ReportFinding[]): ReportFinding[] {
  return [...findings].sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return (a.file ?? '').localeCompare(b.file ?? '');
  });
}
