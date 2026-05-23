import { describe, it, expect } from 'vitest';
import { recordBackup, listBackups, clearOldBackups } from '@/lib/fixes/backupHistory';

describe('backupHistory module shape', () => {
  it('exports the 3 functions', () => {
    expect(typeof recordBackup).toBe('function');
    expect(typeof listBackups).toBe('function');
    expect(typeof clearOldBackups).toBe('function');
  });
});
