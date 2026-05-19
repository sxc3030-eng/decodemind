export interface BackupRecord {
  originalPath: string;
  backupPath: string;
  timestamp: string;
}

/**
 * Save the original file to .decodemind-backup/{ISO-timestamp}-{flat-name}
 * Returns the backup record so the caller can later undo.
 *
 * Implementation uses File System Access API write methods. The root handle
 * is the user-picked folder; the backup folder is created inside it.
 */
export async function backupFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  content: string,
): Promise<BackupRecord> {
  const backupDir = await root.getDirectoryHandle('.decodemind-backup', { create: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  // Flatten the path to avoid recreating the nested directory structure inside the backup folder
  const flatName = relativePath.replace(/[/\\]/g, '_');
  const backupFileName = `${timestamp}-${flatName}`;

  const fileHandle = await backupDir.getFileHandle(backupFileName, { create: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writable = await (fileHandle as any).createWritable();
  await writable.write(content);
  await writable.close();

  return {
    originalPath: relativePath,
    backupPath: `.decodemind-backup/${backupFileName}`,
    timestamp,
  };
}

/**
 * Restore a file from a backup record. Reads the backup and writes it back
 * to the original path inside the same root.
 */
export async function restoreBackup(
  root: FileSystemDirectoryHandle,
  record: BackupRecord,
): Promise<void> {
  const backupDir = await root.getDirectoryHandle('.decodemind-backup');
  const backupName = record.backupPath.replace('.decodemind-backup/', '');
  const backupHandle = await backupDir.getFileHandle(backupName);
  const backupFile = await backupHandle.getFile();
  const text = await backupFile.text();

  // Walk to the original file (the path may have nested dirs).
  const parts = record.originalPath.split('/');
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]);
  }
  const originalHandle = await dir.getFileHandle(parts[parts.length - 1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writable = await (originalHandle as any).createWritable();
  await writable.write(text);
  await writable.close();
}

/**
 * Write modified content to a file inside the root. Used after `backupFile` so the
 * original is preserved.
 */
export async function writeFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  content: string,
): Promise<void> {
  const parts = relativePath.split('/');
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]);
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writable = await (fileHandle as any).createWritable();
  await writable.write(content);
  await writable.close();
}
