import { describe, it, expect } from 'vitest';
import {
  getAllRules,
  getRulesByLanguage,
  getRuleLoadErrors,
  YAML_LANG_TO_TREESITTER,
  EXT_TO_TREESITTER,
} from '@/lib/rules/loadAllRules';

/**
 * This test would have caught the silent-bug where `import.meta.glob` was
 * using a `@/` alias that didn't resolve, returning zero rules and silently
 * disabling ast-grep in production. Hard regression guard.
 */
describe('loadAllRules — import.meta.glob discovery', () => {
  it('loads at least 200 rules from disk', () => {
    const rules = getAllRules();
    expect(rules.length).toBeGreaterThanOrEqual(200);
  });

  it('groups Python rules — must be non-empty (was the V2.1 silent bug)', () => {
    const byLang = getRulesByLanguage();
    const python = byLang.get('python') ?? [];
    expect(python.length).toBeGreaterThan(0);
    // V1 ships ~25 Python rules; if this drops below 20 something regressed.
    expect(python.length).toBeGreaterThanOrEqual(20);
  });

  it('groups Java rules — confirms V2 subdir glob resolves', () => {
    const byLang = getRulesByLanguage();
    const java = byLang.get('java') ?? [];
    expect(java.length).toBeGreaterThan(0);
  });

  it('groups Kotlin rules — confirms V2 subdir glob resolves', () => {
    const byLang = getRulesByLanguage();
    const kotlin = byLang.get('kotlin') ?? [];
    expect(kotlin.length).toBeGreaterThan(0);
  });

  it('all loaded rules have a tree-sitter language mapping', () => {
    const rules = getAllRules();
    const unmapped: string[] = [];
    for (const r of rules) {
      if (!YAML_LANG_TO_TREESITTER[r.language]) {
        unmapped.push(`${r.id} (${r.language})`);
      }
    }
    expect(unmapped, `unmapped languages: ${unmapped.join(', ')}`).toEqual([]);
  });

  it('all V1 extensions map to a tree-sitter language', () => {
    for (const ext of ['.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css']) {
      expect(EXT_TO_TREESITTER[ext], `missing mapping for ${ext}`).toBeTruthy();
    }
  });

  it('all V2 mobile + enterprise extensions map to a tree-sitter language', () => {
    for (const ext of ['.java', '.kt', '.swift', '.dart', '.cs', '.php', '.go', '.rb', '.sh']) {
      expect(EXT_TO_TREESITTER[ext], `missing mapping for ${ext}`).toBeTruthy();
    }
  });

  it('rule load errors list is empty (or only known TODOs)', () => {
    const errors = getRuleLoadErrors();
    // No load errors should occur on a clean rule library.
    expect(errors, `unexpected load errors: ${JSON.stringify(errors)}`).toEqual([]);
  });
});
