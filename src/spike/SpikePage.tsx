import { useRef, useState } from 'react';
import { MODELS, type Tier } from '@/lib/llm/models';
import { detectAdapter, loadModel } from '@/lib/llm/loader';
import { translateFinding } from '@/lib/llm/translator';
import { startTimer } from '@/lib/measurement/instrument';
import type { RuffResponse } from '@/workers/ruff.worker';
import type { EslintResponse } from '@/workers/eslint.worker';
import type { PrettierResponse } from '@/workers/prettier.worker';
import { ResultsTable, type Measurement } from './ResultsTable';
import { PYTHON_SAMPLE, TYPESCRIPT_SAMPLE, HTML_SAMPLE, SAMPLE_FINDING } from './fixtures';
import { collectFiles, scanAllFiles, type ScannerKind, type FolderScanReport } from './folderScan';
import { FolderScanResults } from './FolderScanResults';
import { usePersistentDirectoryHandle } from '@/lib/hooks/usePersistentDirectoryHandle';
import { filesFromInput } from './fileInputFallback';
import { RootHandleProvider } from './RootHandleContext';
import { toReport } from './toReport';
import { SectionedReport } from '@/components/report/SectionedReport';
import type { ReportFinding } from '@/lib/report/types';
import { backupFile, writeFile } from '@/lib/fixes/backup';
import { recordBackup } from '@/lib/fixes/backupHistory';
import { applyEdits } from '@/lib/fixes/applyEdit';

type WorkerResponse = RuffResponse | EslintResponse | PrettierResponse;

export function SpikePage() {
  const [tier, setTier] = useState<Tier>('quick');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [engine, setEngine] = useState<any>(null);
  const [scanProgress, setScanProgress] = useState<string>('');
  const [folderReport, setFolderReport] = useState<FolderScanReport | null>(null);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const { lastHandle, saveHandle, verifyPermission } = usePersistentDirectoryHandle();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const push = (m: Measurement) => setMeasurements((prev) => [...prev, m]);

  async function handleApply(finding: ReportFinding): Promise<void> {
    if (!rootHandle || !finding.edits || finding.edits.length === 0) {
      throw new Error('Cannot apply: no rootHandle or no edits');
    }
    try {
      // 1. Read the current file content
      const parts = finding.file.split('/');
      let dir = rootHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]);
      }
      const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
      const file = await fileHandle.getFile();
      const content = await file.text();

      // 2. Backup
      const backupRecord = await backupFile(rootHandle, finding.file, content);
      await recordBackup(backupRecord);

      // 3. Apply edits
      const newContent = applyEdits(content, finding.edits);

      // 4. Write back
      await writeFile(rootHandle, finding.file, newContent);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DecodeMind apply error:', err);
      throw err;
    }
  }

  async function runDetectAdapter() {
    setBusy('detect-adapter');
    try {
      const adapter = await detectAdapter();
      push({
        label: 'WebGPU adapter',
        note: adapter ? `${adapter.vendor} / ${adapter.architecture}` : 'not available',
      });
    } catch (e) {
      push({ label: 'WebGPU adapter', note: `FAILED: ${(e as Error).message}` });
    }
    setBusy(null);
  }

  async function runLoadModel() {
    setBusy('load-model');
    setProgress('starting download…');
    try {
      const result = await loadModel(tier, (p) =>
        setProgress(`${Math.round(p.progress * 100)}% — ${p.text}`),
      );
      setEngine(result.engine);
      push({
        label: `Load ${MODELS[tier].label}`,
        durationMs: result.loadTimer.elapsedMs(),
        bytes: MODELS[tier].approxDiskBytes,
        note: 'cold load (first time, then cached)',
      });
      setProgress('loaded');
    } catch (e) {
      push({ label: `Load ${MODELS[tier].label}`, note: `FAILED: ${(e as Error).message}` });
      setProgress('');
    }
    setBusy(null);
  }

  async function runTranslate() {
    if (!engine) {
      push({ label: 'Translate 1 finding', note: 'no engine loaded' });
      return;
    }
    setBusy('translate-1');
    const t = startTimer();
    try {
      const out = await translateFinding(engine, SAMPLE_FINDING, 'en');
      push({
        label: 'Translate 1 finding',
        durationMs: t.elapsedMs(),
        count: out.length,
        note: `${out.slice(0, 60)}…`,
      });
    } catch (e) {
      push({ label: 'Translate 1 finding', note: `FAILED: ${(e as Error).message}` });
    }
    setBusy(null);
  }

  async function runTranslateBatch() {
    if (!engine) {
      push({ label: 'Translate batch of 8', note: 'no engine loaded' });
      return;
    }
    setBusy('translate-8');
    const t = startTimer();
    try {
      for (let i = 0; i < 8; i++) {
        await translateFinding(
          engine,
          { ...SAMPLE_FINDING, ruleId: `${SAMPLE_FINDING.ruleId}-${i}` },
          'en',
        );
      }
      push({
        label: 'Translate batch of 8 (sequential)',
        durationMs: t.elapsedMs(),
        count: 8,
        note: `avg ${Math.round(t.elapsedMs() / 8)} ms/finding`,
      });
    } catch (e) {
      push({ label: 'Translate batch of 8', note: `FAILED: ${(e as Error).message}` });
    }
    setBusy(null);
  }

  // Worker URLs MUST be relative literals (not `@/...` alias) for Vite's static
  // analyzer to bundle them as separate worker chunks. Using the alias produces
  // a broken inline data: URL in production build.
  async function runWorker<TReq, TRes extends WorkerResponse>(
    workerUrl: URL,
    request: TReq,
    label: string,
    extractMetrics: (res: Extract<TRes, { type: 'result' }>) => Omit<Measurement, 'label'>,
    timeoutMs = 120_000,
  ) {
    const worker = new Worker(workerUrl, { type: 'module' });
    const t = startTimer();
    try {
      worker.postMessage(request);
      const result = await new Promise<TRes>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`worker timeout after ${timeoutMs}ms`)),
          timeoutMs,
        );
        worker.onmessage = (e) => {
          clearTimeout(timer);
          resolve(e.data);
        };
        worker.onerror = (e) => {
          clearTimeout(timer);
          reject(new Error(e.message || 'worker error event'));
        };
        worker.onmessageerror = () => {
          clearTimeout(timer);
          reject(new Error('worker messageerror'));
        };
      });
      if (result.type === 'error') {
        push({ label, durationMs: t.elapsedMs(), note: `FAILED: ${result.message}` });
        return;
      }
      push({
        label,
        durationMs: t.elapsedMs(),
        ...extractMetrics(result as Extract<TRes, { type: 'result' }>),
      });
    } catch (err) {
      push({ label, durationMs: t.elapsedMs(), note: `FAILED: ${(err as Error).message}` });
    } finally {
      worker.terminate();
    }
  }

  async function runRuff() {
    setBusy('ruff');
    try {
      await runWorker<{ type: 'scan'; source: string }, RuffResponse>(
        new URL('../workers/ruff.worker.ts', import.meta.url),
        { type: 'scan', source: PYTHON_SAMPLE },
        'Ruff scan (sample.py)',
        (res) => ({ count: res.diagnostics.length, note: `worker reported ${res.elapsedMs} ms internally` }),
      );
    } finally {
      setBusy(null);
    }
  }

  async function runEslint() {
    setBusy('eslint');
    try {
      await runWorker<{ type: 'lint'; source: string; filename: string }, EslintResponse>(
        new URL('../workers/eslint.worker.ts', import.meta.url),
        { type: 'lint', source: TYPESCRIPT_SAMPLE, filename: 'sample.ts' },
        'ESLint scan (sample.ts)',
        (res) => ({ count: res.messages.length, note: `worker reported ${res.elapsedMs} ms internally` }),
      );
    } finally {
      setBusy(null);
    }
  }

  async function runPrettier() {
    setBusy('prettier');
    try {
      await runWorker<{ type: 'format'; source: string; parser: 'html' }, PrettierResponse>(
        new URL('../workers/prettier.worker.ts', import.meta.url),
        { type: 'format', source: HTML_SAMPLE, parser: 'html' },
        'Prettier format (sample.html)',
        (res) => ({ bytes: res.formatted.length, note: `worker reported ${res.elapsedMs} ms internally` }),
      );
    } finally {
      setBusy(null);
    }
  }

  async function pickAndScan() {
    if (!('showDirectoryPicker' in window)) return;
    setBusy('folder-scan');
    setScanProgress('Picking folder…');
    setFolderReport(null);
    try {
      const pickedHandle = await (window as typeof window & {
        showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker();
      setRootHandle(pickedHandle);

      setScanProgress('Collecting files…');
      const { files, warnings } = await collectFiles(pickedHandle);

      if (files.length === 0) {
        setScanProgress('No supported files found in the selected folder.');
        setBusy(null);
        return;
      }

      setScanProgress(`Starting scan of ${files.length} files…`);

      const report = await scanAllFiles(
        files,
        (done: Record<ScannerKind, number>, total: Record<ScannerKind, number>) => {
          const parts: string[] = [];
          if (total.ruff > 0) parts.push(`Ruff ${done.ruff}/${total.ruff}`);
          if (total.eslint > 0) parts.push(`ESLint ${done.eslint}/${total.eslint}`);
          const prettierDone = done['prettier-html'] + done['prettier-css'];
          const prettierTotal = total['prettier-html'] + total['prettier-css'];
          if (prettierTotal > 0) parts.push(`Prettier ${prettierDone}/${prettierTotal}`);
          setScanProgress(`Scanning: ${parts.join(', ')}`);
        },
      );

      // Merge collectFiles warnings with scan warnings
      setFolderReport({ ...report, warnings: [...warnings, ...report.warnings] });
      setScanProgress('');
      await saveHandle(pickedHandle);
    } catch (err) {
      // User cancelled the picker (AbortError) — clear quietly
      if ((err as { name?: string }).name !== 'AbortError') {
        // eslint-disable-next-line no-console
        console.error('DecodeMind scan error:', err);
        setScanProgress(`Error: ${(err as Error).message}`);
      } else {
        setScanProgress('');
      }
    }
    setBusy(null);
  }

  async function rescanLastHandle() {
    if (!lastHandle) return;
    setBusy('folder-scan');
    setScanProgress('Verifying permission…');
    setFolderReport(null);
    try {
      const ok = await verifyPermission(lastHandle);
      if (!ok) {
        setScanProgress('Permission denied for saved folder.');
        setBusy(null);
        return;
      }
      setRootHandle(lastHandle);
      setScanProgress('Collecting files…');
      const { files, warnings } = await collectFiles(lastHandle);
      if (files.length === 0) {
        setScanProgress('No supported files found in the selected folder.');
        setBusy(null);
        return;
      }
      setScanProgress(`Starting scan of ${files.length} files…`);
      const report = await scanAllFiles(
        files,
        (done: Record<ScannerKind, number>, total: Record<ScannerKind, number>) => {
          const parts: string[] = [];
          if (total.ruff > 0) parts.push(`Ruff ${done.ruff}/${total.ruff}`);
          if (total.eslint > 0) parts.push(`ESLint ${done.eslint}/${total.eslint}`);
          const prettierDone = done['prettier-html'] + done['prettier-css'];
          const prettierTotal = total['prettier-html'] + total['prettier-css'];
          if (prettierTotal > 0) parts.push(`Prettier ${prettierDone}/${prettierTotal}`);
          setScanProgress(`Scanning: ${parts.join(', ')}`);
        },
      );
      setFolderReport({ ...report, warnings: [...warnings, ...report.warnings] });
      setScanProgress('');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DecodeMind scan error:', err);
      setScanProgress(`Error: ${(err as Error).message}`);
    }
    setBusy(null);
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setBusy('folder-scan');
    setScanProgress('Reading files…');
    setFolderReport(null);
    try {
      const { files, warnings } = await filesFromInput(fileList);
      if (files.length === 0) {
        setScanProgress('No supported files found in the selected folder.');
        setBusy(null);
        return;
      }
      setScanProgress(`Starting scan of ${files.length} files…`);
      const report = await scanAllFiles(
        files,
        (done: Record<ScannerKind, number>, total: Record<ScannerKind, number>) => {
          const parts: string[] = [];
          if (total.ruff > 0) parts.push(`Ruff ${done.ruff}/${total.ruff}`);
          if (total.eslint > 0) parts.push(`ESLint ${done.eslint}/${total.eslint}`);
          const prettierDone = done['prettier-html'] + done['prettier-css'];
          const prettierTotal = total['prettier-html'] + total['prettier-css'];
          if (prettierTotal > 0) parts.push(`Prettier ${prettierDone}/${prettierTotal}`);
          setScanProgress(`Scanning: ${parts.join(', ')}`);
        },
      );
      setFolderReport({ ...report, warnings: [...warnings, ...report.warnings] });
      setScanProgress('');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('DecodeMind scan error:', err);
      setScanProgress(`Error: ${(err as Error).message}`);
    }
    setBusy(null);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(measurements, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decodemind-spike-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const report = folderReport ? toReport(folderReport) : null;

  return (
    <RootHandleProvider value={rootHandle}>
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">DecodeMind — Phase 0 Spike</h1>
        <p className="text-brand-muted">
          Click each button in order. Then export JSON and paste into the findings doc.
        </p>
      </header>

      <section className="bg-brand-card rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm">Model tier:</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
            className="bg-brand-surface border border-brand-muted rounded px-2 py-1"
          >
            {(['quick', 'better', 'best'] as Tier[]).map((t) => (
              <option key={t} value={t}>
                {MODELS[t].label}
              </option>
            ))}
          </select>
          <span className="text-sm text-brand-muted">{MODELS[tier].recommendation}</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={runDetectAdapter} disabled={!!busy}>Detect WebGPU adapter</Button>
          <Button onClick={runLoadModel} disabled={!!busy}>Load model</Button>
          <Button onClick={runTranslate} disabled={!!busy || !engine}>Translate 1 finding</Button>
          <Button onClick={runTranslateBatch} disabled={!!busy || !engine}>Translate batch of 8</Button>
          <Button onClick={runRuff} disabled={!!busy}>Scan Python with Ruff</Button>
          <Button onClick={runEslint} disabled={!!busy}>Lint TS with ESLint</Button>
          <Button onClick={runPrettier} disabled={!!busy}>Format HTML with Prettier</Button>
        </div>

        {busy && <p className="text-sm text-brand-accent">⏳ {busy} — {progress}</p>}
      </section>

      <section className="bg-brand-card rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Scan a real folder</h2>
          {'showDirectoryPicker' in window
            ? <Button onClick={pickAndScan} disabled={!!busy}>Pick a folder…</Button>
            : null}
        </div>
        {lastHandle && (
          <div>
            <Button onClick={rescanLastHandle} disabled={!!busy}>
              Pick last folder again
            </Button>
          </div>
        )}
        {'showDirectoryPicker' in window ? null : (
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => fileInputRef.current?.click()} disabled={!!busy}>
              Choose folder (read-only)
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              // @ts-expect-error — webkitdirectory is not in React's HTMLInputElement types
              webkitdirectory=""
              multiple
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <p className="text-sm text-brand-warn">
              Your browser doesn&apos;t support folder picking — using read-only fallback.
            </p>
          </div>
        )}
        {scanProgress && (
          scanProgress.startsWith('Error:') ? (
            <div className="bg-brand-danger/20 border border-brand-danger rounded p-3 text-sm">
              <strong className="text-brand-danger">Scan failed.</strong> {scanProgress.slice(6).trim()}
              <div className="text-xs text-brand-muted mt-1">Check DevTools Console for the full stack.</div>
            </div>
          ) : (
            <p className="text-sm text-brand-accent">⏳ {scanProgress}</p>
          )
        )}
        {folderReport && <FolderScanResults report={folderReport} />}
      </section>

      {report && (
        <section className="bg-brand-card rounded-lg p-4 space-y-3">
          <SectionedReport report={report} onApplyFinding={handleApply} />
        </section>
      )}

      <section className="bg-brand-card rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Measurements</h2>
          <Button onClick={exportJson} disabled={measurements.length === 0}>
            Export JSON
          </Button>
        </div>
        <ResultsTable measurements={measurements} />
      </section>

      <section className="bg-brand-card rounded-lg p-4 text-sm text-brand-muted">
        <p className="font-semibold mb-1">Note: ast-grep button is omitted from this spike.</p>
        <p>
          The ast-grep worker requires tree-sitter grammar .wasm files served from <code>/tree-sitter-&lt;lang&gt;.wasm</code>.
          Setting this up is a separate task; the worker compiles and the message contract is verified by typecheck,
          but a live scan needs the grammar copied to <code>public/</code>.
        </p>
      </section>
    </div>
    </RootHandleProvider>
  );
}

function Button({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-brand-primary hover:bg-blue-700 disabled:bg-brand-muted disabled:cursor-not-allowed text-white text-sm px-3 py-1.5 rounded transition-colors"
    >
      {children}
    </button>
  );
}
