/**
 * Minimal semver-range checker for the OSV scanner.
 *
 * Why hand-rolled? The DecodeMind project ban on new npm dependencies + the
 * fact that we only need a tiny subset of semver's grammar make this trivial
 * to write inline. Supports operators: `<`, `<=`, `>`, `>=`, `=`, `==`.
 * Multiple comparators may be joined with `,` — they all must match (AND).
 *
 * Examples:
 *   versionMatchesRange("4.17.20", "<4.17.21")          → true
 *   versionMatchesRange("4.17.21", "<4.17.21")          → false
 *   versionMatchesRange("2.0.5",   ">=2.0.0,<2.1.5")    → true
 *   versionMatchesRange("2.1.5",   ">=2.0.0,<2.1.5")    → false
 *
 * Quirks the parser accepts on purpose:
 *  - Leading `^`, `~`, `=` and `v` prefixes in the *version* string are
 *    stripped (so we can feed npm-style "^4.17.21" or Go-style "v1.2.3" in).
 *  - Pre-release tags after `-` are dropped before comparison; this matches
 *    the practical behaviour OSV advisories use ("everything before X.Y.Z").
 *  - Build metadata (`+sha`) is dropped.
 *  - Non-numeric segments collapse to 0 (e.g. "1.2.0rc1" → 1.2.0).
 */

export type Comparator = '<' | '<=' | '>' | '>=' | '=' | '==';

const OPERATORS: Comparator[] = ['<=', '>=', '==', '<', '>', '='];

export interface ParsedComparator {
  op: Comparator;
  version: number[];
}

/**
 * Normalize a free-form version string to a tuple of integers.
 * Strips `^`, `~`, `=`, `v` prefixes, drops pre-release / build metadata,
 * and collapses non-numeric segments to 0.
 */
export function normalizeVersion(raw: string): number[] {
  let s = raw.trim();
  // strip range prefixes that callers sometimes leave on
  while (s.length > 0 && '^~=v'.includes(s[0])) {
    s = s.slice(1);
  }
  // drop pre-release (-) and build metadata (+)
  const dash = s.indexOf('-');
  if (dash !== -1) s = s.slice(0, dash);
  const plus = s.indexOf('+');
  if (plus !== -1) s = s.slice(0, plus);
  if (s.length === 0) return [0];
  return s.split('.').map((seg) => {
    // Take leading digits; everything else is 0.
    const m = seg.match(/^\d+/);
    return m ? parseInt(m[0], 10) : 0;
  });
}

/**
 * Lexicographic comparison of two normalized version tuples. Missing trailing
 * segments are treated as 0 (so "1.2" == "1.2.0").
 *
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareVersions(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * Split a single comparator like ">=2.0.0" into its op and version.
 * A bare version (no operator) is treated as `=` for parity with semver.
 * Throws on a malformed input — the caller should guard against this for
 * untrusted data.
 */
export function parseComparator(raw: string): ParsedComparator {
  const s = raw.trim();
  if (s.length === 0) {
    throw new Error('empty comparator');
  }
  for (const op of OPERATORS) {
    if (s.startsWith(op)) {
      const version = normalizeVersion(s.slice(op.length));
      return { op, version };
    }
  }
  // No explicit operator → treat as exact match.
  return { op: '=', version: normalizeVersion(s) };
}

/**
 * Check a version string against a comma-separated range.
 *
 * Whitespace and empty segments are tolerated. An empty range matches nothing
 * (defensive — an empty `vulnerableRange` in the DB is almost certainly a bug
 * upstream and we'd rather under-report than mark every version vulnerable).
 */
export function versionMatchesRange(version: string, range: string): boolean {
  const v = normalizeVersion(version);
  const parts = range
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  for (const part of parts) {
    let cmp: ParsedComparator;
    try {
      cmp = parseComparator(part);
    } catch {
      // A malformed comparator is treated as a non-match rather than
      // throwing — keeps the scanner robust to a single bad DB entry.
      return false;
    }
    const c = compareVersions(v, cmp.version);
    let ok: boolean;
    switch (cmp.op) {
      case '<':  ok = c < 0;  break;
      case '<=': ok = c <= 0; break;
      case '>':  ok = c > 0;  break;
      case '>=': ok = c >= 0; break;
      case '=':
      case '==': ok = c === 0; break;
    }
    if (!ok) return false;
  }
  return true;
}
