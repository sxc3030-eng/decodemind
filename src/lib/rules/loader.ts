import { parse as parseYaml } from 'yaml';

export type RuleSeverity = 'error' | 'warning' | 'info';
export type RuleCategory = 'security' | 'bug' | 'logic' | 'quality';

export interface AstGrepRule {
  id: string;
  language: string;     // 'python', 'typescript', etc.
  category: RuleCategory;
  severity: RuleSeverity;
  message: string;
  rule: Record<string, unknown>; // ast-grep rule object — passed directly to findAll
  /** Top-level constraints object (ast-grep YAML schema). May be undefined. */
  constraints?: Record<string, unknown>;
  /** Top-level utils object (ast-grep YAML schema). May be undefined. */
  utils?: Record<string, unknown>;
}

export interface RuleLoadError {
  source: string;
  error: string;
}

export function parseRule(source: string, sourceName = '<inline>'): AstGrepRule {
  const obj = parseYaml(source);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error(`${sourceName}: rule is not a valid YAML object`);
  }
  const o = obj as Record<string, unknown>;
  const requireField = <T>(key: string, type: string): T => {
    const v = o[key];
    if (typeof v !== type) {
      throw new Error(`${sourceName}: missing or wrong-type '${key}' (expected ${type})`);
    }
    return v as T;
  };
  const id = requireField<string>('id', 'string');
  const language = requireField<string>('language', 'string');
  const category = requireField<string>('category', 'string') as RuleCategory;
  const severity = (o.severity ?? 'warning') as RuleSeverity;
  const message = requireField<string>('message', 'string');
  const rule = o.rule;
  if (!rule || typeof rule !== 'object') {
    throw new Error(`${sourceName}: missing or invalid 'rule' object`);
  }
  if (!['security', 'bug', 'logic', 'quality'].includes(category)) {
    throw new Error(`${sourceName}: invalid category '${category}'`);
  }
  if (!['error', 'warning', 'info'].includes(severity)) {
    throw new Error(`${sourceName}: invalid severity '${severity}'`);
  }
  // Constraints + utils live at TOP LEVEL of the YAML (sibling of `rule:`)
  // per the official ast-grep schema. Preserve them so the worker can pass
  // them alongside the rule matcher to findAll(); without these, every
  // hardcoded-secret / weak-pattern rule with regex constraints falls back
  // to "match every assignment" — useless.
  const constraints = (o.constraints && typeof o.constraints === 'object')
    ? (o.constraints as Record<string, unknown>)
    : undefined;
  const utils = (o.utils && typeof o.utils === 'object')
    ? (o.utils as Record<string, unknown>)
    : undefined;
  return {
    id,
    language: language.toLowerCase(),
    category,
    severity,
    message,
    rule: rule as Record<string, unknown>,
    ...(constraints ? { constraints } : {}),
    ...(utils ? { utils } : {}),
  };
}

export function parseRules(sources: { name: string; text: string }[]): { rules: AstGrepRule[]; errors: RuleLoadError[] } {
  const rules: AstGrepRule[] = [];
  const errors: RuleLoadError[] = [];
  for (const s of sources) {
    try {
      rules.push(parseRule(s.text, s.name));
    } catch (err) {
      errors.push({ source: s.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { rules, errors };
}
