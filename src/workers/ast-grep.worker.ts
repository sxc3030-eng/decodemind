/// <reference lib="webworker" />
// Adjusted from spec: real exports are { initializeTreeSitter, registerDynamicLanguage, parse }
// not { initializeAstGrep, parseFiles }. The Language type is a plain string, not an exported type.
// Source: node_modules/@ast-grep/wasm/wasm.d.ts
import { initializeTreeSitter, registerDynamicLanguage, parse } from '@ast-grep/wasm';
import { parse as parseYaml } from 'yaml';

export interface AstGrepRequest {
  type: 'scan';
  // Adjusted from spec: Language is string, not an imported type (no Language export in wasm.d.ts)
  files: { path: string; content: string; language: string }[];
  ruleYaml: string;
}

export interface AstGrepMatch {
  ruleId: string;
  file: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  text: string;
}

export type AstGrepResponse =
  | { type: 'result'; matches: AstGrepMatch[]; elapsedMs: number }
  | { type: 'error'; message: string };

let treeInitialized = false;
let treeInitPromise: Promise<void> | null = null;
const registeredLanguages = new Set<string>();

// Adjusted from spec: real init function is initializeTreeSitter(), not initializeAstGrep().
// Additionally, registerDynamicLanguage() must be called once per language to load that
// language's tree-sitter WASM grammar before parse() can be invoked. The grammar files
// must be served from the app's root (e.g. /tree-sitter-python.wasm) — Vite must copy
// them into public/ or serve them via a configured CDN before this worker is invoked.
async function ensureInit(languages: string[]): Promise<void> {
  const newLangs = languages.filter((l) => !registeredLanguages.has(l));

  if (!treeInitialized) {
    if (!treeInitPromise) {
      treeInitPromise = initializeTreeSitter().catch((err) => {
        treeInitPromise = null; // allow retry on next message
        throw err;
      });
    }
    await treeInitPromise;
    treeInitialized = true;
  }

  if (newLangs.length > 0) {
    const langMap: Record<string, { libraryPath: string }> = {};
    for (const lang of newLangs) {
      langMap[lang] = { libraryPath: `/tree-sitter-${lang}.wasm` };
    }
    await registerDynamicLanguage(langMap);
    newLangs.forEach((l) => registeredLanguages.add(l));
  }
}

/**
 * Full YAML parser for ast-grep rules. Replaces the V1 regex-based parser
 * which couldn't handle V2 rule shapes (any, all, kind, inside, has, not).
 *
 * The real @ast-grep/wasm API does NOT accept raw YAML strings — SgNode.findAll()
 * takes a NapiConfig: `{ rule, constraints?, utils? }`. CRITICALLY, `constraints`
 * and `utils` are TOP-LEVEL siblings of `rule`, NOT children. V1 and V2 rule
 * authors wrote them as `rule.constraints:` (one level too deep) and the V2.1
 * dispatch bug silently dropped them.
 *
 * This parser handles BOTH shapes:
 *  - Schema A (DecodeMind's authored YAMLs): constraints/utils nested under rule
 *  - Schema B (ast-grep official): constraints/utils at top level
 *
 * Throws if the YAML is malformed or `rule` is missing.
 */
function parseRuleYaml(yaml: string): {
  id: string;
  rule: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  utils?: Record<string, unknown>;
} {
  const obj = parseYaml(yaml) as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') {
    throw new Error('parseRuleYaml: YAML did not parse to an object');
  }
  const id = typeof obj.id === 'string' ? obj.id : 'unknown';
  const rawRule = obj.rule;
  if (!rawRule || typeof rawRule !== 'object') {
    throw new Error(`parseRuleYaml: missing or invalid 'rule' object in ${id}`);
  }
  const ruleObj = rawRule as Record<string, unknown>;

  // Lift constraints/utils out of rule.* into top-level. The ast-grep YAML
  // grammar puts them at top level; DecodeMind's rule authors put them inside
  // rule. Either is accepted now — we normalize to top-level for findAll().
  const constraints =
    (ruleObj.constraints as Record<string, unknown> | undefined) ??
    (obj.constraints as Record<string, unknown> | undefined);
  const utils =
    (ruleObj.utils as Record<string, unknown> | undefined) ??
    (obj.utils as Record<string, unknown> | undefined);

  // Strip constraints/utils from the rule body so findAll only sees the
  // matcher (pattern/kind/any/all/inside/has/not/etc.).
  const { constraints: _c, utils: _u, ...ruleOnly } = ruleObj;
  void _c; void _u;

  return { id, rule: ruleOnly, ...(constraints ? { constraints } : {}), ...(utils ? { utils } : {}) };
}

self.onmessage = async (event: MessageEvent<AstGrepRequest>) => {
  if (event.data.type !== 'scan') return;
  try {
    const languages = [...new Set(event.data.files.map((f) => f.language.toLowerCase()))];
    await ensureInit(languages);

    const { id: ruleId, rule, constraints, utils } = parseRuleYaml(event.data.ruleYaml);

    // Build the NapiConfig: rule + (optionally) top-level constraints/utils.
    // Without these, every meta-var regex constraint is silently dropped and
    // patterns like `$VAR = $VALUE` would match every assignment in the file
    // (huge false-positive blast). This was the V2.1 critical bug.
    const matcher: Record<string, unknown> = { rule };
    if (constraints) matcher.constraints = constraints;
    if (utils) matcher.utils = utils;

    const scanStart = performance.now();
    const matches: AstGrepMatch[] = [];
    for (const file of event.data.files) {
      // Adjusted from spec: parse(lang, src) → SgRoot (synchronous, not parseFiles([...]))
      const sgRoot = parse(file.language.toLowerCase(), file.content);
      // Adjusted from spec: SgRoot has no findAll(); must call .root() first.
      const found = sgRoot.root().findAll(matcher);
      for (const node of found) {
        const range = node.range();
        matches.push({
          ruleId,
          file: file.path,
          startLine: range.start.line + 1,
          endLine: range.end.line + 1,
          startColumn: range.start.column + 1,
          endColumn: range.end.column + 1,
          text: node.text(),
        });
      }
    }
    const elapsedMs = Math.round(performance.now() - scanStart);
    self.postMessage({ type: 'result', matches, elapsedMs } satisfies AstGrepResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message } satisfies AstGrepResponse);
  }
};
