/// <reference lib="webworker" />
// Adjusted from spec: real exports are { initializeTreeSitter, registerDynamicLanguage, parse }
// not { initializeAstGrep, parseFiles }. The Language type is a plain string, not an exported type.
// Source: node_modules/@ast-grep/wasm/wasm.d.ts
import { initializeTreeSitter, registerDynamicLanguage, parse } from '@ast-grep/wasm';
import { parse as parseYaml } from 'yaml';

/** Two request kinds:
 *  - `warmup` initializes tree-sitter + registers a language grammar without
 *    running any rule. Eliminates the first-real-rule timeout on cold load.
 *  - `scan` runs one rule against all provided files. */
export type AstGrepRequest =
  | { type: 'warmup'; languages: string[] }
  | { type: 'scan'; files: { path: string; content: string; language: string }[]; ruleYaml: string };

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
  | { type: 'warmed'; elapsedMs: number; languages: string[] }
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
  // ── Warmup branch ──────────────────────────────────────────────────────────
  // Pre-loads tree-sitter + every grammar requested. Caller runs this BEFORE
  // dispatching real rules so the first real rule doesn't pay the
  // ~30-60 second cold-load cost (web-tree-sitter ESM transform + WASM
  // compile + grammar fetch) and time out under the 60s safety wall.
  if (event.data.type === 'warmup') {
    const wStart = performance.now();
    try {
      const langs = event.data.languages.map((l) => l.toLowerCase());
      await ensureInit(langs);
      const elapsedMs = Math.round(performance.now() - wStart);
      self.postMessage({ type: 'warmed', elapsedMs, languages: langs } satisfies AstGrepResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', message } satisfies AstGrepResponse);
    }
    return;
  }
  if (event.data.type !== 'scan') return;
  try {
    const languages = [...new Set(event.data.files.map((f) => f.language.toLowerCase()))];
    await ensureInit(languages);

    const { id: ruleId, rule, constraints, utils } = parseRuleYaml(event.data.ruleYaml);

    // `@ast-grep/wasm`'s `SgNode.findAll(matcher)` accepts either a rule
    // object (just the matcher) OR a NapiConfig that also includes
    // constraints/utils. The NapiConfig shape requires `rule` to be a
    // top-level key alongside `constraints` and `utils`. Spreading the
    // matcher fields flat ("kind: call, pattern: …") makes findAll think
    // they're TOP-LEVEL config fields and rejects with "rule is not
    // configured correctly". So keep the wrapped form.
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
