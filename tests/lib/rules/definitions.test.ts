import { describe, it, expect } from 'vitest';
import { parseRule } from '@/lib/rules/loader';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../src/lib/rules/definitions');
const EXPL_DIR = join(RULES_DIR, '..', 'explanations');

/** Walk RULES_DIR recursively and return absolute paths of all .yml files. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.yml')) out.push(p);
  }
  return out;
}

/**
 * Load EN explanations from V1 single-file + V2 subdir per-language files.
 * Mirrors the merge logic in `src/spike/toReport.ts`.
 */
function loadAllEnExpl(): Record<string, unknown> {
  const merged: Record<string, unknown> = JSON.parse(
    readFileSync(join(RULES_DIR, '..', 'explanations.en.json'), 'utf8'),
  );
  for (const name of readdirSync(EXPL_DIR)) {
    if (!name.endsWith('.en.json')) continue;
    const sub = JSON.parse(readFileSync(join(EXPL_DIR, name), 'utf8'));
    Object.assign(merged, sub);
  }
  return merged;
}
function loadAllFrExpl(): Record<string, unknown> {
  const merged: Record<string, unknown> = JSON.parse(
    readFileSync(join(RULES_DIR, '..', 'explanations.fr.json'), 'utf8'),
  );
  for (const name of readdirSync(EXPL_DIR)) {
    if (!name.endsWith('.fr.json')) continue;
    const sub = JSON.parse(readFileSync(join(EXPL_DIR, name), 'utf8'));
    Object.assign(merged, sub);
  }
  return merged;
}

describe('All shipped rules (V1 + V2)', () => {
  const absFiles = walk(RULES_DIR);
  const fileEntries = absFiles.map((abs) => ({
    abs,
    rel: relative(RULES_DIR, abs).replace(/\\/g, '/'),
    basename: abs.split(/[\\/]/).pop()!,
  }));

  it.each(fileEntries)('$rel parses without errors', ({ abs, basename }) => {
    const text = readFileSync(abs, 'utf8');
    const rule = parseRule(text, basename);
    expect(rule.id).toBeTruthy();
    expect(basename).toBe(`${rule.id}.yml`);
  });

  it('has an EN explanation for each rule', () => {
    const enExpl = loadAllEnExpl();
    const missing: string[] = [];
    for (const { basename } of fileEntries) {
      const id = basename.replace('.yml', '');
      if (!enExpl[id]) missing.push(id);
    }
    expect(missing, `EN explanations missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('has a FR explanation for each rule', () => {
    const frExpl = loadAllFrExpl();
    const missing: string[] = [];
    for (const { basename } of fileEntries) {
      const id = basename.replace('.yml', '');
      if (!frExpl[id]) missing.push(id);
    }
    expect(missing, `FR explanations missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('ships at least the V1 baseline of 60 top-level rules', () => {
    const topLevel = fileEntries.filter((e) => !e.rel.includes('/'));
    expect(topLevel.length).toBeGreaterThanOrEqual(60);
  });

  it('reports total V1 + V2 rule count for visibility', () => {
    // Informational: lets CI surface the real number whenever a rule is
    // added or removed. As of V2.1 + audit: 60 V1 + 147 V2 + 1 new (network) = 208.
    expect(fileEntries.length).toBeGreaterThanOrEqual(208);
  });
});
