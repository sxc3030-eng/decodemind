export interface Timer {
  readonly label: string;
  elapsedMs(): number;
  toString(): string;
}

// Date.now() rather than performance.now(): Vitest fake timers intercept Date.now()
// but not performance.now(), so this is required for testability. At millisecond
// granularity (all the spike needs) the two are equivalent.
export function startTimer(label = 'unnamed'): Timer {
  const start = Date.now();
  const elapsedMs = () => Date.now() - start;
  return {
    label,
    elapsedMs,
    // Closed-over label + elapsedMs (no `this`) so the method is safe to detach.
    toString: () => `${label}: ${elapsedMs()} ms`,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '? B';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes} m ${seconds} s`;
}
