import { describe, it, expect } from 'vitest';
import { applyEdits, computeLineDiff } from '@/lib/fixes/applyEdit';
import type { NormalizedEdit } from '@/lib/fixes/applyEdit';

describe('applyEdits', () => {
  it('applies a single-line replacement', () => {
    const source = 'const x = 1;\nconst y = 2;\n';
    const edit: NormalizedEdit = {
      startLine: 1,
      startColumn: 7,
      endLine: 1,
      endColumn: 12,
      replacement: 'hello',
    };
    // "const x = 1;" → replace columns 7-11 ("x = 1") with "hello"
    expect(applyEdits(source, [edit])).toBe('const hello;\nconst y = 2;\n');
  });

  it('applies a multi-line replacement (collapses 3 lines into 1)', () => {
    const source = 'line1\nline2\nline3\nline4\n';
    const edit: NormalizedEdit = {
      startLine: 2,
      startColumn: 1,
      endLine: 4,
      endColumn: 1,
      replacement: 'merged',
    };
    expect(applyEdits(source, [edit])).toBe('line1\nmergedline4\n');
  });

  it('applies multiple edits in correct bottom-to-top order', () => {
    const source = 'aaa\nbbb\nccc\n';
    const edits: NormalizedEdit[] = [
      // Edit line 3 first conceptually, but pass them in reverse order to verify sorting
      { startLine: 3, startColumn: 1, endLine: 3, endColumn: 4, replacement: 'ZZZ' },
      { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4, replacement: 'XXX' },
    ];
    expect(applyEdits(source, edits)).toBe('XXX\nbbb\nZZZ\n');
  });

  it('throws on out-of-bounds edit (line beyond file length)', () => {
    const source = 'only one line';
    const edit: NormalizedEdit = {
      startLine: 5,
      startColumn: 1,
      endLine: 5,
      endColumn: 1,
      replacement: '',
    };
    expect(() => applyEdits(source, [edit])).toThrow('applyEdits: edit out of bounds');
  });

  it('throws when startLine > endLine', () => {
    const source = 'line1\nline2\n';
    const edit: NormalizedEdit = {
      startLine: 2,
      startColumn: 1,
      endLine: 1,
      endColumn: 1,
      replacement: '',
    };
    expect(() => applyEdits(source, [edit])).toThrow('applyEdits: edit out of bounds');
  });
});

describe('computeLineDiff', () => {
  it('produces expected add/remove/context for a 1-line change', () => {
    // The greedy (non-LCS) diff always prefers adds before removes when lines differ.
    // For a substitution of line 2, it emits: context(1), add(new-2), add(new-3),
    // remove(old-2), remove(old-3) — because 'const y' != 'var y' triggers the add
    // branch, then 'const z' != 'var y' also triggers add, leaving both old lines
    // as removes at the end.
    const before = 'const x = 1;\nvar y = 2;';
    const after = 'const x = 1;\nconst y = 2;';
    const diff = computeLineDiff(before, after);

    // context line is unchanged
    expect(diff.find((l) => l.type === 'context')?.text).toBe('const x = 1;');
    // the changed line appears as a remove of the old and an add of the new
    expect(diff.some((l) => l.type === 'remove' && l.text === 'var y = 2;')).toBe(true);
    expect(diff.some((l) => l.type === 'add' && l.text === 'const y = 2;')).toBe(true);
  });

  it('handles identical strings (all context)', () => {
    const source = 'a\nb\nc';
    const diff = computeLineDiff(source, source);
    expect(diff.every((l) => l.type === 'context')).toBe(true);
    expect(diff).toHaveLength(3);
  });

  it('handles empty string before (produces remove of empty line plus add)', () => {
    // ''.split('\n') === [''] so before has 1 empty line, after has 1 non-empty line
    // greedy adds 'new line' first, then removes '' — both non-context
    const diff = computeLineDiff('', 'new line');
    expect(diff.some((l) => l.type === 'add' && l.text === 'new line')).toBe(true);
    expect(diff.some((l) => l.type === 'remove' && l.text === '')).toBe(true);
  });
});
