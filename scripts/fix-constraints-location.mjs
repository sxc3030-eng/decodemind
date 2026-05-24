#!/usr/bin/env node
// Move `constraints:` from inside `rule:` to top-level (sibling of `rule:`)
// for every ast-grep rule YAML that currently has it mis-nested.
//
// The DecodeMind rule library was written with `constraints:` indented under
// `rule:` (2-space deep). The ast-grep CLI rejects this with:
//   "unknown field `constraints`, expected one of `pattern`, `kind`, ..."
// Constraints belong at the TOP level of the rule file. This script does the
// mechanical re-indentation across all matched files.

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src/lib/rules/definitions';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.yml')) out.push(p);
  }
  return out;
}

let changed = 0;
let skipped = 0;

for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);

  // Find the line `  constraints:` at exactly 2-space indent (i.e. under `rule:`).
  // Only one such line per file is expected.
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^  constraints:\s*$/.test(lines[i])) { idx = i; break; }
  }
  if (idx === -1) { skipped++; continue; }

  // Find where the constraints block ends — the next line whose indentation is
  // <= 2 spaces (i.e. back to a rule-level or root-level key).
  let endIdx = lines.length; // default: rest of file
  for (let j = idx + 1; j < lines.length; j++) {
    const line = lines[j];
    // Skip empty lines and pure-comment lines (preserve their original indent)
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const indent = line.match(/^( *)/)[1].length;
    if (indent <= 2) { endIdx = j; break; }
  }

  // Re-indent: the `constraints:` line itself becomes column 0,
  // each subsequent line in the block loses 2 spaces of indent.
  const newBlock = [];
  newBlock.push('constraints:');
  for (let j = idx + 1; j < endIdx; j++) {
    const line = lines[j];
    if (line === '') { newBlock.push(''); continue; }
    if (/^ {2,}/.test(line)) {
      newBlock.push(line.slice(2));
    } else {
      newBlock.push(line);
    }
  }

  const newLines = [
    ...lines.slice(0, idx),
    ...newBlock,
    ...lines.slice(endIdx),
  ];

  writeFileSync(file, newLines.join('\n'), 'utf8');
  changed++;
  console.log(`fixed: ${file}`);
}

console.log(`\n${changed} files patched, ${skipped} unchanged.`);
