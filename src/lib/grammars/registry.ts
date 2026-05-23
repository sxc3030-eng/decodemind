export interface GrammarSource {
  language: string;     // matches the lang string passed to ast-grep parse()
  packagePath: string;  // npm path resolved with require.resolve() to locate .wasm
}

/**
 * All five V1 languages. JavaScript uses its own grammar (not TypeScript's) so
 * that JSX support works correctly at runtime.
 *
 * The files live in tree-sitter-wasms/out/<name>.wasm — there are no named
 * exports, so we resolve them as bare file paths via require.resolve().
 */
export const GRAMMAR_REGISTRY: GrammarSource[] = [
  // V1
  { language: 'python',     packagePath: 'tree-sitter-wasms/out/tree-sitter-python.wasm' },
  { language: 'typescript', packagePath: 'tree-sitter-wasms/out/tree-sitter-typescript.wasm' },
  { language: 'javascript', packagePath: 'tree-sitter-wasms/out/tree-sitter-javascript.wasm' },
  { language: 'html',       packagePath: 'tree-sitter-wasms/out/tree-sitter-html.wasm' },
  { language: 'css',        packagePath: 'tree-sitter-wasms/out/tree-sitter-css.wasm' },
  // V2 — enterprise back-end
  { language: 'java',       packagePath: 'tree-sitter-wasms/out/tree-sitter-java.wasm' },
  { language: 'c_sharp',    packagePath: 'tree-sitter-wasms/out/tree-sitter-c_sharp.wasm' },
  { language: 'php',        packagePath: 'tree-sitter-wasms/out/tree-sitter-php.wasm' },
  { language: 'go',         packagePath: 'tree-sitter-wasms/out/tree-sitter-go.wasm' },
  { language: 'ruby',       packagePath: 'tree-sitter-wasms/out/tree-sitter-ruby.wasm' },
  // V2 — mobile
  { language: 'kotlin',     packagePath: 'tree-sitter-wasms/out/tree-sitter-kotlin.wasm' },
  { language: 'swift',      packagePath: 'tree-sitter-wasms/out/tree-sitter-swift.wasm' },
  { language: 'dart',       packagePath: 'tree-sitter-wasms/out/tree-sitter-dart.wasm' },
  // V2 — infra / shell
  { language: 'bash',       packagePath: 'tree-sitter-wasms/out/tree-sitter-bash.wasm' },
  { language: 'yaml',       packagePath: 'tree-sitter-wasms/out/tree-sitter-yaml.wasm' },
];
