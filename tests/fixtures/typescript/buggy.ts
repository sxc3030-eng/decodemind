// EXPECTED FINDINGS:
// - line 16: crypto-hardcoded-secret — security — Hardcoded SECRET literal
// - line 19: injection-js-eval — security — eval() on user input
// - line 23: injection-js-innerhtml — security — innerHTML assignment with variable
// - line 27: xss-document-write — security — document.write with user input
// - line 31: crypto-md5-js — security — crypto.createHash('md5') weak hash
// - line 35: crypto-jwt-none-alg — security — JWT verified with 'none' algorithm
// - line 39: logic-json-parse-no-try — logic — JSON.parse without try/catch
// - line 42: quality-any-type — quality — variable typed any
// - line 46: quality-no-jsdoc — quality — exported function without JSDoc
// - line 50: quality-console-log-prod — quality — console.log in production

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const SECRET: string = "supersecret-prod-key-2026";

export function calc(expr: string): unknown {
  return eval(expr);
}

export function renderHtml(el: HTMLElement, html: string): void {
  el.innerHTML = html;
}

export function inject(payload: string): void {
  document.write(payload);
}

export function fingerprint(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

export function verifyToken(token: string, secret: string): unknown {
  return jwt.verify(token, secret, { algorithms: ['none'] });
}

export function parseConfig(raw: string): unknown {
  return JSON.parse(raw);
}

export function legacyHandler(payload: any): void {
  console.error(payload);
}

export function fetchSomething(url: string): Promise<Response> {
  return fetch(url);
}

export function logTrace(message: string): void {
  console.log("trace:", message);
}
