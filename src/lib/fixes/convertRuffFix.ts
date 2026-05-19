import type { NormalizedEdit } from './applyEdit';
import type { RuffDiagnostic } from '@/workers/ruff.worker';

/**
 * Convert a Ruff diagnostic's `fix.edits[]` into NormalizedEdit[].
 * Ruff's positions are 1-based row, 1-based column — already matching our schema.
 */
export function ruffFixToEdits(diagnostic: RuffDiagnostic): NormalizedEdit[] {
  if (!diagnostic.fix) return [];
  return diagnostic.fix.edits.map((e) => ({
    startLine: e.location.row,
    startColumn: e.location.column,
    endLine: e.end_location.row,
    endColumn: e.end_location.column,
    replacement: e.content ?? '',
  }));
}
