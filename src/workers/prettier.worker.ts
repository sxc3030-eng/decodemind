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
  parser: 'babel' | 'typescript' | 'html' | 'css';
}

export interface PrettierResponse {
  type: 'result';
  formatted: string;
  changed: boolean;
  elapsedMs: number;
}

self.onmessage = async (event: MessageEvent<PrettierRequest>) => {
  if (event.data.type !== 'format') return;
  const start = Date.now();
  const formatted = await prettier.format(event.data.source, {
    parser: event.data.parser,
    plugins: [parserBabel, parserEstree, parserTypescript, parserHtml, parserCss],
  });
  const elapsedMs = Date.now() - start;
  const response: PrettierResponse = {
    type: 'result',
    formatted,
    changed: formatted !== event.data.source,
    elapsedMs,
  };
  self.postMessage(response);
};
