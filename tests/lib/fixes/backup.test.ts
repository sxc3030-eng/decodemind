import { describe, it, expect } from 'vitest';
import { backupFile, restoreBackup, writeFile } from '@/lib/fixes/backup';

describe('backup module shape', () => {
  it('exports the 3 functions', () => {
    expect(typeof backupFile).toBe('function');
    expect(typeof restoreBackup).toBe('function');
    expect(typeof writeFile).toBe('function');
  });
});
