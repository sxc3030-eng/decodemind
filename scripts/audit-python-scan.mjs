#!/usr/bin/env node
/**
 * scripts/audit-python-scan.mjs
 *
 * Headless simulation of the DecodeMind V2.1 ast-grep dispatch.
 *
 * What it does:
 *  1. Walks src/lib/rules/definitions/ (and one level of subdirectories), loads
 *     every .yml file, parses with the `yaml` package, and filters to rules
 *     whose `language:` is Python (case-insensitive).
 *  2. For each Python rule, writes the YAML to a tempfile and shells out to
 *     `npx ast-grep scan --rule <tmp>` against the target file. Captures
 *     stdout/stderr and reports MATCH / NO-MATCH / ERROR with the line range.
 *  3. Also runs Ruff (via the official Python pip-installed `ruff` if on PATH,
 *     otherwise prints SKIPPED with a note) so we can compare against the
 *     user's reported 2 findings.
 *
 * Usage:
 *   node scripts/audit-python-scan.mjs [target-file]
 *
 * Default target: tests/fixtures/python/broken_python.py
 *
 * Exit code: 0 always (audit, not a test).
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const DEFS = join(ROOT, 'src', 'lib', 'rules', 'definitions');
const TARGET = resolve(process.argv[2] ?? join(ROOT, 'tests', 'fixtures', 'python', 'broken_python.py'));

function listYamlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      // one-level recursion is enough — V2 lays out rules as definitions/<lang>/*.yml
      for (const sub of readdirSync(full)) {
        if (sub.endsWith('.yml')) out.push(join(full, sub));
      }
    } else if (entry.endsWith('.yml')) {
      out.push(full);
    }
  }
  return out;
}

function loadPythonRules() {
  const files = listYamlFiles(DEFS);
  const rules = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (e) {
      console.error(`[load] cannot read ${file}: ${e.message}`);
      continue;
    }
    let obj;
    try {
      obj = parseYaml(text);
    } catch (e) {
      console.error(`[parse] ${file}: ${e.message}`);
      continue;
    }
    if (!obj || typeof obj !== 'object') continue;
    const lang = String(obj.language ?? '').toLowerCase();
    if (lang !== 'python') continue;
    rules.push({ file, text, id: obj.id, lang, category: obj.category, severity: obj.severity, rule: obj.rule });
  }
  return rules.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The ast-grep CLI (and napi/wasm) require `constraints` to live at the TOP
 * LEVEL of the rule config — sibling of `rule:` — not nested under it. The
 * worker's call `findAll({ rule })` drops constraints on the floor regardless.
 *
 * Rewrite the YAML to lift `constraints` so the CLI can actually evaluate it,
 * then re-stringify for the spawn. This simulates "what V2.1 would catch IF
 * the worker were fixed to forward constraints."
 */
function normalizeRule(ruleText) {
  // Naive but effective lift: detect "  constraints:" lines indented by 2
  // spaces (nested under rule:) and dedent the constraints block to col 0.
  const lines = ruleText.split(/\r?\n/);
  const out = [];
  let inNestedConstraints = false;
  let baseIndent = 0;
  for (const line of lines) {
    const m = /^( {2})constraints:\s*$/.exec(line);
    if (m) {
      inNestedConstraints = true;
      baseIndent = 2;
      out.push('constraints:');
      continue;
    }
    if (inNestedConstraints) {
      // Continuation of the nested constraints block: lines must be indented
      // strictly deeper than baseIndent (e.g. "    VAR:" at 4 spaces).
      if (line.length === 0 || /^\s+/.test(line.slice(0, baseIndent + 1))) {
        // dedent by baseIndent spaces if possible
        out.push(line.startsWith(' '.repeat(baseIndent)) ? line.slice(baseIndent) : line);
        continue;
      } else {
        inNestedConstraints = false;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function runAstGrep(ruleText) {
  // Write to a temp file because --inline-rules has quoting issues on Windows shells.
  const dir = mkdtempSync(join(tmpdir(), 'dm-audit-'));
  const rulePath = join(dir, 'rule.yml');
  writeFileSync(rulePath, normalizeRule(ruleText), 'utf8');
  try {
    const r = spawnSync('npx', ['--no-install', 'ast-grep', 'scan', '--rule', rulePath, '--json=stream', TARGET], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32', // .cmd shims on Windows need a shell
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', normalizedYaml: normalizeRule(ruleText) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function parseAstGrepJson(stdout) {
  // --json=stream emits one JSON object per line. (Output is JSON array if you use --json without `=stream`.)
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const matches = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (Array.isArray(obj)) {
        matches.push(...obj);
      } else {
        matches.push(obj);
      }
    } catch {
      // ignore non-JSON noise
    }
  }
  return matches;
}

function fmtRange(m) {
  const r = m.range;
  if (!r) return '?';
  return `L${r.start.line + 1}:${r.start.column + 1}-L${r.end.line + 1}:${r.end.column + 1}`;
}

function runRuff() {
  // Try the system `ruff` (pip-installed) — it's the same engine ruff-wasm-web wraps.
  const probe = spawnSync('ruff', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (probe.status !== 0) {
    return { available: false, note: 'ruff not on PATH (skipped) — install with `pip install ruff` to compare locally' };
  }
  // Default Ruff config: only E/F enabled. We must explicitly enable S (bandit) rules.
  const r = spawnSync(
    'ruff',
    ['check', '--select', 'E,F,W,S', '--output-format', 'json', TARGET],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  );
  let parsed = [];
  try {
    parsed = JSON.parse(r.stdout || '[]');
  } catch {
    /* leave parsed empty */
  }
  return {
    available: true,
    version: probe.stdout.trim(),
    status: r.status,
    findings: parsed,
    stderr: r.stderr,
  };
}

// ---------- Main ----------

console.log('='.repeat(78));
console.log(' DecodeMind V2.1 Python rule audit');
console.log('='.repeat(78));
console.log(`Target file : ${TARGET}`);
console.log(`Rules dir   : ${DEFS}`);
console.log('');

const rules = loadPythonRules();
console.log(`Loaded ${rules.length} Python rules.\n`);

const results = [];
for (const rule of rules) {
  const r = runAstGrep(rule.text);
  const matches = parseAstGrepJson(r.stdout);
  const status =
    r.status !== 0 && matches.length === 0
      ? 'ERROR'
      : matches.length > 0
        ? 'MATCH'
        : 'NO-MATCH';
  results.push({ rule, status, matches, raw: r });
  const pattern = typeof rule.rule?.pattern === 'string'
    ? rule.rule.pattern
    : JSON.stringify(rule.rule).slice(0, 90);
  const tag = status === 'MATCH' ? 'MATCH   ' : status === 'NO-MATCH' ? 'no-match' : 'ERROR   ';
  const locs = matches.map(fmtRange).join(' ');
  console.log(`[${tag}] ${rule.id.padEnd(40)} ${pattern}${locs ? '   ' + locs : ''}`);
  if (status === 'ERROR' && r.stderr) {
    const firstLine = r.stderr.split(/\r?\n/)[0];
    console.log(`           stderr: ${firstLine}`);
  }
}

console.log('\n' + '-'.repeat(78));
console.log(' Summary by status');
console.log('-'.repeat(78));
const matched = results.filter((r) => r.status === 'MATCH');
const nomatch = results.filter((r) => r.status === 'NO-MATCH');
const errored = results.filter((r) => r.status === 'ERROR');
console.log(`MATCH    : ${matched.length}`);
console.log(`NO-MATCH : ${nomatch.length}`);
console.log(`ERROR    : ${errored.length}`);

console.log('\nMatched rules:');
for (const m of matched) {
  for (const hit of m.matches) {
    console.log(`  ${m.rule.id}  ${fmtRange(hit)}  text="${(hit.text || '').replace(/\s+/g, ' ').slice(0, 60)}"`);
  }
}

console.log('\n' + '-'.repeat(78));
console.log(' Ruff comparison');
console.log('-'.repeat(78));
const ruff = runRuff();
if (!ruff.available) {
  console.log(ruff.note);
} else {
  console.log(`Ruff ${ruff.version}, exit status ${ruff.status}`);
  console.log(`Findings: ${ruff.findings.length}`);
  for (const f of ruff.findings) {
    console.log(`  ${f.code ?? '?'}  L${f.location?.row ?? '?'}:${f.location?.column ?? '?'}  ${f.message}`);
  }
  if (ruff.stderr) {
    console.log('stderr:\n' + ruff.stderr.split('\n').slice(0, 5).map((l) => '  ' + l).join('\n'));
  }
}

console.log('\nDone.');
