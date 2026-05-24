export interface GrammarSource {
  language: string;     // matches the lang string passed to ast-grep parse()
  packagePath: string;  // npm path resolved with require.resolve() to locate .wasm
}

/**
 * Where each tree-sitter grammar binary comes from.
 *
 * IMPORTANT — wasm format compatibility:
 *
 * `web-tree-sitter@0.26+` (peer-dep of `@ast-grep/wasm@0.42`) requires
 * grammars compiled with the modern `dylink.0` custom-section format.
 * The `tree-sitter-wasms@0.1.13` package on npm still ships grammars with
 * the legacy `dylink` section, which causes:
 *
 *   Error: need dylink section
 *     at getDylinkMetadata (web-tree-sitter.js)
 *     at Language.load
 *
 * at runtime when ast-grep tries to load them in the browser.
 *
 * `@vscode/tree-sitter-wasm@0.3+` ships grammars compiled against modern
 * web-tree-sitter and uses `dylink.0`. We prefer it for every language
 * they ship (python, ts, js, css, java, c-sharp, php, go, ruby, bash).
 *
 * For languages NOT in @vscode/tree-sitter-wasm (kotlin, swift, dart,
 * html, yaml as of 2026-05), the legacy `tree-sitter-wasms` grammars are
 * still wired but will fail to load at runtime. The ast-grep dispatch
 * catches that error per-rule and surfaces it as a warning rather than
 * crashing the whole scan — those languages just won't get findings
 * until we rebuild their grammars against modern tree-sitter (V2.2).
 */
export const GRAMMAR_REGISTRY: GrammarSource[] = [
  // V1 — VS Code package provides modern python / js / ts / css
  { language: 'python',     packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-python.wasm' },
  { language: 'typescript', packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm' },
  { language: 'javascript', packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-javascript.wasm' },
  { language: 'css',        packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-css.wasm' },
  // V2 enterprise back-end — all present in VS Code's package
  { language: 'java',       packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-java.wasm' },
  { language: 'c_sharp',    packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-c-sharp.wasm' },
  { language: 'php',        packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-php.wasm' },
  { language: 'go',         packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-go.wasm' },
  { language: 'ruby',       packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-ruby.wasm' },
  // V2 shell — bash is in VS Code's package
  { language: 'bash',       packagePath: '@vscode/tree-sitter-wasm/wasm/tree-sitter-bash.wasm' },
  // Languages NOT in VS Code's package — legacy tree-sitter-wasms grammars.
  // These will throw `need dylink section` at runtime. Wired so the rule
  // library loads; runtime errors are caught per-rule and surfaced as
  // warnings rather than crashing the scan. V2.2 backlog: rebuild
  // these grammars against modern tree-sitter.
  { language: 'html',       packagePath: 'tree-sitter-wasms/out/tree-sitter-html.wasm' },
  { language: 'kotlin',     packagePath: 'tree-sitter-wasms/out/tree-sitter-kotlin.wasm' },
  { language: 'swift',      packagePath: 'tree-sitter-wasms/out/tree-sitter-swift.wasm' },
  { language: 'dart',       packagePath: 'tree-sitter-wasms/out/tree-sitter-dart.wasm' },
  { language: 'yaml',       packagePath: 'tree-sitter-wasms/out/tree-sitter-yaml.wasm' },
];
