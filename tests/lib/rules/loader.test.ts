import { describe, it, expect } from 'vitest';
import { parseRule, parseRules } from '@/lib/rules/loader';

describe('parseRule', () => {
  it('parses a minimal valid rule', () => {
    const text = `
id: test-rule
language: Python
category: security
severity: error
message: test message
rule:
  pattern: eval($X)
`;
    const r = parseRule(text);
    expect(r.id).toBe('test-rule');
    expect(r.language).toBe('python');
    expect(r.category).toBe('security');
    expect(r.severity).toBe('error');
  });

  it('throws on missing id', () => {
    expect(() => parseRule(`language: Python\ncategory: security\nmessage: m\nrule: { pattern: x }`)).toThrow(/id/);
  });

  it('throws on invalid category', () => {
    expect(() => parseRule(`id: r\nlanguage: Python\ncategory: bogus\nmessage: m\nrule: { pattern: x }`)).toThrow(/category/);
  });

  it('defaults severity to warning when omitted', () => {
    const text = `id: r\nlanguage: Python\ncategory: bug\nmessage: m\nrule:\n  pattern: x`;
    const r = parseRule(text);
    expect(r.severity).toBe('warning');
  });

  it('normalises language to lowercase', () => {
    const text = `id: r\nlanguage: TypeScript\ncategory: quality\nmessage: m\nrule:\n  pattern: x`;
    const r = parseRule(text);
    expect(r.language).toBe('typescript');
  });

  it('throws on invalid severity', () => {
    expect(() =>
      parseRule(`id: r\nlanguage: Python\ncategory: security\nseverity: critical\nmessage: m\nrule:\n  pattern: x`),
    ).toThrow(/severity/);
  });

  it('throws on missing message', () => {
    expect(() => parseRule(`id: r\nlanguage: Python\ncategory: security\nrule:\n  pattern: x`)).toThrow(/message/);
  });

  it('throws on missing rule object', () => {
    expect(() => parseRule(`id: r\nlanguage: Python\ncategory: security\nmessage: m`)).toThrow(/rule/);
  });

  it('throws on non-object YAML', () => {
    expect(() => parseRule(`- item1\n- item2`)).toThrow(/not a valid YAML object/);
  });
});

describe('parseRules (batch)', () => {
  it('collects errors per source without aborting', () => {
    const sources = [
      { name: 'good.yml', text: `id: r\nlanguage: Python\ncategory: bug\nmessage: m\nrule: { pattern: x }` },
      { name: 'bad.yml', text: `not-a-rule` },
    ];
    const { rules, errors } = parseRules(sources);
    expect(rules.length).toBe(1);
    expect(errors.length).toBe(1);
    expect(errors[0].source).toBe('bad.yml');
  });

  it('returns empty arrays for empty input', () => {
    const { rules, errors } = parseRules([]);
    expect(rules).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('records the source name in each error', () => {
    const sources = [
      { name: 'missing-id.yml', text: `language: Python\ncategory: security\nmessage: m\nrule:\n  pattern: x` },
    ];
    const { errors } = parseRules(sources);
    expect(errors[0].source).toBe('missing-id.yml');
    expect(errors[0].error).toMatch(/id/);
  });
});
