export interface Timer {
  label: string;
  elapsedMs(): number;
  toString(): string;
}

export function startTimer(label = 'unnamed'): Timer {
  const start = Date.now();
  return {
    label,
    elapsedMs() {
      return Date.now() - start;
    },
    toString() {
      return `${label}: ${this.elapsedMs()} ms`;
    },
  };
}

export function formatBytes(bytes: number): string {
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
