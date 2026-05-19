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
  { language: 'python',     packagePath: 'tree-sitter-wasms/out/tree-sitter-python.wasm' },
  { language: 'typescript', packagePath: 'tree-sitter-wasms/out/tree-sitter-typescript.wasm' },
  { language: 'javascript', packagePath: 'tree-sitter-wasms/out/tree-sitter-javascript.wasm' },
  { language: 'html',       packagePath: 'tree-sitter-wasms/out/tree-sitter-html.wasm' },
  { language: 'css',        packagePath: 'tree-sitter-wasms/out/tree-sitter-css.wasm' },
];
