import { describe, it, expect } from 'vitest';
import { GRAMMAR_REGISTRY } from '@/lib/grammars/registry';

describe('GRAMMAR_REGISTRY', () => {
  it('declares the 5 V1 languages', () => {
    const langs = new Set(GRAMMAR_REGISTRY.map((g) => g.language));
    for (const v1 of ['css', 'html', 'javascript', 'python', 'typescript']) {
      expect(langs.has(v1)).toBe(true);
    }
  });

  it('declares the V2 enterprise + mobile + infra languages', () => {
    const langs = new Set(GRAMMAR_REGISTRY.map((g) => g.language));
    // Enterprise back-end
    for (const v2 of ['java', 'c_sharp', 'php', 'go', 'ruby']) {
      expect(langs.has(v2)).toBe(true);
    }
    // Mobile
    for (const v2 of ['kotlin', 'swift', 'dart']) {
      expect(langs.has(v2)).toBe(true);
    }
    // Shell + infra
    for (const v2 of ['bash', 'yaml']) {
      expect(langs.has(v2)).toBe(true);
    }
  });

  it('each entry has a non-empty packagePath', () => {
    for (const g of GRAMMAR_REGISTRY) {
      expect(g.packagePath).toMatch(/.+/);
    }
  });
});
