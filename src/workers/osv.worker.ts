/// <reference lib="webworker" />
/**
 * OSV scanner worker. Mirrors the message-passing pattern in `ruff.worker.ts`
 * — single `{ type: 'scan', files }` request, single `{ type: 'result' | 'error' }`
 * response. Scanning is pure CPU and no init phase is needed (the OSV DB is
 * compiled into source), so this worker exists mostly so the main thread stays
 * responsive when a monorepo carries many manifests.
 */

import type { AggregatedFinding } from '@/spike/folderScan';
import { scanManifest } from '@/lib/scanners/osv/scanner';

export interface OsvRequest {
  type: 'scan';
  files: { path: string; content: string }[];
}

export type OsvResponse =
  | { type: 'result'; findings: AggregatedFinding[]; elapsedMs: number }
  | { type: 'error'; message: string };

self.onmessage = (event: MessageEvent<OsvRequest>) => {
  if (event.data.type !== 'scan') return;
  try {
    const scanStart = performance.now();
    const findings: AggregatedFinding[] = [];
    for (const f of event.data.files) {
      findings.push(...scanManifest(f.path, f.content));
    }
    const elapsedMs = Math.round(performance.now() - scanStart);
    self.postMessage({ type: 'result', findings, elapsedMs } satisfies OsvResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message } satisfies OsvResponse);
  }
};
