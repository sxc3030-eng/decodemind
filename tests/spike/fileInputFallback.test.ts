import { describe, it, expect } from 'vitest';
import { filesFromInput } from '@/spike/fileInputFallback';

function makeFile(path: string, content: string): File {
  const f = new File([content], path.split('/').pop() ?? path);
  Object.defineProperty(f, 'webkitRelativePath', { value: path });
  // jsdom's File does not implement .text() — polyfill for testing
  Object.defineProperty(f, 'text', {
    value: () => Promise.resolve(content),
    writable: false,
  });
  return f;
}

function makeFileList(files: File[]): FileList {
  return {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () {
      for (const f of files) yield f;
    },
    ...Object.fromEntries(files.map((f, i) => [i, f])),
  } as unknown as FileList;
}

describe('filesFromInput', () => {
  it('matches by extension and respects ignore fragments', async () => {
    const list = makeFileList([
      makeFile('project/src/main.ts', 'const x = 1;'),
      makeFile('project/node_modules/dep/index.js', '// ignored'),
      makeFile('project/README.md', '# title (no scanner)'),
      makeFile('project/script.py', 'print(1)'),
    ]);
    const { files } = await filesFromInput(list);
    expect(files.map((f) => f.path).sort()).toEqual([
      'project/script.py',
      'project/src/main.ts',
    ]);
  });
});
