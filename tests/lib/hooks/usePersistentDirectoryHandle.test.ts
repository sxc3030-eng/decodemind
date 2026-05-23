import { describe, it, expect } from 'vitest';
import { usePersistentDirectoryHandle } from '@/lib/hooks/usePersistentDirectoryHandle';

describe('usePersistentDirectoryHandle module', () => {
  it('exports the hook', () => {
    expect(typeof usePersistentDirectoryHandle).toBe('function');
  });
});
