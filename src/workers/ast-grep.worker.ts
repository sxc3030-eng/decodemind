/// <reference lib="webworker" />
// Adjusted from spec: real exports are { initializeTreeSitter, registerDynamicLanguage, parse }
// not { initializeAstGrep, parseFiles }. The Language type is a plain string, not an exported type.
// Source: node_modules/@ast-grep/wasm/wasm.d.ts
import { initializeTreeSitter, registerDynamicLanguage, parse } from '@ast-grep/wasm';

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
 * Minimal YAML parser for the ast-grep rule format used by this worker.
 *
 * The real @ast-grep/wasm API does NOT accept raw YAML strings — SgNode.findAll()
 * takes a JS rule-config object (same shape as YAML but as plain JS). This helper
 * parses the YAML subset used by DecodeMind's seed rules.
 *
 * Supported shape (matches llm-fake-pandas-method.yml exactly):
 *   id: <string>
 *   rule:
 *     pattern: <string>
 *     constraints:
 *       <VAR>:
 *         regex: '<string>'
 *
 * Throws if `pattern` is missing — a silent empty pattern would produce zero
 * matches and look like a successful scan.
 */
function parseRuleYaml(yaml: string): { id: string; rule: Record<string, unknown> } {
  const idMatch = yaml.match(/^id:\s*(.+)$/m);
  const id = idMatch ? idMatch[1].trim() : 'unknown';

  const patternMatch = yaml.match(/^\s*pattern:\s*(.+)$/m);
  const rulePattern = patternMatch ? patternMatch[1].trim() : '';
  if (!rulePattern) {
    throw new Error(`parseRuleYaml: could not extract 'pattern' from rule YAML`);
  }

  const constraints: Record<string, Record<string, string>> = {};
  const constraintsBlockMatch = yaml.match(/constraints:\s*\n([\s\S]*?)(?=\n\S|$)/);
  if (constraintsBlockMatch) {
    const block = constraintsBlockMatch[1];
    const entryRe = /^\s{2,4}(\w+):\s*\n\s{4,8}(\w+):\s*['"]?(.*?)['"]?\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = entryRe.exec(block)) !== null) {
      const [, varName, key, value] = m;
      constraints[varName] = { [key]: value };
    }
  }

  const rule: Record<string, unknown> = { pattern: rulePattern };
  if (Object.keys(constraints).length > 0) {
    rule.constraints = constraints;
  }
  return { id, rule };
}

self.onmessage = async (event: MessageEvent<AstGrepRequest>) => {
  if (event.data.type !== 'scan') return;
  try {
    const languages = [...new Set(event.data.files.map((f) => f.language.toLowerCase()))];
    await ensureInit(languages);

    const { id: ruleId, rule } = parseRuleYaml(event.data.ruleYaml);

    const scanStart = performance.now();
    const matches: AstGrepMatch[] = [];
    for (const file of event.data.files) {
      // Adjusted from spec: parse(lang, src) → SgRoot (synchronous, not parseFiles([...]))
      const sgRoot = parse(file.language.toLowerCase(), file.content);
      // Adjusted from spec: SgRoot has no findAll(); must call .root() first.
      const found = sgRoot.root().findAll({ rule });
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
