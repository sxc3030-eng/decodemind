/// <reference lib="webworker" />
// Adjusted from spec: real exports are { initializeTreeSitter, registerDynamicLanguage, parse }
// not { initializeAstGrep, parseFiles }. The Language type is a plain string, not an exported type.
// Source: node_modules/@ast-grep/wasm/wasm.d.ts
import { initializeTreeSitter, registerDynamicLanguage, parse } from '@ast-grep/wasm';

export interface AstGrepRequest {
  type: 'scan';
  // Adjusted from spec: Language is string, not imported type (no Language export exists in wasm.d.ts)
  files: { path: string; content: string; language: string }[];
  ruleYaml: string;
}

export interface AstGrepMatch {
  ruleId: string;
  file: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface AstGrepResponse {
  type: 'result';
  matches: AstGrepMatch[];
  elapsedMs: number;
}

let initPromise: Promise<void> | null = null;

// Adjusted from spec: real init function is initializeTreeSitter(), not initializeAstGrep().
// Additionally, registerDynamicLanguage() must be called to load language WASM parsers
// before parse() can be invoked. At runtime the caller must ensure language parsers are
// accessible (e.g. /tree-sitter-python.wasm). The libraryPath is passed via the ruleYaml
// language field or hard-coded per language. For the spike, Python is the only target.
async function ensureInit(languages: string[]): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await initializeTreeSitter();
      // Register each unique language's WASM parser.
      // libraryPath must resolve to the tree-sitter-<lang>.wasm file at runtime.
      const langMap: Record<string, { libraryPath: string }> = {};
      for (const lang of languages) {
        langMap[lang] = { libraryPath: `/tree-sitter-${lang}.wasm` };
      }
      await registerDynamicLanguage(langMap);
    })();
  }
  return initPromise;
}

/**
 * Minimal YAML parser for the ast-grep rule format used by this worker.
 * Adjusted from spec: the real @ast-grep/wasm API does NOT accept raw YAML strings.
 * SgNode.findAll() takes a JS rule-config object (same shape as YAML but as plain JS),
 * not a { ruleYaml: string } wrapper. We parse the YAML subset here to bridge the gap.
 *
 * Supported shape (matches llm-fake-pandas-method.yml exactly):
 *   rule:
 *     pattern: <string>
 *     constraints:
 *       <VAR>:
 *         regex: '<string>'
 */
function parseRuleYaml(yaml: string): { id: string; rule: Record<string, unknown> } {
  // Extract id
  const idMatch = yaml.match(/^id:\s*(.+)$/m);
  const id = idMatch ? idMatch[1].trim() : 'unknown';

  // Extract pattern
  const patternMatch = yaml.match(/pattern:\s*(.+)/);
  const rulePattern = patternMatch ? patternMatch[1].trim() : '';

  // Extract constraints block: each "  <VAR>:\n    <key>: '<value>'"
  const constraints: Record<string, Record<string, string>> = {};
  const constraintsBlockMatch = yaml.match(/constraints:\s*\n([\s\S]*?)(?=\n\S|$)/);
  if (constraintsBlockMatch) {
    const block = constraintsBlockMatch[1];
    // Match entries like: "    METHOD:\n      regex: '...'"
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
  const start = Date.now();

  // Collect unique languages to register
  const languages = [...new Set(event.data.files.map((f) => f.language.toLowerCase()))];
  await ensureInit(languages);

  // Adjusted from spec: parseRuleYaml bridges YAML string → JS rule-config object
  const { id: ruleId, rule } = parseRuleYaml(event.data.ruleYaml);

  const matches: AstGrepMatch[] = [];
  for (const file of event.data.files) {
    // Adjusted from spec: real API is parse(lang, src) → SgRoot (synchronous, not parseFiles([...]))
    const sgRoot = parse(file.language.toLowerCase(), file.content);

    // Adjusted from spec: SgRoot does not have findAll(); must call .root() to get SgNode first.
    // findAll takes a JS matcher object, not { ruleYaml } string wrapper.
    const found = sgRoot.root().findAll({ rule });

    for (const node of found) {
      const range = node.range();
      // range().start.line and .end.line are 0-indexed; add 1 for 1-indexed lines.
      matches.push({
        ruleId,
        file: file.path,
        startLine: range.start.line + 1,
        endLine: range.end.line + 1,
        text: node.text(),
      });
    }
  }

  const elapsedMs = Date.now() - start;
  const response: AstGrepResponse = { type: 'result', matches, elapsedMs };
  self.postMessage(response);
};
