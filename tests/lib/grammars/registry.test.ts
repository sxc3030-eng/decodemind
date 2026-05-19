import { describe, it, expect } from 'vitest';
import { GRAMMAR_REGISTRY } from '@/lib/grammars/registry';

describe('GRAMMAR_REGISTRY', () => {
  it('declares the 5 V1 languages', () => {
    const langs = GRAMMAR_REGISTRY.map((g) => g.language).sort();
    expect(langs).toEqual(['css', 'html', 'javascript', 'python', 'typescript']);
  });

  it('each entry has a non-empty packagePath', () => {
    for (const g of GRAMMAR_REGISTRY) {
      expect(g.packagePath).toMatch(/.+/);
    }
  });
});
