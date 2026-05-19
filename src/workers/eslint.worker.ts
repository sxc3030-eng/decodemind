/// <reference lib="webworker" />
import { Linter } from 'eslint-linter-browserify';
import type { Linter as LinterType } from 'eslint';

export interface EslintRequest {
  type: 'lint';
  source: string;
  filename: string;
}

export interface EslintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  fatal?: boolean;
}

export type EslintResponse =
  | { type: 'result'; messages: EslintMessage[]; elapsedMs: number }
  | { type: 'error'; message: string };

const linter = new Linter();

// Common browser + ES2022 globals. Without this, `no-undef` flags `console`,
// `document`, `window`, `fetch`, `Promise`, etc. as errors on perfectly valid
// browser code, drowning real findings in noise. Inline keeps us from pulling
// the `globals` npm package.
const COMMON_GLOBALS: Record<string, 'readonly' | 'writable'> = {
  // Browser
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  location: 'readonly',
  history: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  // ES2022 (most are intrinsic but ESLint needs the hint)
  Promise: 'readonly',
  Map: 'readonly',
  Set: 'readonly',
  WeakMap: 'readonly',
  WeakSet: 'readonly',
  Symbol: 'readonly',
  Proxy: 'readonly',
  Reflect: 'readonly',
  BigInt: 'readonly',
  globalThis: 'readonly',
  // Node globals that show up frequently in mixed environments
  process: 'readonly',
  Buffer: 'readonly',
  // CommonJS globals — needed for .js files using require()/module.exports.
  // Without these, Node-style scripts get false-positive no-undef on every
  // module-level statement.
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
};

const ESM_CONFIG: LinterType.Config = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: COMMON_GLOBALS,
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'eqeqeq': 'warn',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-debugger': 'warn',
    'prefer-const': 'warn',
    'no-var': 'error',
  },
};

// Same rules, but for CommonJS files (.cjs or .js files using require()).
// sourceType: 'script' means top-level await is disallowed and CommonJS is
// the intended module system.
const CJS_CONFIG: LinterType.Config = {
  ...ESM_CONFIG,
  languageOptions: {
    ...ESM_CONFIG.languageOptions,
    sourceType: 'script',
  },
};

/**
 * Pick the right config for the file. CommonJS heuristic:
 *  - `.cjs` extension → CJS
 *  - Otherwise, peek at the source for a top-level `require(`/`module.exports`
 *    in the first 4 KB — that's a reliable CommonJS marker
 */
function pickConfig(filename: string, source: string): LinterType.Config {
  if (filename.endsWith('.cjs')) return CJS_CONFIG;
  const head = source.slice(0, 4096);
  if (/\brequire\s*\(/.test(head) || /\bmodule\.exports\b/.test(head)) {
    return CJS_CONFIG;
  }
  return ESM_CONFIG;
}

self.onmessage = (event: MessageEvent<EslintRequest>) => {
  if (event.data.type !== 'lint') return;
  const start = performance.now();
  try {
    const config = pickConfig(event.data.filename, event.data.source);
    const messages = linter.verify(
      event.data.source,
      config,
      event.data.filename,
    ) as EslintMessage[];
    const elapsedMs = Math.round(performance.now() - start);
    self.postMessage({ type: 'result', messages, elapsedMs } satisfies EslintResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message } satisfies EslintResponse);
  }
};
