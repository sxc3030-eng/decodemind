/**
 * V2.1 rules loader — discovers every ast-grep YAML rule at build time and
 * groups them by tree-sitter language string.
 *
 * Uses Vite's `import.meta.glob` with `eager: true` + `query: '?raw'` so each
 * YAML file is bundled as a raw string. This sidesteps Vite's default JSON/YAML
 * import handling and lets us keep validation in one place (loader.ts).
 *
 * The glob picks up V1 rules in `src/lib/rules/definitions/*.yml` AND V2 rules
 * in `src/lib/rules/definitions/<lang>/*.yml` automatically.
 */

import { parseRules, type AstGrepRule } from './loader';

/**
 * Map a YAML `language:` value (as written by rule authors — "Java", "Kotlin",
 * "C#") to the tree-sitter language string the ast-grep worker uses (lowercase,
 * matching the `tree-sitter-<name>.wasm` filename).
 *
 * The worker registers grammars by these strings, so this map must stay in
 * sync with GRAMMAR_REGISTRY in src/lib/grammars/registry.ts.
 */
export const YAML_LANG_TO_TREESITTER: Record<string, string> = {
  // V1
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  html: 'html',
  css: 'css',
  // V2 enterprise back-end
  java: 'java',
  'c#': 'c_sharp',
  csharp: 'c_sharp',
  php: 'php',
  go: 'go',
  ruby: 'ruby',
  // V2 mobile
  kotlin: 'kotlin',
  swift: 'swift',
  dart: 'dart',
  // V2 shell
  bash: 'bash',
  // YAML rules use the regex scanner, not ast-grep — listed for completeness
  yaml: 'yaml',
};

/**
 * Map a file extension to the tree-sitter language string. Used to decide
 * which rules apply to which files at scan time.
 */
export const EXT_TO_TREESITTER: Record<string, string> = {
  '.py': 'python',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'css',
  // V2
  '.java': 'java',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.swift': 'swift',
  '.dart': 'dart',
  '.cs': 'c_sharp',
  '.php': 'php',
  '.go': 'go',
  '.rb': 'ruby',
  '.sh': 'bash', '.bash': 'bash',
};

/** Load every YAML rule, keyed by source path. */
function loadRuleSources(): { name: string; text: string }[] {
  // Vite's static analyzer for `import.meta.glob` only resolves literal
  // RELATIVE paths reliably. `@/` aliases will silently return an empty map
  // in some build modes, which makes ast-grep dispatch fire with zero rules.
  // Use a relative path from this file's own location.
  const mods = import.meta.glob<string>(
    './definitions/**/*.yml',
    { eager: true, query: '?raw', import: 'default' },
  );
  return Object.entries(mods).map(([name, text]) => ({ name, text }));
}

let cachedRules: AstGrepRule[] | null = null;
let cachedByLang: Map<string, AstGrepRule[]> | null = null;
let cachedErrors: { source: string; error: string }[] = [];

/** Parse and cache all rules. Idempotent — first call does the work. */
function ensureLoaded(): void {
  if (cachedRules !== null) return;
  const sources = loadRuleSources();
  const { rules, errors } = parseRules(sources);
  cachedRules = rules;
  cachedErrors = errors;

  // Group by tree-sitter language string. Rules whose YAML `language:` field
  // isn't recognized get dropped silently with a note in `cachedErrors`.
  const grouped = new Map<string, AstGrepRule[]>();
  for (const rule of rules) {
    const tsLang = YAML_LANG_TO_TREESITTER[rule.language];
    if (!tsLang) {
      cachedErrors.push({
        source: rule.id,
        error: `unknown YAML language '${rule.language}' — add it to YAML_LANG_TO_TREESITTER`,
      });
      continue;
    }
    // YAML rules use the regex scanner, not ast-grep — skip them.
    if (tsLang === 'yaml') continue;
    const bucket = grouped.get(tsLang);
    if (bucket) bucket.push(rule);
    else grouped.set(tsLang, [rule]);
  }
  cachedByLang = grouped;
}

/** All ast-grep rules across V1 + V2, parsed and validated. */
export function getAllRules(): AstGrepRule[] {
  ensureLoaded();
  return cachedRules ?? [];
}

/** Rules grouped by tree-sitter language (so worker calls only touch one grammar at a time). */
export function getRulesByLanguage(): Map<string, AstGrepRule[]> {
  ensureLoaded();
  return cachedByLang ?? new Map();
}

/** Rule-loading errors (malformed YAML, unknown language, etc.). */
export function getRuleLoadErrors(): { source: string; error: string }[] {
  ensureLoaded();
  return cachedErrors;
}

/**
 * Serialize a rule back to YAML for the ast-grep worker. The worker accepts
 * `ruleYaml` (string) and parses it internally — sending YAML keeps the worker
 * boundary tidy.
 */
export function ruleToYaml(rule: AstGrepRule): string {
  // The worker only reads `id` and `rule`, but we include `language` for
  // debugging clarity in case of a malformed call.
  const lines = [
    `id: ${rule.id}`,
    `language: ${rule.language}`,
    `rule:`,
  ];
  for (const [key, value] of Object.entries(rule.rule)) {
    lines.push(`  ${key}: ${typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value)}`);
  }
  return lines.join('\n');
}
