import type { ScanFile, ScannerKind } from './folderScan';

const EXT_TO_SCANNER: Record<string, ScannerKind> = {
  '.py': 'ruff',
  '.ts': 'eslint', '.tsx': 'eslint', '.js': 'eslint', '.jsx': 'eslint',
  '.mjs': 'eslint', '.cjs': 'eslint',
  '.html': 'prettier-html', '.htm': 'prettier-html',
  '.css': 'prettier-css', '.scss': 'prettier-css',
};

const IGNORED_PATH_FRAGMENTS = [
  '/node_modules/', '/.git/', '/dist/', '/build/', '/.next/',
  '/vendor/', '/third_party/', '/whisper-cpp/', '/ggml/',
];

const MAX_FILES = 500;
const MAX_FILE_BYTES = 1_000_000;

/**
 * Fallback for Firefox / Safari which don't support `showDirectoryPicker`.
 * Reads FileList from an `<input webkitdirectory multiple>` and returns
 * the same ScanFile[] shape that folderScan.collectFiles produces.
 */
export async function filesFromInput(
  fileList: FileList,
): Promise<{ files: ScanFile[]; warnings: string[]; totalSeen: number }> {
  const files: ScanFile[] = [];
  const warnings: string[] = [];
  let totalSeen = 0;

  for (const file of Array.from(fileList)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const path = (file as any).webkitRelativePath as string;
    if (!path) continue;

    if (IGNORED_PATH_FRAGMENTS.some((frag) => path.includes(frag))) continue;

    const dotIdx = path.lastIndexOf('.');
    if (dotIdx === -1) continue;
    const ext = path.slice(dotIdx).toLowerCase();
    const scanner = EXT_TO_SCANNER[ext];
    if (!scanner) continue;

    totalSeen++;
    if (files.length >= MAX_FILES) continue;

    if (file.size > MAX_FILE_BYTES) {
      warnings.push(`Skipped ${path} (${(file.size / 1_048_576).toFixed(1)} MB > 1 MB limit)`);
      continue;
    }

    const content = await file.text();
    files.push({ path, content, scanner });
  }

  if (totalSeen > MAX_FILES) {
    warnings.unshift(`Folder has ${totalSeen} matched files, scanning first ${MAX_FILES}.`);
  }

  return { files, warnings, totalSeen };
}
