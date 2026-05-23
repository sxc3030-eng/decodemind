import { describe, it, expect } from 'vitest';
import {
  normalizeVersion,
  compareVersions,
  parseComparator,
  versionMatchesRange,
} from '@/lib/scanners/osv/semverCompare';

// ─── normalizeVersion ─────────────────────────────────────────────────────────

describe('normalizeVersion', () => {
  it('parses a plain semver', () => {
    expect(normalizeVersion('1.2.3')).toEqual([1, 2, 3]);
  });

  it('strips a ^ caret prefix', () => {
    expect(normalizeVersion('^4.17.21')).toEqual([4, 17, 21]);
  });

  it('strips a ~ tilde prefix', () => {
    expect(normalizeVersion('~1.0.0')).toEqual([1, 0, 0]);
  });

  it('strips a leading v', () => {
    expect(normalizeVersion('v0.4.20')).toEqual([0, 4, 20]);
  });

  it('drops pre-release tags', () => {
    expect(normalizeVersion('1.2.3-rc.1')).toEqual([1, 2, 3]);
    expect(normalizeVersion('2.0.0-beta')).toEqual([2, 0, 0]);
  });

  it('drops build metadata', () => {
    expect(normalizeVersion('1.2.3+sha.abc')).toEqual([1, 2, 3]);
  });

  it('collapses non-numeric segments to 0', () => {
    expect(normalizeVersion('1.2.0rc1')).toEqual([1, 2, 0]);
  });
});

// ─── compareVersions ──────────────────────────────────────────────────────────

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('treats missing trailing segments as 0', () => {
    expect(compareVersions([1, 2], [1, 2, 0])).toBe(0);
  });

  it('orders versions correctly', () => {
    expect(compareVersions([1, 2, 3], [1, 2, 4])).toBeLessThan(0);
    expect(compareVersions([2, 0, 0], [1, 9, 9])).toBeGreaterThan(0);
  });

  it('respects segment width (10 > 9)', () => {
    expect(compareVersions([0, 10, 0], [0, 9, 0])).toBeGreaterThan(0);
  });
});

// ─── parseComparator ──────────────────────────────────────────────────────────

describe('parseComparator', () => {
  it('parses < operator', () => {
    expect(parseComparator('<4.17.21')).toEqual({ op: '<', version: [4, 17, 21] });
  });

  it('parses >= operator', () => {
    expect(parseComparator('>=2.0.0')).toEqual({ op: '>=', version: [2, 0, 0] });
  });

  it('parses <= operator', () => {
    expect(parseComparator('<=1.2.3')).toEqual({ op: '<=', version: [1, 2, 3] });
  });

  it('parses == as equality', () => {
    expect(parseComparator('==4.0.0')).toEqual({ op: '==', version: [4, 0, 0] });
  });

  it('treats a bare version as = (exact match)', () => {
    expect(parseComparator('1.2.3')).toEqual({ op: '=', version: [1, 2, 3] });
  });
});

// ─── versionMatchesRange ──────────────────────────────────────────────────────

describe('versionMatchesRange', () => {
  // single-comparator ranges
  it('matches <X for any version strictly below X', () => {
    expect(versionMatchesRange('4.17.20', '<4.17.21')).toBe(true);
    expect(versionMatchesRange('4.17.21', '<4.17.21')).toBe(false);
    expect(versionMatchesRange('4.17.22', '<4.17.21')).toBe(false);
  });

  it('matches <= correctly', () => {
    expect(versionMatchesRange('2.0.0', '<=2.0.0')).toBe(true);
    expect(versionMatchesRange('2.0.1', '<=2.0.0')).toBe(false);
  });

  it('matches > correctly', () => {
    expect(versionMatchesRange('5.0.0', '>4.99.99')).toBe(true);
    expect(versionMatchesRange('4.99.99', '>4.99.99')).toBe(false);
  });

  it('matches >= correctly', () => {
    expect(versionMatchesRange('1.0.0', '>=1.0.0')).toBe(true);
    expect(versionMatchesRange('0.9.9', '>=1.0.0')).toBe(false);
  });

  it('matches = correctly', () => {
    expect(versionMatchesRange('1.2.3', '=1.2.3')).toBe(true);
    expect(versionMatchesRange('1.2.4', '=1.2.3')).toBe(false);
  });

  // compound ranges (AND)
  it('matches an inclusive-exclusive range', () => {
    expect(versionMatchesRange('2.0.5', '>=2.0.0,<2.1.5')).toBe(true);
    expect(versionMatchesRange('2.0.0', '>=2.0.0,<2.1.5')).toBe(true);
    expect(versionMatchesRange('2.1.5', '>=2.0.0,<2.1.5')).toBe(false);
    expect(versionMatchesRange('1.9.9', '>=2.0.0,<2.1.5')).toBe(false);
  });

  it('tolerates whitespace inside the range', () => {
    expect(versionMatchesRange('2.0.5', '>=2.0.0 , <2.1.5')).toBe(true);
  });

  it('handles versions with caret/tilde/v prefixes by stripping them', () => {
    expect(versionMatchesRange('^4.17.20', '<4.17.21')).toBe(true);
    expect(versionMatchesRange('v1.5.0', '>=1.0.0,<2.0.0')).toBe(true);
  });

  it('returns false for an empty range (defensive)', () => {
    expect(versionMatchesRange('1.2.3', '')).toBe(false);
    expect(versionMatchesRange('1.2.3', ' , ')).toBe(false);
  });

  it('does not match a malformed comparator', () => {
    // Garbage with no digits normalizes to [0] and the implicit `=` op fails
    // the equality check against [1,2,3].
    expect(versionMatchesRange('1.2.3', '???')).toBe(false);
    // Operator with no version: parsed as { op: '<', version: [0] } → 1.2.3 is
    // not less than 0, so no match.
    expect(versionMatchesRange('1.2.3', '<')).toBe(false);
  });
});
