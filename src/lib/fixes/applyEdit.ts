/**
 * A normalized edit shape that all scanners' fix outputs are converted into.
 * Indices are 1-based, matching SARIF / linter conventions.
 */
export interface NormalizedEdit {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  replacement: string;
}

/**
 * Apply a list of edits to a source string. Edits MUST be sorted bottom-to-top
 * (highest startLine first) so earlier edits don't invalidate later ones'
 * positions. This function sorts them defensively.
 *
 * Throws if any edit is out of bounds.
 */
export function applyEdits(source: string, edits: NormalizedEdit[]): string {
  const lines = source.split('\n');
  // Sort descending: process bottom-of-file edits first
  const sorted = [...edits].sort(
    (a, b) => b.startLine - a.startLine || b.startColumn - a.startColumn,
  );

  for (const edit of sorted) {
    const { startLine, startColumn, endLine, endColumn, replacement } = edit;
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      throw new Error(
        `applyEdits: edit out of bounds (start=${startLine}:${startColumn}, end=${endLine}:${endColumn}, file has ${lines.length} lines)`,
      );
    }
    if (startLine === endLine) {
      const line = lines[startLine - 1];
      const before = line.slice(0, startColumn - 1);
      const after = line.slice(endColumn - 1);
      lines[startLine - 1] = before + replacement + after;
    } else {
      const firstLine = lines[startLine - 1];
      const lastLine = lines[endLine - 1];
      const before = firstLine.slice(0, startColumn - 1);
      const after = lastLine.slice(endColumn - 1);
      const merged = before + replacement + after;
      lines.splice(startLine - 1, endLine - startLine + 1, merged);
    }
  }

  return lines.join('\n');
}

/**
 * Compute a unified diff for human review (V1 will render this in the fix preview).
 * Minimal implementation — returns line-level adds/removes.
 */
export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export function computeLineDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const result: DiffLine[] = [];

  // Greedy line-by-line diff (not LCS — adequate for small file changes).
  let i = 0;
  let j = 0;
  while (i < beforeLines.length || j < afterLines.length) {
    if (i < beforeLines.length && j < afterLines.length && beforeLines[i] === afterLines[j]) {
      result.push({ type: 'context', oldLine: i + 1, newLine: j + 1, text: beforeLines[i] });
      i++;
      j++;
    } else if (j < afterLines.length && (i >= beforeLines.length || beforeLines[i] !== afterLines[j])) {
      result.push({ type: 'add', oldLine: null, newLine: j + 1, text: afterLines[j] });
      j++;
    } else {
      result.push({ type: 'remove', oldLine: i + 1, newLine: null, text: beforeLines[i] });
      i++;
    }
  }

  return result;
}
