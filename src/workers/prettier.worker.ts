/// <reference lib="webworker" />
import prettier from 'prettier/standalone';
import parserBabel from 'prettier/plugins/babel';
import parserEstree from 'prettier/plugins/estree';
import parserTypescript from 'prettier/plugins/typescript';
import parserHtml from 'prettier/plugins/html';
import parserCss from 'prettier/plugins/postcss';

export interface PrettierRequest {
  type: 'format';
  source: string;
  // Note: 'babel' parser also handles JSON. Markdown is intentionally out of
  // scope for Phase 0 — add 'markdown' here and import prettier/plugins/markdown
  // when that scope expands.
  parser: 'babel' | 'typescript' | 'html' | 'css';
}

export type PrettierResponse =
  | { type: 'result'; formatted: string; changed: boolean; elapsedMs: number }
  | { type: 'error'; message: string };

// TODO(V1): lazy-load plugins by parser type to shrink the worker's initial
// bundle. For Phase 0 we eagerly load all five to keep the message handler
// synchronous and predictable.
const ALL_PLUGINS = [parserBabel, parserEstree, parserTypescript, parserHtml, parserCss];

self.onmessage = async (event: MessageEvent<PrettierRequest>) => {
  if (event.data.type !== 'format') return;
  const start = performance.now();
  try {
    const formatted = await prettier.format(event.data.source, {
      parser: event.data.parser,
      plugins: ALL_PLUGINS,
    });
    const elapsedMs = Math.round(performance.now() - start);
    self.postMessage({
      type: 'result',
      formatted,
      changed: formatted !== event.data.source,
      elapsedMs,
    } satisfies PrettierResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message } satisfies PrettierResponse);
  }
};
