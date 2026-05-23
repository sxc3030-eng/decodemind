/// <reference lib="webworker" />
import init, { Workspace, PositionEncoding } from '@astral-sh/ruff-wasm-web';

// API deviation: The actual Workspace constructor requires a second argument
// `position_encoding: PositionEncoding` (not present in the task spec).
// Source: node_modules/@astral-sh/ruff-wasm-web/ruff_wasm.d.ts line 56.
//
// API deviation: The actual Diagnostic type uses `start_location` (not `location`)
// for the start position. `code: string | null`, typed `fix.edits`. RuffDiagnostic
// below reflects the real shape.
// Source: node_modules/@astral-sh/ruff-wasm-web/ruff_wasm.d.ts lines 24-49.

export interface RuffRequest {
  type: 'scan';
  source: string;
}

export interface RuffDiagnostic {
  code: string | null;
  message: string;
  start_location: { row: number; column: number };
  end_location: { row: number; column: number };
  fix?: {
    message: string | null;
    edits: {
      content: string | null;
      location: { row: number; column: number };
      end_location: { row: number; column: number };
    }[];
  } | null;
}

export type RuffResponse =
  | { type: 'result'; diagnostics: RuffDiagnostic[]; elapsedMs: number }
  | { type: 'error'; message: string };

let workspacePromise: Promise<Workspace> | null = null;

async function getWorkspace(): Promise<Workspace> {
  if (!workspacePromise) {
    workspacePromise = (async () => {
      await init();
      return new Workspace(
        {
          'line-length': 100,
          lint: {
            select: ['E', 'F', 'W', 'S', 'B', 'C90', 'UP'],
          },
        },
        // UTF-16 because JavaScript strings are UTF-16 internally; matches the LSP
        // and editor convention. Switching to Utf8 would shift column offsets for
        // any source containing non-ASCII characters.
        PositionEncoding.Utf16,
      );
    })().catch((err) => {
      // Reset on failure so a retry can re-init (e.g. transient fetch failure of
      // the .wasm binary). Without this, one failed load would brick the worker.
      workspacePromise = null;
      throw err;
    });
  }
  return workspacePromise;
}

self.onmessage = async (event: MessageEvent<RuffRequest>) => {
  if (event.data.type !== 'scan') return;
  try {
    const workspace = await getWorkspace();
    const scanStart = performance.now(); // measure scan only, not init
    const diagnostics = workspace.check(event.data.source) as RuffDiagnostic[];
    const elapsedMs = Math.round(performance.now() - scanStart);
    self.postMessage({ type: 'result', diagnostics, elapsedMs } satisfies RuffResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message } satisfies RuffResponse);
  }
};
