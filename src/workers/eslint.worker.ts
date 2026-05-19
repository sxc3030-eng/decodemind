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
};

const config: LinterType.Config = {
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

self.onmessage = (event: MessageEvent<EslintRequest>) => {
  if (event.data.type !== 'lint') return;
  const start = performance.now();
  try {
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
