/// <reference lib="webworker" />
import { Linter } from 'eslint-linter-browserify';

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
}

export interface EslintResponse {
  type: 'result';
  messages: EslintMessage[];
  elapsedMs: number;
}

const linter = new Linter();

const config = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'eqeqeq': 'warn',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-debugger': 'warn',
  },
};

self.onmessage = (event: MessageEvent<EslintRequest>) => {
  if (event.data.type !== 'lint') return;
  const start = Date.now();
  const messages = linter.verify(event.data.source, config as never, event.data.filename) as EslintMessage[];
  const elapsedMs = Date.now() - start;
  const response: EslintResponse = { type: 'result', messages, elapsedMs };
  self.postMessage(response);
};
