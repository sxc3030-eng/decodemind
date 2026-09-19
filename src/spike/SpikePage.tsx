import { useEffect, useRef, useState } from 'react';

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
import { MODELS, type Tier } from '@/lib/llm/models';
import { detectAdapter, loadModel } from '@/lib/llm/loader';
import { translateFinding } from '@/lib/llm/translator';
import { startTimer, formatBytes } from '@/lib/measurement/instrument';
import type { RuffResponse } from '@/workers/ruff.worker';
import type { EslintResponse } from '@/workers/eslint.worker';
import type { PrettierResponse } from '@/workers/prettier.worker';
import { ResultsTable, type Measurement } from './ResultsTable';
import { PYTHON_SAMPLE, TYPESCRIPT_SAMPLE, HTML_SAMPLE, SAMPLE_FINDING } from './fixtures';
import {
  collectFiles,
  scanAllFiles,
  makeRuffWorker,
  makeEslintWorker,
  makePrettierWorker,
  type ScannerKind,
  type FolderScanReport,
} from './folderScan';
import { FolderScanResults } from './FolderScanResults';
import { usePersistentDirectoryHandle } from '@/lib/hooks/usePersistentDirectoryHandle';
import { filesFromInput } from './fileInputFallback';
import { RootHandleProvider } from './RootHandleContext';
import { toReport } from './toReport';
import { SectionedReport } from '@/components/report/SectionedReport';
import { TierSelectionModal } from '@/components/TierSelectionModal';
import type { ReportFinding } from '@/lib/report/types';
import { backupFile, writeFile } from '@/lib/fixes/backup';
import { recordBackup } from '@/lib/fixes/backupHistory';
import { applyEdits } from '@/lib/fixes/applyEdit';
import { marquerAnalyse } from '@/lib/pwa/miseAJour';

type WorkerResponse = RuffResponse | EslintResponse | PrettierResponse;

export function SpikePage() {
  const [tier, setTier] = useState<Tier>('quick');
  // La fenetre de confirmation etait ecrite et testee depuis le debut, mais
  // jamais montee : elle disparaissait meme du paquet livre, eliminee comme
  // code mort. Resultat, un clic sur « Load model » lancait 840 Mo a 4,1 Go
  // sans que personne n'ait jamais vu un chiffre.
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
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

  // ── Eager ast-grep warmup ──────────────────────────────────────────────────
  // Spin up the ast-grep worker the moment the page mounts and ship a
  // `warmup` message so tree-sitter + the most common grammars are compiled
  // long before the user clicks "Pick a folder". Without this, the first
  // rule of the first scan eats a ~30-60s cold-load and trips the worker
  // timeout. The worker is kept alive across multiple scans (each scan
  // gets it via the optional `preWarmedAstGrepWorker` arg to scanAllFiles)
  // and only torn down on unmount.
  const warmupWorkerRef = useRef<Worker | null>(null);
  const [warmupState, setWarmupState] = useState<'idle' | 'warming' | 'warmed' | 'failed'>('idle');
  const [warmupElapsedMs, setWarmupElapsedMs] = useState<number | null>(null);
  const [warmupTickMs, setWarmupTickMs] = useState<number>(0);

  useEffect(() => {
    const warmStart = performance.now();
    let cancelled = false;
    let tickTimer: ReturnType<typeof setInterval> | null = null;
    let w: Worker;
    try {
      w = new Worker(new URL('../workers/ast-grep.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[DecodeMind/warmup] worker construction failed', err);
      setWarmupState('failed');
      return;
    }
    warmupWorkerRef.current = w;
    setWarmupState('warming');
    setWarmupTickMs(0);
    tickTimer = setInterval(() => {
      if (!cancelled) setWarmupTickMs(performance.now() - warmStart);
    }, 200);

    w.onmessage = (e: MessageEvent<{ type: string; elapsedMs?: number; message?: string }>) => {
      if (cancelled) return;
      const data = e.data;
      if (data.type === 'warmed') {
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        const elapsed = data.elapsedMs ?? Math.round(performance.now() - warmStart);
        setWarmupElapsedMs(elapsed);
        setWarmupState('warmed');
        // eslint-disable-next-line no-console
        console.info(`[DecodeMind/warmup] grammars ready in ${elapsed}ms`);
      } else if (data.type === 'error') {
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        // eslint-disable-next-line no-console
        console.error(`[DecodeMind/warmup] worker reported error: ${data.message}`);
        setWarmupState('failed');
      }
    };
    w.onerror = (e) => {
      if (cancelled) return;
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      // eslint-disable-next-line no-console
      console.error('[DecodeMind/warmup] worker onerror', e.message);
      setWarmupState('failed');
    };

    w.postMessage({
      type: 'warmup',
      languages: ['python', 'javascript', 'typescript'],
    });

    return () => {
      cancelled = true;
      if (tickTimer) clearInterval(tickTimer);
      // Tear down the warmup worker on unmount. In React 18 strict mode
      // dev-double-mount, the first instance gets terminated immediately
      // and the second mount creates a fresh worker — the warmup cost is
      // paid twice in dev but production runs once.
      try { w.terminate(); } catch { /* ignore */ }
      if (warmupWorkerRef.current === w) warmupWorkerRef.current = null;
    };
  }, []);

  // Tant qu'une analyse tourne, aucune mise a jour ne recharge la page.
  useEffect(() => {
    marquerAnalyse(!!busy);
  }, [busy]);

  const push = (m: Measurement) => setMeasurements((prev) => [...prev, m]);

  async function handleApply(finding: ReportFinding): Promise<void> {
    if (!rootHandle || !finding.edits || finding.edits.length === 0) {
      throw new Error('Cannot apply: no rootHandle or no edits');
    }

    // 1. Walk to file
    const parts = finding.file.split('/');
    let dir = rootHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);

    // 2. Read current content + hash
    const fileBefore = await fileHandle.getFile();
    const beforeContent = await fileBefore.text();
    const beforeSha = await sha256(beforeContent);
    // eslint-disable-next-line no-console
    console.log(`[DecodeMind/apply] ${finding.file} before: ${beforeContent.length}b sha=${beforeSha.slice(0, 12)}`);

    // 3. Backup
    const backupRecord = await backupFile(rootHandle, finding.file, beforeContent);
    await recordBackup(backupRecord);
    // eslint-disable-next-line no-console
    console.log(`[DecodeMind/apply] backup: ${backupRecord.backupPath}`);

    // 4. Apply edits
    const expectedContent = applyEdits(beforeContent, finding.edits);
    const expectedSha = await sha256(expectedContent);
    // eslint-disable-next-line no-console
    console.log(`[DecodeMind/apply] expected after: ${expectedContent.length}b sha=${expectedSha.slice(0, 12)}`);

    if (expectedSha === beforeSha) {
      // eslint-disable-next-line no-console
      console.warn(`[DecodeMind/apply] applyEdits produced identical content — the edit coordinates may not match this finding. Skipping write.`);
      throw new Error('Edit produced no change — content identical before/after applyEdits');
    }

    // 5. Write
    await writeFile(rootHandle, finding.file, expectedContent);

    // 6. Verify: re-read fresh and hash
    const fileAfter = await fileHandle.getFile();
    const actualContent = await fileAfter.text();
    const actualSha = await sha256(actualContent);
    // eslint-disable-next-line no-console
    console.log(`[DecodeMind/apply] actual after: ${actualContent.length}b sha=${actualSha.slice(0, 12)}`);

    if (actualSha !== expectedSha) {
      const msg =
        `Write verification failed: file on disk does not match what we wrote. ` +
        `Expected sha ${expectedSha.slice(0, 12)}…, got ${actualSha.slice(0, 12)}…. ` +
        `Check if another tool (IDE auto-format, pre-commit hook) is overwriting.`;
      // eslint-disable-next-line no-console
      console.error(`[DecodeMind/apply] ${msg}`);
      throw new Error(msg);
    }
    // eslint-disable-next-line no-console
    console.log(`[DecodeMind/apply] VERIFY OK`);
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

  // Le bouton n'engage plus rien : il demande. Le telechargement ne part
  // qu'apres un choix explicite dans la fenetre, ou celui-ci est chiffre.
  function demanderLeModele() {
    setConfirmationOuverte(true);
  }

  function choixDeModele(choix: Tier | 'skip') {
    setConfirmationOuverte(false);
    if (choix === 'skip') return;
    setTier(choix);
    void runLoadModel(choix);
  }

  async function runLoadModel(choisi: Tier = tier) {
    setBusy('load-model');
    setProgress('starting download…');
    try {
      const result = await loadModel(choisi, (p) =>
        setProgress(`${Math.round(p.progress * 100)}% — ${p.text}`),
      );
      setEngine(result.engine);
      push({
        label: `Load ${MODELS[choisi].label}`,
        durationMs: result.loadTimer.elapsedMs(),
        bytes: MODELS[choisi].approxDiskBytes,
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

  // On reçoit une FABRIQUE, jamais une adresse. Vite ne réécrit
  // `new URL('…worker.ts', import.meta.url)` que lorsqu'il est l'argument
  // direct de `new Worker(...)`. Passée en paramètre, l'adresse lui échappe :
  // le fichier .ts part alors comme ressource brute, servie en `video/mp2t`
  // — le type MIME des flux vidéo, que l'extension .ts déclenche — et le
  // travailleur ne démarre jamais. C'est ce qui cassait les trois boutons
  // d'analyse jusqu'au 2026-09-13, sans le moindre message.
  // Les fabriques vivent dans folderScan.ts, où le patron était déjà correct.
  async function runWorker<TReq, TRes extends WorkerResponse>(
    creerWorker: () => Worker,
    request: TReq,
    label: string,
    extractMetrics: (res: Extract<TRes, { type: 'result' }>) => Omit<Measurement, 'label'>,
    timeoutMs = 120_000,
  ) {
    const worker = creerWorker();
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
        makeRuffWorker,
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
        makeEslintWorker,
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
        makePrettierWorker,
        { type: 'format', source: HTML_SAMPLE, parser: 'html' },
        'Prettier format (sample.html)',
        (res) => ({ bytes: res.formatted.length, note: `worker reported ${res.elapsedMs} ms internally` }),
      );
    } finally {
      setBusy(null);
    }
  }

  /**
   * Build a multi-line progress message including:
   *   - elapsed time since scan started
   *   - per-scanner progress (Ruff, ESLint, Prettier, ast-grep, OSV, Dockerfile, YAML)
   *   - overall percentage (done units / total units across all scanners)
   * Only scanners with `total > 0` appear, so a Python-only scan shows just
   * Ruff + ast-grep, not the empty ESLint / Prettier counters.
   */
  function formatProgress(
    done: Record<ScannerKind, number>,
    total: Record<ScannerKind, number>,
    startMs: number,
  ): string {
    const elapsed = ((performance.now() - startMs) / 1000).toFixed(1);
    const parts: string[] = [];
    if (total.ruff > 0) parts.push(`Ruff ${done.ruff}/${total.ruff}`);
    if (total.eslint > 0) parts.push(`ESLint ${done.eslint}/${total.eslint}`);
    const prettierDone = done['prettier-html'] + done['prettier-css'];
    const prettierTotal = total['prettier-html'] + total['prettier-css'];
    if (prettierTotal > 0) parts.push(`Prettier ${prettierDone}/${prettierTotal}`);
    if (total['ast-grep'] > 0) parts.push(`ast-grep ${done['ast-grep']}/${total['ast-grep']}`);
    if (total.osv > 0) parts.push(`OSV ${done.osv}/${total.osv}`);
    if (total.dockerfile > 0) parts.push(`Dockerfile ${done.dockerfile}/${total.dockerfile}`);
    if (total.yaml > 0) parts.push(`YAML ${done.yaml}/${total.yaml}`);

    const totalUnits = Object.values(total).reduce((a, b) => a + b, 0);
    const doneUnits = Object.values(done).reduce((a, b) => a + b, 0);
    const pct = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;

    return `Scanning ${pct}% · ${elapsed}s elapsed · ${parts.join(', ')}`;
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

      const _scanStart = performance.now();
      const report = await scanAllFiles(
        files,
        (done: Record<ScannerKind, number>, total: Record<ScannerKind, number>) => {
          setScanProgress(formatProgress(done, total, _scanStart));
        },
        warmupWorkerRef.current ?? undefined,
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
      const _scanStartB = performance.now();
      const report = await scanAllFiles(
        files,
        (done: Record<ScannerKind, number>, total: Record<ScannerKind, number>) => {
          setScanProgress(formatProgress(done, total, _scanStartB));
        },
        warmupWorkerRef.current ?? undefined,
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
      const _scanStartC = performance.now();
      const report = await scanAllFiles(
        files,
        (done: Record<ScannerKind, number>, total: Record<ScannerKind, number>) => {
          setScanProgress(formatProgress(done, total, _scanStartC));
        },
        warmupWorkerRef.current ?? undefined,
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
    {/* Fenêtre de confirmation du modèle. Elle annonce le poids réel du
        téléchargement — 840 Mo, 1,9 Go ou 4,1 Go — avant qu'il parte. */}
    <TierSelectionModal
      open={confirmationOuverte}
      recommendedTier={tier}
      onSelect={choixDeModele}
      onClose={() => setConfirmationOuverte(false)}
    />
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">DecodeMind</h1>
        <p className="text-lg text-brand-muted">
          Analyse votre code et trouve les problèmes <strong>sans jamais l&apos;envoyer nulle part</strong>.
          Tout tourne dans votre navigateur.
        </p>
        <p className="text-sm text-brand-muted mt-2">
          Python, TypeScript et HTML. Choisissez un dossier : rien ne part sur un serveur,
          ni chez nous, ni ailleurs.
        </p>
        <p className="text-xs text-brand-muted/70 mt-1 font-mono">
          v{import.meta.env.VITE_APP_VERSION ?? 'dev'}
          {' · '}
          <span title="git commit">{import.meta.env.VITE_APP_COMMIT ?? 'unknown'}</span>
          {' · '}
          <span title="build time (UTC)">{import.meta.env.VITE_APP_BUILT ?? 'live'}</span>
          {import.meta.env.DEV ? ' · dev' : ' · prod'}
          {warmupState === 'warming' && (
            <span className="text-brand-accent">
              {' · '}warming grammars… ({(warmupTickMs / 1000).toFixed(1)}s elapsed)
            </span>
          )}
          {warmupState === 'warmed' && warmupElapsedMs !== null && (
            <span className="text-brand-accent">
              {' · '}grammar ready ({(warmupElapsedMs / 1000).toFixed(1)}s)
            </span>
          )}
          {warmupState === 'failed' && (
            <span className="text-brand-warn">{' · '}grammar warmup failed (will retry on first scan)</span>
          )}
        </p>
      </header>

      <section className="bg-brand-card rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Analysez un dossier</h2>
          {'showDirectoryPicker' in window
            ? <Button onClick={pickAndScan} disabled={!!busy}>Choisir un dossier…</Button>
            : null}
        </div>
        <p className="text-sm text-brand-muted">
          Le dossier est lu sur votre appareil. Aucun fichier n&apos;est téléversé, aucune
          copie n&apos;est gardée.
        </p>
        {lastHandle && (
          <div>
            <Button onClick={rescanLastHandle} disabled={!!busy}>
              Reprendre le dernier dossier
            </Button>
          </div>
        )}
        {'showDirectoryPicker' in window ? null : (
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => fileInputRef.current?.click()} disabled={!!busy}>
              Choisir un dossier (lecture seule)
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
              Votre navigateur ne sait pas ouvrir un dossier entier : on passe en lecture seule.
            </p>
          </div>
        )}
        {scanProgress && (
          scanProgress.startsWith('Error:') ? (
            <div className="bg-brand-danger/20 border border-brand-danger rounded p-3 text-sm">
              <strong className="text-brand-danger">L&apos;analyse a échoué.</strong> {scanProgress.slice(6).trim()}
              <div className="text-xs text-brand-muted mt-1">La console du navigateur garde le détail.</div>
            </div>
          ) : (
            <p className="text-sm text-brand-accent">⏳ {scanProgress}</p>
          )
        )}
        {folderReport && <FolderScanResults report={folderReport} />}
      </section>

      <details className="bg-brand-card rounded-lg p-4">
        <summary className="text-xl font-semibold cursor-pointer">
          Explications en français, et essais sur un exemple
        </summary>
        <p className="text-sm text-brand-muted mt-2">
          Facultatif. Un modèle téléchargé une seule fois peut reformuler chaque
          problème trouvé en français clair. Il reste ensuite sur votre appareil.
        </p>
        <div className="space-y-3 mt-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm">Taille du modèle :</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
            className="bg-brand-surface border border-brand-muted rounded px-2 py-1"
          >
            {/* La taille du telechargement s'affiche ici, en clair, AVANT
                tout clic. « Quick (1.5B) » parle de milliards de parametres,
                pas d'octets : personne hors du metier ne peut deviner que ce
                bouton engage 840 Mo, ni 4,1 Go pour « Best ». Sur un forfait
                mobile, ca se compte en argent. La donnee existait depuis le
                debut dans MODELS[t].approxDiskBytes ; elle ne sortait nulle
                part. */}
            {(['quick', 'better', 'best'] as Tier[]).map((t) => (
              <option key={t} value={t}>
                {MODELS[t].label} — {formatBytes(MODELS[t].approxDiskBytes)} à télécharger
              </option>
            ))}
          </select>
          <span className="text-sm text-brand-muted">{MODELS[tier].recommendation}</span>
        </div>
        <p className="text-sm text-brand-muted">
          Le modèle choisi représente{' '}
          <strong>{formatBytes(MODELS[tier].approxDiskBytes)} à télécharger</strong>{' '}
          et environ {formatBytes(MODELS[tier].approxVramBytes)} de mémoire vidéo.
          Le téléchargement ne part qu'à votre demande, et reste ensuite sur
          votre appareil.
        </p>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={runDetectAdapter} disabled={!!busy}>Vérifier la carte graphique</Button>
          <Button onClick={demanderLeModele} disabled={!!busy}>Télécharger le modèle</Button>
          <Button onClick={runTranslate} disabled={!!busy || !engine}>Expliquer un problème</Button>
          <Button onClick={runTranslateBatch} disabled={!!busy || !engine}>En expliquer huit</Button>
          <Button onClick={runRuff} disabled={!!busy}>Essai Python (Ruff)</Button>
          <Button onClick={runEslint} disabled={!!busy}>Essai TypeScript (ESLint)</Button>
          <Button onClick={runPrettier} disabled={!!busy}>Essai HTML (Prettier)</Button>
        </div>

        {busy && <p className="text-sm text-brand-accent">⏳ {busy} — {progress}</p>}
        </div>
      </details>

      {report && (
        <section className="bg-brand-card rounded-lg p-4 space-y-3">
          <SectionedReport
            report={report}
            onApplyFinding={handleApply}
            onRescan={rootHandle ? rescanLastHandle : undefined}
          />
        </section>
      )}

      <details className="bg-brand-card rounded-lg p-4">
        <summary className="text-xl font-semibold cursor-pointer">Détails techniques</summary>

        <div className="flex justify-between items-center mt-3">
          <h3 className="text-lg font-semibold">Mesures</h3>
          <Button onClick={exportJson} disabled={measurements.length === 0}>
            Exporter en JSON
          </Button>
        </div>
        <ResultsTable measurements={measurements} />

        <div className="text-sm text-brand-muted mt-4">
          <p className="font-semibold mb-1">Ce qui n&apos;est pas encore en place</p>
          <p>
            L&apos;analyse sémantique (ast-grep) attend ses grammaires tree-sitter, servies
            depuis <code>/tree-sitter-&lt;lang&gt;.wasm</code>. Le worker compile et son
            contrat de messages est vérifié, mais aucune analyse sémantique ne tourne
            tant que les grammaires ne sont pas dans <code>public/</code>. Les analyses
            Python, TypeScript et HTML, elles, fonctionnent.
          </p>
        </div>
      </details>
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
