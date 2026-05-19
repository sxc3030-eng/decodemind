import { describe, it, expect } from 'vitest';
import { ruffFixToEdits } from '@/lib/fixes/convertRuffFix';
import type { RuffDiagnostic } from '@/workers/ruff.worker';

describe('ruffFixToEdits', () => {
  it('returns empty array when no fix is present', () => {
    const diag: RuffDiagnostic = {
      code: 'E501',
      message: 'too long',
      start_location: { row: 1, column: 1 },
      end_location: { row: 1, column: 100 },
    };
    expect(ruffFixToEdits(diag)).toEqual([]);
  });

  it('converts a single edit', () => {
    const diag: RuffDiagnostic = {
      code: 'F841',
      message: 'unused',
      start_location: { row: 1, column: 1 },
      end_location: { row: 1, column: 1 },
      fix: {
        message: 'Remove unused',
        edits: [
          {
            content: '',
            location: { row: 5, column: 1 },
            end_location: { row: 5, column: 10 },
          },
        ],
      },
    };
    const edits = ruffFixToEdits(diag);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toEqual({
      startLine: 5,
      startColumn: 1,
      endLine: 5,
      endColumn: 10,
      replacement: '',
    });
  });

  it('handles null content as empty string', () => {
    const diag: RuffDiagnostic = {
      code: 'F401',
      message: 'unused import',
      start_location: { row: 1, column: 1 },
      end_location: { row: 1, column: 10 },
      fix: {
        message: null,
        edits: [
          { content: null, location: { row: 1, column: 1 }, end_location: { row: 1, column: 10 } },
        ],
      },
    };
    expect(ruffFixToEdits(diag)[0].replacement).toBe('');
  });
});
