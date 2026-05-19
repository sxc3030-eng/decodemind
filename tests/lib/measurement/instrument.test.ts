import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startTimer, formatBytes, formatDuration } from '@/lib/measurement/instrument';

describe('startTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns elapsed ms when stopped', () => {
    const t = startTimer();
    vi.advanceTimersByTime(1234);
    expect(t.elapsedMs()).toBe(1234);
  });

  it('label appears in toString()', () => {
    const t = startTimer('load-model');
    vi.advanceTimersByTime(2000);
    expect(t.toString()).toBe('load-model: 2000 ms');
  });
});

describe('formatBytes', () => {
  it('formats KB', () => expect(formatBytes(1024)).toBe('1.0 KB'));
  it('formats MB', () => expect(formatBytes(1024 * 1024 * 5)).toBe('5.0 MB'));
  it('formats GB', () => expect(formatBytes(1024 ** 3 * 2.5)).toBe('2.5 GB'));
  it('handles 0', () => expect(formatBytes(0)).toBe('0 B'));
});

describe('formatDuration', () => {
  it('formats ms under 1s', () => expect(formatDuration(456)).toBe('456 ms'));
  it('formats seconds', () => expect(formatDuration(3500)).toBe('3.5 s'));
  it('formats minutes', () => expect(formatDuration(125000)).toBe('2 m 5 s'));
});
