import { describe, it, expect } from 'vitest';
import { eslintFixToEdits } from '@/lib/fixes/convertEslintFix';
import type { EslintMessage } from '@/workers/eslint.worker';

const SOURCE_SIMPLE = `const x = 1;
const y = 2;
const z = 3;`;

function mk(opts: Partial<EslintMessage> & { fix?: EslintMessage['fix'] }): EslintMessage {
  return {
    ruleId: 'prefer-const',
    severity: 1,
    message: 'test',
    line: 1,
    column: 1,
    ...opts,
  };
}

describe('eslintFixToEdits', () => {
  it('returns empty array when no fix', () => {
    expect(eslintFixToEdits(mk({}), SOURCE_SIMPLE)).toEqual([]);
  });

  it('converts a single-line range correctly', () => {
    // Replace `1` on line 1, column 11 (offset 10) with `42`
    const edits = eslintFixToEdits(
      mk({ fix: { range: [10, 11], text: '42' } }),
      SOURCE_SIMPLE,
    );
    expect(edits).toEqual([{
      startLine: 1,
      startColumn: 11,
      endLine: 1,
      endColumn: 12,
      replacement: '42',
    }]);
  });

  it('handles a range that spans lines', () => {
    // SOURCE_SIMPLE has '\n' at offset 12 and 25.
    // Range [10, 26] starts on line 1 col 11 and ends on line 3 col 1.
    const edits = eslintFixToEdits(
      mk({ fix: { range: [10, 26], text: 'REPLACED' } }),
      SOURCE_SIMPLE,
    );
    expect(edits[0].startLine).toBe(1);
    expect(edits[0].startColumn).toBe(11);
    expect(edits[0].endLine).toBe(3);
    expect(edits[0].endColumn).toBe(1);
  });

  it('handles offset at start of file', () => {
    const edits = eslintFixToEdits(
      mk({ fix: { range: [0, 5], text: 'let' } }),
      SOURCE_SIMPLE,
    );
    expect(edits[0]).toEqual({
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 6,
      replacement: 'let',
    });
  });

  it('handles offset at end of file', () => {
    const len = SOURCE_SIMPLE.length;
    const edits = eslintFixToEdits(
      mk({ fix: { range: [len - 1, len], text: '4' } }),
      SOURCE_SIMPLE,
    );
    // Last char of SOURCE_SIMPLE is `;` on line 3
    expect(edits[0].startLine).toBe(3);
  });

  it('empty replacement (deletion)', () => {
    const edits = eslintFixToEdits(
      mk({ fix: { range: [0, 6], text: '' } }),
      SOURCE_SIMPLE,
    );
    expect(edits[0].replacement).toBe('');
  });
});
