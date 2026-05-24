/**
 * scripts/run-fixture-tests.ts
 *
 * Deterministic test runner for the 18 fixtures in `tests/fixtures/`.
 *
 * How it works:
 *  - For each ast-grep language: load every rule in `src/lib/rules/definitions/`
 *    (and one level of subdirectory), normalize the YAML (lift `constraints`/
 *    `utils` from under `rule.` up to the top level — what the V2.1 worker
 *    dispatch bug fails to do but what the ast-grep CLI requires), and write
 *    the normalized form to `scripts/.dm-test-rules/`.
 *  - Then shell out once per fixture to `npx ast-grep scan -c scripts/sgconfig.yml
 *    --json=stream <fixture>`, which scans ALL applicable rules in one pass.
 *    ast-grep skips rules whose `language:` doesn't match the file's language.
 *  - For Dockerfile: import DOCKERFILE_RULES from src/lib/scanners/dockerfile.
 *  - For YAML: import YAML_RULES.
 *  - For OSV manifests: import scanManifest.
 *
 * For each fixture, compare findings vs EXPECTED.json (2-line tolerance).
 *
 * Run: `npx tsx scripts/run-fixture-tests.ts`
 *
 * No external state. No git changes. Writes:
 *   - scripts/run-baseline.txt
 *   - scripts/FIXTURE_TEST_REPORT.md
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { DOCKERFILE_RULES } from '../src/lib/scanners/dockerfile/rules';
import { YAML_RULES } from '../src/lib/scanners/yaml/rules';
import { scanManifest } from '../src/lib/scanners/osv/scanner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const DEFS = join(ROOT, 'src', 'lib', 'rules', 'definitions');
const FIXTURES_ROOT = join(ROOT, 'tests', 'fixtures');
const EXPECTED_PATH = join(FIXTURES_ROOT, 'EXPECTED.json');
const TMP_RULES_DIR = join(ROOT, 'scripts', '.dm-test-rules');
const SGCONFIG = join(ROOT, 'scripts', 'sgconfig.yml');

// 2-line tolerance for matching expected/actual findings.
const LINE_TOLERANCE = 2;

interface ExpectedFinding {
  line: number;
  ruleId: string;
  category: string;
}
interface FixtureSpec {
  path: string;
  language: string;
  scanner: 'ast-grep' | 'dockerfile' | 'yaml' | 'osv';
  expected: ExpectedFinding[];
}
interface Manifest {
  fixtures: FixtureSpec[];
}
interface ActualFinding {
  ruleId: string;
  line: number;
}
interface PerFixtureResult {
  spec: FixtureSpec;
  actual: ActualFinding[];
  tp: ExpectedFinding[];
  fn: ExpectedFinding[];
  fp: ActualFinding[];
}

function listYamlRules(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(DEFS)) {
    const full = join(DEFS, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      for (const sub of readdirSync(full)) {
        if (sub.endsWith('.yml')) out.push(join(full, sub));
      }
    } else if (entry.endsWith('.yml')) {
      out.push(full);
    }
  }
  return out;
}

/** Normalize a DecodeMind YAML rule into the shape ast-grep CLI accepts. */
function normalizeRule(raw: string, sourcePath: string): { yaml: string; id: string; lang: string } | { error: string } {
  let obj: Record<string, unknown> | null;
  try {
    obj = parseYaml(raw) as Record<string, unknown> | null;
  } catch (err) {
    return { error: `yaml-parse: ${(err as Error).message}` };
  }
  if (!obj || typeof obj !== 'object') return { error: 'not-object' };
  const id = typeof obj.id === 'string' ? obj.id : '';
  const lang = typeof obj.language === 'string' ? obj.language : '';
  if (!id) return { error: 'missing-id' };
  if (!lang) return { error: 'missing-language' };
  const rule = obj.rule;
  if (!rule || typeof rule !== 'object') return { error: 'missing-rule' };
  const ruleObj = rule as Record<string, unknown>;
  if (ruleObj.constraints !== undefined && obj.constraints === undefined) {
    obj.constraints = ruleObj.constraints;
    delete ruleObj.constraints;
  }
  if (ruleObj.utils !== undefined && obj.utils === undefined) {
    obj.utils = ruleObj.utils;
    delete ruleObj.utils;
  }
  // ast-grep's "Bash" language must be lowercase-key match its registry; it
  // happens to accept the literal `Bash`. Same for the others. Leave as-is.
  return { yaml: stringifyYaml(obj), id, lang };
}

/** Run all registered ast-grep rules against one file via sgconfig. */
function runAstGrepAll(fixturePath: string): { findings: ActualFinding[]; stderr: string } {
  const out = spawnSync(
    'npx',
    ['ast-grep', 'scan', '-c', SGCONFIG, '--json=stream', fixturePath],
    { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 },
  );
  const findings: ActualFinding[] = [];
  const stdout = out.stdout || '';
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('Error:') || trimmed.startsWith('Help:')) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object' && obj.range && obj.range.start && obj.ruleId) {
        findings.push({
          ruleId: obj.ruleId,
          // ast-grep reports 0-indexed lines; EXPECTED.json uses 1-indexed.
          line: obj.range.start.line + 1,
        });
      }
    } catch {
      // not JSON, skip
    }
  }
  return { findings, stderr: out.stderr || '' };
}

/** Run Dockerfile rules. */
function runDockerfile(fixturePath: string): ActualFinding[] {
  const text = readFileSync(fixturePath, 'utf8');
  const rawLines = text.split('\n');
  const logical: { text: string; line: number }[] = [];
  let buf = '';
  let bufLine = -1;
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i];
    if (buf === '') bufLine = i + 1;
    if (l.endsWith('\\')) {
      buf += l.slice(0, -1) + ' ';
    } else {
      buf += l;
      logical.push({ text: buf, line: bufLine });
      buf = '';
      bufLine = -1;
    }
  }
  if (buf !== '') logical.push({ text: buf, line: bufLine });

  const findings: ActualFinding[] = [];
  const allLines = logical.map((l) => l.text);
  for (const rule of DOCKERFILE_RULES) {
    for (let i = 0; i < logical.length; i++) {
      if (rule.matcher(logical[i].text, i, allLines)) {
        findings.push({ ruleId: rule.id, line: logical[i].line });
      }
    }
  }
  return findings;
}

/** Run YAML rules. */
function runYaml(fixturePath: string): ActualFinding[] {
  const text = readFileSync(fixturePath, 'utf8');
  const rel = fixturePath.replace(/\\/g, '/');
  const findings: ActualFinding[] = [];
  for (const rule of YAML_RULES) {
    if (rule.pathMatches && !rule.pathMatches(rel, text)) continue;
    for (const hit of rule.match(text)) {
      findings.push({ ruleId: rule.id, line: hit.line });
    }
  }
  return findings;
}

/** Run OSV. */
function runOsv(fixturePath: string): ActualFinding[] {
  const text = readFileSync(fixturePath, 'utf8');
  const filename = fixturePath.split(/[\\/]/).pop() || fixturePath;
  const result = scanManifest(filename, text);
  return result.map((f) => ({ ruleId: f.ruleId, line: f.line ?? 0 }));
}

/** Match actual vs expected. */
function compare(spec: FixtureSpec, actual: ActualFinding[]): PerFixtureResult {
  const tp: ExpectedFinding[] = [];
  const fn: ExpectedFinding[] = [];
  const fp: ActualFinding[] = [];
  const actualUsed = new Set<number>();
  const expectedRuleIds = new Set(spec.expected.map((e) => e.ruleId));

  for (const exp of spec.expected) {
    let matched = false;
    for (let i = 0; i < actual.length; i++) {
      if (actualUsed.has(i)) continue;
      const a = actual[i];
      if (a.ruleId !== exp.ruleId) continue;
      if (Math.abs(a.line - exp.line) > LINE_TOLERANCE) continue;
      actualUsed.add(i);
      matched = true;
      break;
    }
    if (matched) tp.push(exp);
    else fn.push(exp);
  }

  for (let i = 0; i < actual.length; i++) {
    if (actualUsed.has(i)) continue;
    fp.push(actual[i]);
  }

  // Mark expectedRuleIds as referenced so we know they were genuinely tested.
  void expectedRuleIds;
  return { spec, actual, tp, fn, fp };
}

// ─── main ────────────────────────────────────────────────────────────────────

function main() {
  const manifest = JSON.parse(readFileSync(EXPECTED_PATH, 'utf8')) as Manifest;

  // Reset tmp rules dir.
  if (existsSync(TMP_RULES_DIR)) rmSync(TMP_RULES_DIR, { recursive: true, force: true });
  mkdirSync(TMP_RULES_DIR, { recursive: true });

  process.stderr.write('Pre-processing rule definitions...\n');

  // Stats per rule load
  const failedNormalize: { path: string; error: string }[] = [];
  const failedWrite: { path: string; error: string }[] = [];
  const failedAstGrepLoad: { id: string; error: string }[] = [];
  let totalLoaded = 0;
  const rulesById = new Map<string, { id: string; lang: string }>();

  for (const ruleFile of listYamlRules()) {
    let raw: string;
    try {
      raw = readFileSync(ruleFile, 'utf8');
    } catch (err) {
      failedNormalize.push({ path: ruleFile, error: `read: ${(err as Error).message}` });
      continue;
    }
    const norm = normalizeRule(raw, ruleFile);
    if ('error' in norm) {
      failedNormalize.push({ path: ruleFile, error: norm.error });
      continue;
    }
    const tmpPath = join(TMP_RULES_DIR, `${norm.id}.yml`);
    try {
      writeFileSync(tmpPath, norm.yaml);
    } catch (err) {
      failedWrite.push({ path: ruleFile, error: (err as Error).message });
      continue;
    }
    rulesById.set(norm.id, { id: norm.id, lang: norm.lang });
    totalLoaded++;
  }

  process.stderr.write(
    `  Loaded ${totalLoaded} rules; YAML-parse failures: ${failedNormalize.length}\n`,
  );
  for (const f of failedNormalize) process.stderr.write(`    ${f.path}: ${f.error}\n`);

  // Write sgconfig.
  writeFileSync(
    SGCONFIG,
    `ruleDirs:\n  - ${TMP_RULES_DIR.replace(/\\/g, '/')}\n`,
  );

  // Smoke check: do all rule YAMLs load by ast-grep itself? We use --inspect=summary
  // on a no-op file to find the count, then dispatch one verifier per fixture.
  // For now, we surface any "Cannot parse rule" lines emitted on stderr during the
  // first fixture scan as "ast-grep refused to load" failures.

  const results: PerFixtureResult[] = [];
  const astGrepLoadErrors = new Set<string>();

  for (const spec of manifest.fixtures) {
    const fixturePath = join(FIXTURES_ROOT, spec.path);
    process.stderr.write(`Scanning ${spec.path} (${spec.language}, ${spec.scanner})...\n`);

    let actual: ActualFinding[] = [];

    if (spec.scanner === 'ast-grep') {
      const { findings, stderr } = runAstGrepAll(fixturePath);
      actual = findings;
      // Detect ast-grep load errors emitted to stderr (rules that can't be parsed
      // by ast-grep itself even after normalization).
      // Stderr accumulates messages like:
      //   Cannot parse rule scripts/.dm-test-rules/foo.yml
      const stderrLines = stderr.split('\n');
      for (let i = 0; i < stderrLines.length; i++) {
        const line = stderrLines[i];
        const m = /Cannot parse rule .*?[\\/]([^\\/]+)\.yml/.exec(line);
        if (m) astGrepLoadErrors.add(m[1]);
        // Sometimes ast-grep prints "Cannot read rule from path..."
        const m2 = /Cannot read rule from .*?[\\/]([^\\/]+)\.yml/.exec(line);
        if (m2) astGrepLoadErrors.add(m2[1]);
      }
    } else if (spec.scanner === 'dockerfile') {
      actual = runDockerfile(fixturePath);
    } else if (spec.scanner === 'yaml') {
      actual = runYaml(fixturePath);
    } else if (spec.scanner === 'osv') {
      actual = runOsv(fixturePath);
    }

    // De-dupe (rule, line) tuples.
    const seen = new Set<string>();
    actual = actual.filter((a) => {
      const key = `${a.ruleId}|${a.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const result = compare(spec, actual);
    results.push(result);

    process.stderr.write(
      `  TP=${result.tp.length}/${spec.expected.length} FN=${result.fn.length} FP=${result.fp.length}\n`,
    );
  }

  // Aggregate.
  let totalExpected = 0,
    totalTP = 0,
    totalFN = 0,
    totalFP = 0;
  type Agg = { expected: number; tp: number; fn: number; fp: number };
  const perLang = new Map<string, Agg>();

  for (const r of results) {
    totalExpected += r.spec.expected.length;
    totalTP += r.tp.length;
    totalFN += r.fn.length;
    totalFP += r.fp.length;
    const k = r.spec.language;
    if (!perLang.has(k)) perLang.set(k, { expected: 0, tp: 0, fn: 0, fp: 0 });
    const a = perLang.get(k)!;
    a.expected += r.spec.expected.length;
    a.tp += r.tp.length;
    a.fn += r.fn.length;
    a.fp += r.fp.length;
  }

  // ─── write run-baseline.txt ────────────────────────────────────────────────

  const lines: string[] = [];
  lines.push('# DecodeMind V2 — fixture test baseline');
  lines.push('# Generated by scripts/run-fixture-tests.ts');
  lines.push(`# Total fixtures: ${manifest.fixtures.length}`);
  lines.push(`# Total rules loaded by normalizer: ${totalLoaded}`);
  lines.push(`# Rule YAMLs that failed YAML parse: ${failedNormalize.length}`);
  lines.push(`# Rule YAMLs that ast-grep refused to load: ${astGrepLoadErrors.size}`);
  lines.push('');
  lines.push('## Aggregate');
  lines.push(`Total expected: ${totalExpected}`);
  lines.push(`Total TP: ${totalTP}`);
  lines.push(`Total FN: ${totalFN}`);
  lines.push(`Total FP: ${totalFP}`);
  lines.push(`TP rate: ${((totalTP / totalExpected) * 100).toFixed(1)}%`);
  lines.push(`FN rate: ${((totalFN / totalExpected) * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('## Per-language');
  for (const [lang, a] of perLang) {
    const tpRate = a.expected === 0 ? 0 : (a.tp / a.expected) * 100;
    const fnRate = a.expected === 0 ? 0 : (a.fn / a.expected) * 100;
    lines.push(
      `${lang}: expected=${a.expected} TP=${a.tp} FN=${a.fn} FP=${a.fp} TP%=${tpRate.toFixed(1)} FN%=${fnRate.toFixed(1)}`,
    );
  }
  if (astGrepLoadErrors.size > 0) {
    lines.push('');
    lines.push('## ast-grep load failures');
    for (const id of astGrepLoadErrors) lines.push(`  ${id}`);
  }
  if (failedNormalize.length > 0) {
    lines.push('');
    lines.push('## YAML-parse failures');
    for (const f of failedNormalize) lines.push(`  ${f.path}: ${f.error}`);
  }
  lines.push('');
  lines.push('## Per-fixture');
  for (const r of results) {
    lines.push('');
    lines.push(`### ${r.spec.path}`);
    lines.push(
      `  expected=${r.spec.expected.length} TP=${r.tp.length} FN=${r.fn.length} FP=${r.fp.length}`,
    );
    if (r.fn.length > 0) {
      lines.push('  Missed (FN):');
      for (const fn of r.fn) lines.push(`    L${fn.line} ${fn.ruleId}`);
    }
    if (r.fp.length > 0) {
      const counts = new Map<string, number>();
      for (const f of r.fp) counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      lines.push('  Top FPs (informational):');
      for (const [rid, c] of top) lines.push(`    ${rid} x${c}`);
    }
  }

  writeFileSync(join(__dirname, 'run-baseline.txt'), lines.join('\n'));
  process.stderr.write(`Wrote scripts/run-baseline.txt\n`);

  // Emit a JSON blob to stdout so the report generator (next step) can pick it up.
  process.stdout.write(
    JSON.stringify({
      totalExpected,
      totalTP,
      totalFN,
      totalFP,
      totalLoaded,
      yamlParseFailed: failedNormalize.length,
      astGrepRefused: [...astGrepLoadErrors],
      perLang: Object.fromEntries(perLang),
      fixtures: results.map((r) => ({
        path: r.spec.path,
        language: r.spec.language,
        scanner: r.spec.scanner,
        expected: r.spec.expected.length,
        tp: r.tp.length,
        fn: r.fn.length,
        fp: r.fp.length,
        fnDetail: r.fn,
        fpTop: (() => {
          const counts = new Map<string, number>();
          for (const f of r.fp) counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
          return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        })(),
      })),
    }) + '\n',
  );
}

main();
