/**
 * Manifest parsers for the OSV scanner.
 *
 * Each parser extracts `{ name, version, ecosystem, line }` triples from one
 * manifest file. We deliberately keep each parser tiny and tolerant — partial
 * parses are better than throwing, because users routinely have malformed
 * lockfiles, comments, or workspace placeholders we should just skip.
 *
 * `line` is the 1-based line number the dependency appears on, or null if we
 * can't pinpoint it (e.g. JSON parsing strips line info). Callers can use it
 * for UI highlights but must be ready for null.
 */

import type { OsvEcosystem } from './db';

export interface ParsedDep {
  name: string;
  version: string;
  ecosystem: OsvEcosystem;
  line: number | null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Strip common semver-range prefixes (`^`, `~`, `>=`, `*`, etc.) and trim. */
function cleanVersion(raw: string): string {
  let s = raw.trim();
  // remove surrounding quotes if any (composer uses raw strings, but defensive)
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // Strip leading "v" prefix common in Go
  if (s.startsWith('v')) s = s.slice(1);
  // Strip range operators — we report against the lower bound, which is what
  // the user has declared as their minimum. (An npm "^4.17.20" allows
  // 4.17.20 ≤ x < 5.0.0; we conservatively report it as 4.17.20.)
  s = s.replace(/^[\^~><=!]+\s*/, '');
  return s.trim();
}

/** True if a version string looks like a real semver (digits.digits.digits). */
function looksLikeVersion(v: string): boolean {
  return /^\d+(\.\d+)*/.test(v);
}

/** Find the 1-based line a literal substring first appears on. Null if missing. */
function findLine(content: string, needle: string): number | null {
  if (!needle) return null;
  const idx = content.indexOf(needle);
  if (idx === -1) return null;
  // Count newlines up to idx.
  let line = 1;
  for (let i = 0; i < idx; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

// ─── package.json ───────────────────────────────────────────────────────────

/**
 * Walk `dependencies` and `devDependencies`. Skips:
 *   - git URLs, file/link refs, github shorthand, workspace:* protocols, npm
 *     aliases (`npm:other@1.2.3`), and anything with `://` in it
 *   - entries whose version doesn't start with digits
 */
export function parsePackageJson(text: string): ParsedDep[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  if (!json || typeof json !== 'object') return [];
  const out: ParsedDep[] = [];
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  for (const section of sections) {
    const deps = (json as Record<string, unknown>)[section];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, rawVersion] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof rawVersion !== 'string') continue;
      // Skip non-registry refs
      if (
        rawVersion.includes('://') ||
        rawVersion.startsWith('file:') ||
        rawVersion.startsWith('link:') ||
        rawVersion.startsWith('workspace:') ||
        rawVersion.startsWith('git+') ||
        rawVersion.startsWith('git:') ||
        rawVersion.startsWith('npm:') ||
        // github shorthand "user/repo"
        /^[\w-]+\/[\w.-]+$/.test(rawVersion)
      ) {
        continue;
      }
      const version = cleanVersion(rawVersion);
      if (!looksLikeVersion(version)) continue;
      out.push({
        name,
        version,
        ecosystem: 'npm',
        // Locate by the `"<name>":` key — quote-aware to avoid hitting the
        // same name embedded in a value.
        line: findLine(text, `"${name}"`),
      });
    }
  }
  return out;
}

// ─── requirements.txt ───────────────────────────────────────────────────────

/**
 * Pip requirements format. Handles:
 *   - `name==1.2.3`, `name>=1.2.3`, `name~=1.2.3`, `name===1.2.3`
 *   - `name [extra,extra]==1.2.3` (extras dropped)
 *   - `name; python_version<'3.10'` (environment markers dropped)
 *   - inline comments (`# ...`) and full-line comments
 *
 * Skips:
 *   - `-r other.txt`, `-c constraints.txt`, `-e .`, URLs, VCS refs
 *   - bare names without a version
 *   - hash-pinned blocks (we only need name+version)
 */
export function parseRequirementsTxt(text: string): ParsedDep[] {
  const out: ParsedDep[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // strip inline comment
    const hash = line.indexOf('#');
    if (hash !== -1) line = line.slice(0, hash);
    line = line.trim();
    if (line.length === 0) continue;
    // strip env marker
    const semi = line.indexOf(';');
    if (semi !== -1) line = line.slice(0, semi).trim();
    // skip option-lines and includes
    if (line.startsWith('-')) continue;
    // skip URL/VCS refs
    if (line.includes('://') || line.startsWith('git+')) continue;
    // strip line-continuation backslash
    if (line.endsWith('\\')) line = line.slice(0, -1).trim();
    // strip extras: name[a,b]==1.2.3 → name==1.2.3
    line = line.replace(/\[[^\]]*\]/, '');
    // match name + operator + version. Pip allows ==, >=, <=, ~=, !=, ===, >, <
    const m = line.match(/^([A-Za-z0-9_.-]+)\s*(===|==|>=|<=|~=|!=|>|<)\s*([\w.+!*-]+)/);
    if (!m) continue;
    const version = cleanVersion(m[3]);
    if (!looksLikeVersion(version)) continue;
    out.push({
      // Normalize to canonical PyPI form (lowercase, hyphens not underscores)
      name: m[1].toLowerCase().replace(/_/g, '-'),
      version,
      ecosystem: 'pypi',
      line: i + 1,
    });
  }
  return out;
}

// ─── composer.json ──────────────────────────────────────────────────────────

/** Walk `require` and `require-dev`. Skips `php`, `ext-*`, `lib-*`. */
export function parseComposerJson(text: string): ParsedDep[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }
  if (!json || typeof json !== 'object') return [];
  const out: ParsedDep[] = [];
  for (const section of ['require', 'require-dev']) {
    const deps = (json as Record<string, unknown>)[section];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, rawVersion] of Object.entries(deps as Record<string, unknown>)) {
      if (typeof rawVersion !== 'string') continue;
      // platform packages have no real version
      if (name === 'php' || name.startsWith('ext-') || name.startsWith('lib-')) continue;
      const version = cleanVersion(rawVersion);
      if (!looksLikeVersion(version)) continue;
      out.push({
        name,
        version,
        ecosystem: 'packagist',
        line: findLine(text, `"${name}"`),
      });
    }
  }
  return out;
}

// ─── go.mod ─────────────────────────────────────────────────────────────────

/**
 * Parse a Go module file's require directives. Handles both:
 *   require <path> v1.2.3
 *   require (
 *       <path> v1.2.3
 *       <path> v1.2.3
 *   )
 *
 * Skips `// indirect` comments (we still want to surface vulns even on
 * indirect deps — the user's project still pulls them).
 */
export function parseGoMod(text: string): ParsedDep[] {
  const out: ParsedDep[] = [];
  const lines = text.split(/\r?\n/);
  let inRequireBlock = false;
  for (let i = 0; i < lines.length; i++) {
    let raw = lines[i];
    // strip line comments
    const slash = raw.indexOf('//');
    if (slash !== -1) raw = raw.slice(0, slash);
    const line = raw.trim();
    if (line.length === 0) continue;

    // detect block start/end
    if (!inRequireBlock) {
      if (/^require\s*\($/.test(line)) {
        inRequireBlock = true;
        continue;
      }
      // single-line require
      const m = line.match(/^require\s+(\S+)\s+(\S+)$/);
      if (m) {
        const version = cleanVersion(m[2]);
        if (!looksLikeVersion(version)) continue;
        out.push({ name: m[1], version, ecosystem: 'go', line: i + 1 });
      }
      continue;
    }
    // inside a block
    if (line === ')') {
      inRequireBlock = false;
      continue;
    }
    const m = line.match(/^(\S+)\s+(\S+)$/);
    if (!m) continue;
    const version = cleanVersion(m[2]);
    if (!looksLikeVersion(version)) continue;
    out.push({ name: m[1], version, ecosystem: 'go', line: i + 1 });
  }
  return out;
}

// ─── Cargo.toml ─────────────────────────────────────────────────────────────

/**
 * Tiny TOML walker scoped to the OSV use case. Handles:
 *   - `[dependencies]` and `[dev-dependencies]` (and `[build-dependencies]`)
 *   - `[target.'cfg(unix)'.dependencies]` (recognised as a deps section)
 *   - `name = "1.2.3"`
 *   - `name = { version = "1.2.3", ... }`  (inline table — picks out version)
 *   - `name.version = "1.2.3"`             (dotted key)
 *
 * Skips:
 *   - `name = { git = "..." }` or `{ path = "..." }` (no usable version)
 *   - workspace inheritance: `name.workspace = true`
 *
 * Real TOML has much more (multi-line strings, arrays of tables, …) but we
 * deliberately implement only what shipping crates actually use for deps.
 */
export function parseCargoToml(text: string): ParsedDep[] {
  const out: ParsedDep[] = [];
  const lines = text.split(/\r?\n/);
  let inDepsSection = false;
  // Track dotted-key versions: name -> version found across multiple lines.
  // We commit them at section/file end so we don't double-emit.
  const dotted = new Map<string, { version?: string; hasGit?: boolean; hasPath?: boolean; line: number }>();

  const flushDotted = () => {
    for (const [name, info] of dotted) {
      if (info.hasGit || info.hasPath) continue;
      if (!info.version) continue;
      const v = cleanVersion(info.version);
      if (!looksLikeVersion(v)) continue;
      out.push({ name, version: v, ecosystem: 'cargo', line: info.line });
    }
    dotted.clear();
  };

  for (let i = 0; i < lines.length; i++) {
    let raw = lines[i];
    // Strip TOML comments (#) but be conservative: don't touch # inside
    // quoted strings. For Cargo.toml this is good enough in practice.
    const inString = /"[^"]*#[^"]*"/.test(raw);
    if (!inString) {
      const hash = raw.indexOf('#');
      if (hash !== -1) raw = raw.slice(0, hash);
    }
    const line = raw.trim();
    if (line.length === 0) continue;

    // Section header
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      flushDotted();
      const name = header[1].trim();
      inDepsSection =
        name === 'dependencies' ||
        name === 'dev-dependencies' ||
        name === 'build-dependencies' ||
        /\.dependencies$/.test(name) ||
        /\.dev-dependencies$/.test(name) ||
        /\.build-dependencies$/.test(name);
      continue;
    }
    if (!inDepsSection) continue;

    // Match a key. Key can be dotted (a.b) or quoted.
    const keyMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    if (!keyMatch) continue;
    const fullKey = keyMatch[1];
    const value = keyMatch[2].trim();

    // Dotted key: name.version, name.git, name.workspace, etc.
    const dotIdx = fullKey.indexOf('.');
    if (dotIdx !== -1) {
      const name = fullKey.slice(0, dotIdx);
      const sub = fullKey.slice(dotIdx + 1);
      const info = dotted.get(name) ?? { line: i + 1 };
      if (sub === 'version') {
        const m = value.match(/^"([^"]*)"$/) ?? value.match(/^'([^']*)'$/);
        if (m) info.version = m[1];
      } else if (sub === 'git') {
        info.hasGit = true;
      } else if (sub === 'path') {
        info.hasPath = true;
      }
      // workspace = true is ignored on purpose — no version available here
      dotted.set(name, info);
      continue;
    }

    const name = fullKey;

    // Simple string: name = "1.2.3"
    const strMatch = value.match(/^"([^"]*)"$/) ?? value.match(/^'([^']*)'$/);
    if (strMatch) {
      const v = cleanVersion(strMatch[1]);
      if (!looksLikeVersion(v)) continue;
      out.push({ name, version: v, ecosystem: 'cargo', line: i + 1 });
      continue;
    }

    // Inline table: name = { version = "1.2.3", features = [...] }
    if (value.startsWith('{') && value.endsWith('}')) {
      // git or path refs have no usable version for us
      if (/\bgit\s*=/.test(value) || /\bpath\s*=/.test(value)) continue;
      const vm = value.match(/\bversion\s*=\s*"([^"]+)"/) ?? value.match(/\bversion\s*=\s*'([^']+)'/);
      if (!vm) continue;
      const v = cleanVersion(vm[1]);
      if (!looksLikeVersion(v)) continue;
      out.push({ name, version: v, ecosystem: 'cargo', line: i + 1 });
      continue;
    }
    // Anything else (numeric/bool/array) — not a dependency-version line.
  }
  flushDotted();
  return out;
}
