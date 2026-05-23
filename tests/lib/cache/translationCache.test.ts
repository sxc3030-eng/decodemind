import { describe, it, expect } from 'vitest';
import { normalizeCode } from '@/lib/cache/translationCache';

describe('normalizeCode', () => {
  it('strips Python inline comments', () => {
    const input = 'x = 1  # this is a comment\ny = 2';
    const result = normalizeCode(input);
    expect(result).not.toContain('this is a comment');
    expect(result).toContain('y');
  });

  it('strips JS // line comments', () => {
    const input = 'const x = 1; // remove me\nconst y = 2;';
    const result = normalizeCode(input);
    expect(result).not.toContain('remove me');
    expect(result).toContain('const y');
  });

  it('strips block comments /* ... */', () => {
    const input = 'function foo() { /* block comment */ return 1; }';
    const result = normalizeCode(input);
    expect(result).not.toContain('block comment');
    expect(result).toContain('function foo');
  });

  it('replaces string literals with <STR>', () => {
    const input = "print('hello world')";
    const result = normalizeCode(input);
    expect(result).not.toContain('hello world');
    expect(result).toContain('<STR>');
  });

  it('replaces number literals with <NUM>', () => {
    const input = 'timeout = 3000\nretry = 5';
    const result = normalizeCode(input);
    expect(result).not.toContain('3000');
    expect(result).not.toContain(' 5');
    expect(result).toContain('<NUM>');
  });

  it('replaces SCREAMING_SNAKE identifiers with <CONST>', () => {
    const input = 'MAX_RETRIES = 3\nDEFAULT_TIMEOUT = 5000';
    const result = normalizeCode(input);
    expect(result).not.toContain('MAX_RETRIES');
    expect(result).not.toContain('DEFAULT_TIMEOUT');
    expect(result).toContain('<CONST>');
  });

  it('collapses whitespace and trims', () => {
    const input = '   x   =   1   ';
    const result = normalizeCode(input);
    expect(result).toBe('x = <NUM>');
  });

  it('produces same output for semantically-equivalent snippets differing only in comments and whitespace', () => {
    const a = 'subprocess.run(cmd, shell=True)  # dangerous!';
    const b = 'subprocess.run(cmd,   shell=True)';
    expect(normalizeCode(a)).toBe(normalizeCode(b));
  });

  it('produces same output for snippets with different string literals', () => {
    const a = 'os.system("ls -la")';
    const b = 'os.system("rm -rf /")';
    expect(normalizeCode(a)).toBe(normalizeCode(b));
  });

  it('produces same output for snippets with different number literals', () => {
    const a = 'sleep(100)';
    const b = 'sleep(9999)';
    expect(normalizeCode(a)).toBe(normalizeCode(b));
  });
});
