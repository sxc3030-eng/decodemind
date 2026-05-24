// EXPECTED FINDINGS:
// - line 15: crypto-hardcoded-secret — security — Hardcoded API token literal
// - line 18: injection-js-eval — security — eval() on user input
// - line 22: injection-js-innerhtml — security — innerHTML assignment with variable
// - line 26: xss-document-write — security — document.write with user input
// - line 30: xss-set-attribute-onevent — security — setAttribute with onevent attribute
// - line 34: crypto-md5-js — security — crypto.createHash('md5') weak hash
// - line 38: crypto-jwt-none-alg — security — JWT verified with 'none' algorithm
// - line 42: bug-loose-equality — bug — using == instead of ===
// - line 46: bug-array-includes-NaN — bug — Array.includes(NaN)
// - line 50: quality-console-log-prod — quality — console.log in production

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const API_TOKEN = "sk-LIVE-XXXXxxxx9999";

function calc(expr) {
  return eval(expr);
}

function render(el, userHtml) {
  el.innerHTML = userHtml;
}

function inject(payload) {
  document.write(payload);
}

function bindHandler(el, payload) {
  el.setAttribute("onclick", payload);
}

function fingerprint(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

function verifyToken(token, secret) {
  return jwt.verify(token, secret, { algorithms: ['none'] });
}

function checkValue(a, b) {
  return a == b;
}

function hasMissing(arr) {
  return arr.includes(NaN);
}

function debugTrace(value) {
  console.log("trace", value);
}

module.exports = { calc, render, inject, bindHandler, fingerprint, verifyToken, checkValue, hasMissing, debugTrace };
