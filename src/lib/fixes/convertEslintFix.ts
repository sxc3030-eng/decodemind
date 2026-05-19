import type { NormalizedEdit } from './applyEdit';
import type { EslintMessage } from '@/workers/eslint.worker';

/**
 * Convert ESLint's character-offset fix to a line/column NormalizedEdit.
 *
 * ESLint reports `fix.range: [start, end]` as offsets into the source string.
 * applyEdits wants 1-based line + 1-based column. We compute them by counting
 * newlines in the source from offset 0 to the start of the range.
 */
export function eslintFixToEdits(
  message: EslintMessage,
  source: string,
): NormalizedEdit[] {
  if (!message.fix) return [];

  const [startOffset, endOffset] = message.fix.range;
  const start = offsetToLineColumn(source, startOffset);
  const end = offsetToLineColumn(source, endOffset);

  return [{
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column,
    replacement: message.fix.text,
  }];
}

/**
 * Convert a 0-based character offset to 1-based {line, column}.
 *
 * Conventions: lines are 1-based (line 1 = first line). Columns are 1-based
 * (column 1 = first character on the line). This matches applyEdits' convention.
 */
function offsetToLineColumn(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  return {
    line,
    column: offset - lineStart + 1,
  };
}
