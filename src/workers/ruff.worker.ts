/// <reference lib="webworker" />
import init, { Workspace, PositionEncoding } from '@astral-sh/ruff-wasm-web';

// API deviation: The actual Workspace constructor requires a second argument
// `position_encoding: PositionEncoding` (not present in the task spec).
// Source: node_modules/@astral-sh/ruff-wasm-web/ruff_wasm.d.ts line 56.

// API deviation: The actual Diagnostic type uses `start_location` (not `location`)
// for the start position. RuffDiagnostic below reflects the real shape.
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

export interface RuffResponse {
  type: 'result';
  diagnostics: RuffDiagnostic[];
  elapsedMs: number;
}

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
        PositionEncoding.Utf16,
      );
    })();
  }
  return workspacePromise;
}

self.onmessage = async (event: MessageEvent<RuffRequest>) => {
  if (event.data.type !== 'scan') return;
  const start = Date.now();
  const workspace = await getWorkspace();
  const diagnostics = workspace.check(event.data.source) as RuffDiagnostic[];
  const elapsedMs = Date.now() - start;
  const response: RuffResponse = { type: 'result', diagnostics, elapsedMs };
  self.postMessage(response);
};
