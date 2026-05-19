import { describe, it, expect } from 'vitest';
import { parseRule } from '@/lib/rules/loader';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../src/lib/rules/definitions');

describe('All shipped rules', () => {
  const files = readdirSync(RULES_DIR).filter((f) => f.endsWith('.yml'));

  it.each(files)('%s parses without errors', (file) => {
    const text = readFileSync(join(RULES_DIR, file), 'utf8');
    const rule = parseRule(text, file);
    expect(rule.id).toBeTruthy();
    // file name should match the rule id
    expect(file).toBe(`${rule.id}.yml`);
  });

  it('has an EN explanation for each rule', () => {
    const enExpl = JSON.parse(
      readFileSync(join(RULES_DIR, '../explanations.en.json'), 'utf8'),
    ) as Record<string, unknown>;
    const ruleIds = files.map((f) => f.replace('.yml', ''));
    for (const id of ruleIds) {
      expect(enExpl[id], `missing EN explanation for ${id}`).toBeTruthy();
    }
  });

  it('has a FR explanation for each rule', () => {
    const frExpl = JSON.parse(
      readFileSync(join(RULES_DIR, '../explanations.fr.json'), 'utf8'),
    ) as Record<string, unknown>;
    const ruleIds = files.map((f) => f.replace('.yml', ''));
    for (const id of ruleIds) {
      expect(frExpl[id], `missing FR explanation for ${id}`).toBeTruthy();
    }
  });

  it('covers all 60 expected rule files', () => {
    expect(files.length).toBe(60);
  });
});
