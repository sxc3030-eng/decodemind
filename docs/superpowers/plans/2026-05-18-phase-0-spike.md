# DecodeMind Phase 0 Spike — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a measurement spike that produces real performance numbers for WebLLM (Qwen 2.5 Coder), `@astral-sh/ruff-wasm-web`, `@ast-grep/wasm`, `eslint-linter-browserify`, and `prettier/standalone` running in the browser, so the V1 timeline and non-functional requirements can be revised from data instead of estimates.

**Architecture:** Standard Vite + React + TypeScript + Tailwind app. Web Workers for each scanner. WebLLM loaded on the main thread with WebGPU. Spike code lives in `src/spike/` and is removable once measurements are captured. Foundation code in `src/lib/` becomes the V1 starting point.

**Tech Stack:** Vite 5, React 18, TypeScript 5.5+, Tailwind CSS 3, Vitest, `@mlc-ai/web-llm` ^0.2.83, `@astral-sh/ruff-wasm-web`, `@ast-grep/wasm`, `eslint-linter-browserify`, `prettier/standalone` 3.8.

**This plan covers Phase 0 only (1-2 days).** After Phase 0 produces measurements, a separate V1 plan will be written.

---

## File Structure (locked decisions for this plan)

```
D:\decodemind\
├── package.json                              (created Task 1)
├── tsconfig.json                             (created Task 1)
├── tsconfig.node.json                        (created Task 1)
├── vite.config.ts                            (created Task 1)
├── index.html                                (created Task 1)
├── postcss.config.js                         (created Task 2)
├── tailwind.config.ts                        (created Task 2)
├── vitest.config.ts                          (created Task 3)
├── src/
│   ├── main.tsx                              (created Task 1)
│   ├── App.tsx                               (created Task 1)
│   ├── styles/
│   │   └── index.css                         (created Task 2)
│   ├── lib/
│   │   ├── measurement/
│   │   │   └── instrument.ts                 (created Task 4)
│   │   └── llm/
│   │       ├── models.ts                     (created Task 5)
│   │       ├── loader.ts                     (created Task 6)
│   │       └── translator.ts                 (created Task 7)
│   ├── workers/
│   │   ├── ruff.worker.ts                    (created Task 8)
│   │   ├── ast-grep.worker.ts                (created Task 9)
│   │   ├── eslint.worker.ts                  (created Task 10)
│   │   └── prettier.worker.ts                (created Task 11)
│   └── spike/
│       ├── SpikePage.tsx                     (created Task 12)
│       ├── ResultsTable.tsx                  (created Task 12)
│       ├── fixtures.ts                       (created Task 13)
│       └── rules/
│           └── llm-fake-pandas-method.yml    (created Task 9)
├── tests/
│   ├── setup.ts                              (created Task 3)
│   └── lib/
│       ├── measurement/
│       │   └── instrument.test.ts            (created Task 4)
│       └── llm/
│           ├── models.test.ts                (created Task 5)
│           └── translator.test.ts            (created Task 7)
└── docs/
    └── superpowers/
        └── spike-results/
            └── 2026-05-18-phase-0-findings.md (created Task 15)
```

**Responsibilities:**
- `src/lib/measurement/`: timing + size utilities, no UI deps
- `src/lib/llm/`: model registry, loader, translator — main-thread (WebLLM lives on main)
- `src/workers/`: one Web Worker per scanner, isolates heavy WASM/JS from UI
- `src/spike/`: throwaway UI for measurement; will be removed in V1
- `tests/`: Vitest for unit-testable pure functions (skip browser-only code in unit tests; verify via spike page manually)

---

## Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Initialize package.json**

Create `D:\decodemind\package.json`:

```json
{
  "name": "decodemind",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit"
  }
}
```

- [ ] **Step 2: Install Vite + React + TypeScript**

Run:
```powershell
cd D:\decodemind
npm install --save-dev vite@^5.4.0 @vitejs/plugin-react@^4.3.0 typescript@^5.5.0 @types/react@^18.3.0 @types/react-dom@^18.3.0
npm install react@^18.3.0 react-dom@^18.3.0
```

Expected: `node_modules/` created, no install errors.

- [ ] **Step 3: Create tsconfig.json**

Create `D:\decodemind\tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create tsconfig.node.json**

Create `D:\decodemind\tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 5: Create vite.config.ts**

Create `D:\decodemind\vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    headers: {
      // Required for WebGPU + SharedArrayBuffer (WebLLM)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', '@ast-grep/wasm', '@astral-sh/ruff-wasm-web'],
  },
});
```

- [ ] **Step 6: Create index.html**

Create `D:\decodemind\index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DecodeMind — Spike</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create src/main.tsx**

Create `D:\decodemind\src\main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Create src/App.tsx with placeholder**

Create `D:\decodemind\src\App.tsx`:

```typescript
import { SpikePage } from '@/spike/SpikePage';

export default function App() {
  return <SpikePage />;
}
```

Note: SpikePage will be created in Task 12. The TS compiler will error until then; that's expected.

- [ ] **Step 9: Commit**

Run:
```powershell
cd D:\decodemind
git add package.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/main.tsx src/App.tsx
git commit -m "chore: scaffold Vite + React + TS project"
```

---

## Task 2: Add Tailwind CSS

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.js`, `src/styles/index.css`

- [ ] **Step 1: Install Tailwind + PostCSS**

Run:
```powershell
cd D:\decodemind
npm install --save-dev tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0
```

- [ ] **Step 2: Create tailwind.config.ts**

Create `D:\decodemind\tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Placeholder DecodeMind palette — finalize before V1 design pass
        brand: {
          primary: '#2563EB',   // Blue 600 — trust + tech
          surface: '#0F172A',   // Slate 900 — dark UI
          card: '#1E293B',      // Slate 800
          accent: '#10B981',    // Emerald 500 — success / scans clean
          danger: '#EF4444',    // Red 500 — critical findings
          warn: '#F59E0B',      // Amber 500 — important findings
          muted: '#94A3B8',     // Slate 400
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Create postcss.config.js**

Create `D:\decodemind\postcss.config.js`:

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Create src/styles/index.css**

Create `D:\decodemind\src\styles\index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body {
    @apply bg-brand-surface text-slate-100 antialiased;
  }
  body {
    @apply min-h-screen;
  }
}
```

- [ ] **Step 5: Commit**

Run:
```powershell
cd D:\decodemind
git add tailwind.config.ts postcss.config.js src/styles/index.css package.json package-lock.json
git commit -m "chore: add Tailwind CSS with placeholder brand palette"
```

---

## Task 3: Add Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`

- [ ] **Step 1: Install Vitest**

Run:
```powershell
cd D:\decodemind
npm install --save-dev vitest@^2.1.0 @vitest/ui@^2.1.0 jsdom@^25.0.0 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.5.0
```

- [ ] **Step 2: Create vitest.config.ts**

Create `D:\decodemind\vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 3: Create tests/setup.ts**

Create `D:\decodemind\tests\setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Smoke-test by running a trivial test**

Create `D:\decodemind\tests\smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run:
```powershell
cd D:\decodemind
npm test
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

Run:
```powershell
cd D:\decodemind
git add vitest.config.ts tests/setup.ts tests/smoke.test.ts package.json package-lock.json
git commit -m "chore: add Vitest with jsdom + Testing Library"
```

---

## Task 4: Measurement instrumentation utility

**Files:**
- Create: `src/lib/measurement/instrument.ts`
- Test: `tests/lib/measurement/instrument.test.ts`

- [ ] **Step 1: Write the failing test**

Create `D:\decodemind\tests\lib\measurement\instrument.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
cd D:\decodemind
npm test -- tests/lib/measurement/instrument.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/measurement/instrument'`.

- [ ] **Step 3: Implement instrument.ts**

Create `D:\decodemind\src\lib\measurement\instrument.ts`:

```typescript
export interface Timer {
  label: string;
  elapsedMs(): number;
  toString(): string;
}

export function startTimer(label = 'unnamed'): Timer {
  const start = performance.now();
  return {
    label,
    elapsedMs() {
      return Math.round(performance.now() - start);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
cd D:\decodemind
npm test -- tests/lib/measurement/instrument.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

Run:
```powershell
cd D:\decodemind
git add src/lib/measurement/instrument.ts tests/lib/measurement/instrument.test.ts
git commit -m "feat(lib): timing + byte/duration formatting utilities"
```

---

## Task 5: LLM model registry

**Files:**
- Create: `src/lib/llm/models.ts`
- Test: `tests/lib/llm/models.test.ts`

- [ ] **Step 1: Write the failing test**

Create `D:\decodemind\tests\lib\llm\models.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MODELS, pickDefaultTier, type Tier } from '@/lib/llm/models';

describe('MODELS registry', () => {
  it('has three tiers', () => {
    expect(MODELS).toHaveProperty('quick');
    expect(MODELS).toHaveProperty('better');
    expect(MODELS).toHaveProperty('best');
  });

  it('each tier has model id, size, label', () => {
    for (const tier of ['quick', 'better', 'best'] as Tier[]) {
      const m = MODELS[tier];
      expect(typeof m.modelId).toBe('string');
      expect(typeof m.approxDiskBytes).toBe('number');
      expect(typeof m.label).toBe('string');
    }
  });

  it('best tier is Qwen 7B', () => {
    expect(MODELS.best.modelId).toBe('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
  });

  it('quick tier is Qwen 1.5B', () => {
    expect(MODELS.quick.modelId).toBe('Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC');
  });
});

describe('pickDefaultTier', () => {
  it('returns quick when no adapter info', () => {
    expect(pickDefaultTier(null)).toBe('quick');
  });

  it('returns better for dGPU vendor', () => {
    expect(pickDefaultTier({ vendor: 'nvidia', architecture: 'ada' })).toBe('better');
  });

  it('returns quick for Intel iGPU', () => {
    expect(pickDefaultTier({ vendor: 'intel', architecture: 'gen-12-lp' })).toBe('quick');
  });

  it('returns better for Apple Silicon', () => {
    expect(pickDefaultTier({ vendor: 'apple', architecture: 'apple-7' })).toBe('better');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
cd D:\decodemind
npm test -- tests/lib/llm/models.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/llm/models'`.

- [ ] **Step 3: Implement models.ts**

Create `D:\decodemind\src\lib\llm\models.ts`:

```typescript
export type Tier = 'quick' | 'better' | 'best';

export interface ModelDescriptor {
  tier: Tier;
  modelId: string;
  approxDiskBytes: number;
  approxVramBytes: number;
  label: string;
  recommendation: string;
}

export const MODELS: Record<Tier, ModelDescriptor> = {
  quick: {
    tier: 'quick',
    modelId: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    approxDiskBytes: 840 * 1024 * 1024,
    approxVramBytes: 1630 * 1024 * 1024,
    label: 'Quick (1.5B)',
    recommendation: 'Default. Works on most laptops, including Intel iGPUs.',
  },
  better: {
    tier: 'better',
    modelId: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC',
    approxDiskBytes: 1900 * 1024 * 1024,
    approxVramBytes: 2400 * 1024 * 1024,
    label: 'Better (3B)',
    recommendation: 'Recommended for dedicated GPU or Apple Silicon.',
  },
  best: {
    tier: 'best',
    modelId: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    approxDiskBytes: Math.round(4.1 * 1024 * 1024 * 1024),
    approxVramBytes: Math.round(5.1 * 1024 * 1024 * 1024),
    label: 'Best (7B)',
    recommendation: 'Power users only. Requires desktop GPU with >=6 GB VRAM.',
  },
};

export interface AdapterInfo {
  vendor: string;
  architecture: string;
}

export function pickDefaultTier(adapter: AdapterInfo | null): Tier {
  if (!adapter) return 'quick';
  const vendor = adapter.vendor.toLowerCase();
  if (vendor === 'intel') return 'quick';
  if (vendor === 'apple') return 'better';
  if (vendor === 'nvidia' || vendor === 'amd') return 'better';
  return 'quick';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
cd D:\decodemind
npm test -- tests/lib/llm/models.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

Run:
```powershell
cd D:\decodemind
git add src/lib/llm/models.ts tests/lib/llm/models.test.ts
git commit -m "feat(llm): model registry with three tiers + adapter-based default picker"
```

---

## Task 6: WebLLM model loader

**Files:**
- Create: `src/lib/llm/loader.ts`

Note: This task does **not** have a unit test — WebLLM requires WebGPU which jsdom doesn't have. It's verified manually via the spike page (Task 12).

- [ ] **Step 1: Install @mlc-ai/web-llm**

Run:
```powershell
cd D:\decodemind
npm install @mlc-ai/web-llm@^0.2.83
```

- [ ] **Step 2: Implement loader.ts**

Create `D:\decodemind\src\lib\llm\loader.ts`:

```typescript
import * as webllm from '@mlc-ai/web-llm';
import { startTimer, type Timer } from '@/lib/measurement/instrument';
import { MODELS, type Tier } from './models';

export interface LoadProgress {
  progress: number; // 0..1
  text: string;
  timeElapsedMs: number;
}

export interface LoadResult {
  engine: webllm.MLCEngineInterface;
  loadTimer: Timer;
  tier: Tier;
}

export async function detectAdapter(): Promise<{ vendor: string; architecture: string } | null> {
  if (!('gpu' in navigator)) return null;
  try {
    const adapter = await (navigator as Navigator & { gpu: GPU }).gpu.requestAdapter();
    if (!adapter) return null;
    const info = await adapter.requestAdapterInfo();
    return { vendor: info.vendor || 'unknown', architecture: info.architecture || 'unknown' };
  } catch {
    return null;
  }
}

export async function loadModel(
  tier: Tier,
  onProgress: (p: LoadProgress) => void
): Promise<LoadResult> {
  const descriptor = MODELS[tier];
  const timer = startTimer(`load-${tier}`);

  const engine = await webllm.CreateMLCEngine(descriptor.modelId, {
    initProgressCallback: (report) => {
      onProgress({
        progress: report.progress,
        text: report.text,
        timeElapsedMs: timer.elapsedMs(),
      });
    },
  });

  return { engine, loadTimer: timer, tier };
}
```

- [ ] **Step 3: Type-check**

Run:
```powershell
cd D:\decodemind
npm run typecheck
```

Expected: no errors. (If WebGPU types complain, add `"WebWorker"` to `lib` in tsconfig — already done in Task 1.)

- [ ] **Step 4: Commit**

Run:
```powershell
cd D:\decodemind
git add src/lib/llm/loader.ts package.json package-lock.json
git commit -m "feat(llm): WebLLM model loader with progress callback + adapter detection"
```

---

## Task 7: Translation function

**Files:**
- Create: `src/lib/llm/translator.ts`
- Test: `tests/lib/llm/translator.test.ts`

- [ ] **Step 1: Write the failing test (mocks the engine)**

Create `D:\decodemind\tests\lib\llm\translator.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, translateFinding, type Finding } from '@/lib/llm/translator';

const sampleFinding: Finding = {
  ruleId: 'S605',
  rawMessage: 'Starting a process with a shell, possible injection',
  codeSnippet: 'subprocess.run(cmd, shell=True)',
  language: 'python',
};

describe('buildPrompt', () => {
  it('includes ruleId and message and snippet', () => {
    const prompt = buildPrompt(sampleFinding, 'en');
    expect(prompt).toContain('S605');
    expect(prompt).toContain('shell=True');
    expect(prompt).toContain('Reply in en');
  });

  it('switches language', () => {
    const prompt = buildPrompt(sampleFinding, 'fr');
    expect(prompt).toContain('Reply in fr');
  });
});

describe('translateFinding', () => {
  it('returns the engine response content', async () => {
    const mockEngine = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'This is a shell injection risk.' } }],
          }),
        },
      },
    };

    const result = await translateFinding(mockEngine as never, sampleFinding, 'en');
    expect(result).toBe('This is a shell injection risk.');
    expect(mockEngine.chat.completions.create).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
cd D:\decodemind
npm test -- tests/lib/llm/translator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement translator.ts**

Create `D:\decodemind\src\lib\llm\translator.ts`:

```typescript
import type * as webllm from '@mlc-ai/web-llm';

export interface Finding {
  ruleId: string;
  rawMessage: string;
  codeSnippet: string;
  language: string;
}

export function buildPrompt(finding: Finding, replyLanguage: 'en' | 'fr'): string {
  return [
    `SYSTEM: You are an expert who explains code bugs to non-experts.`,
    `Reply in ${replyLanguage}, max 3 sentences, no technical jargon.`,
    ``,
    `Linter: ${finding.ruleId}`,
    `Raw message: ${finding.rawMessage}`,
    `Code excerpt:`,
    '```' + finding.language,
    finding.codeSnippet,
    '```',
    ``,
    `Explain in 3 sentences:`,
    `1. What is the problem?`,
    `2. What is the impact (what could break)?`,
    `3. How do you fix it?`,
  ].join('\n');
}

export async function translateFinding(
  engine: webllm.MLCEngineInterface,
  finding: Finding,
  replyLanguage: 'en' | 'fr'
): Promise<string> {
  const prompt = buildPrompt(finding, replyLanguage);
  const response = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 200,
  });
  const content = response.choices[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
cd D:\decodemind
npm test -- tests/lib/llm/translator.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

Run:
```powershell
cd D:\decodemind
git add src/lib/llm/translator.ts tests/lib/llm/translator.test.ts
git commit -m "feat(llm): translation function + prompt builder"
```

---

## Task 8: Ruff WASM worker

**Files:**
- Create: `src/workers/ruff.worker.ts`

Note: WASM workers are hard to unit-test in jsdom. This task is verified via the spike page (Task 12).

- [ ] **Step 1: Install Ruff WASM**

Run:
```powershell
cd D:\decodemind
npm install @astral-sh/ruff-wasm-web@latest
```

- [ ] **Step 2: Implement ruff.worker.ts**

Create `D:\decodemind\src\workers\ruff.worker.ts`:

```typescript
import init, { Workspace } from '@astral-sh/ruff-wasm-web';

export interface RuffRequest {
  type: 'scan';
  source: string;
}

export interface RuffDiagnostic {
  code: string;
  message: string;
  location: { row: number; column: number };
  end_location: { row: number; column: number };
  fix?: unknown;
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
      return new Workspace({
        'line-length': 100,
        lint: {
          select: ['E', 'F', 'W', 'S', 'B', 'C90', 'UP'],
        },
      });
    })();
  }
  return workspacePromise;
}

self.onmessage = async (event: MessageEvent<RuffRequest>) => {
  if (event.data.type !== 'scan') return;
  const start = performance.now();
  const workspace = await getWorkspace();
  const diagnostics = workspace.check(event.data.source) as RuffDiagnostic[];
  const elapsedMs = Math.round(performance.now() - start);
  const response: RuffResponse = { type: 'result', diagnostics, elapsedMs };
  self.postMessage(response);
};
```

- [ ] **Step 3: Type-check**

Run:
```powershell
cd D:\decodemind
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

Run:
```powershell
cd D:\decodemind
git add src/workers/ruff.worker.ts package.json package-lock.json
git commit -m "feat(workers): Ruff WASM scanner in dedicated worker"
```

---

## Task 9: ast-grep WASM worker + sample rule

**Files:**
- Create: `src/workers/ast-grep.worker.ts`, `src/spike/rules/llm-fake-pandas-method.yml`

- [ ] **Step 1: Install @ast-grep/wasm**

Run:
```powershell
cd D:\decodemind
npm install @ast-grep/wasm@latest
```

- [ ] **Step 2: Create the sample rule**

Create `D:\decodemind\src\spike\rules\llm-fake-pandas-method.yml`:

```yaml
id: llm-fake-pandas-method
language: Python
severity: error
message: This pandas method does not exist (common LLM hallucination)
rule:
  pattern: $DF.$METHOD($$$ARGS)
  constraints:
    METHOD:
      regex: '^(read_excel_advanced|to_clean_csv|drop_duplicates_inplace|smart_merge|fast_concat)$'
```

- [ ] **Step 3: Implement ast-grep.worker.ts**

Create `D:\decodemind\src\workers\ast-grep.worker.ts`:

```typescript
import { initializeAstGrep, parseFiles, type Language } from '@ast-grep/wasm';

export interface AstGrepRequest {
  type: 'scan';
  files: { path: string; content: string; language: Language }[];
  ruleYaml: string;
}

export interface AstGrepMatch {
  ruleId: string;
  file: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface AstGrepResponse {
  type: 'result';
  matches: AstGrepMatch[];
  elapsedMs: number;
}

let initPromise: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeAstGrep();
  }
  return initPromise;
}

self.onmessage = async (event: MessageEvent<AstGrepRequest>) => {
  if (event.data.type !== 'scan') return;
  const start = performance.now();
  await ensureInit();

  const matches: AstGrepMatch[] = [];
  for (const file of event.data.files) {
    const parsed = await parseFiles([{ path: file.path, source: file.content, language: file.language }]);
    for (const root of parsed) {
      const found = root.findAll({ ruleYaml: event.data.ruleYaml });
      for (const node of found) {
        const range = node.range();
        matches.push({
          ruleId: 'llm-fake-pandas-method',
          file: file.path,
          startLine: range.start.line + 1,
          endLine: range.end.line + 1,
          text: node.text(),
        });
      }
    }
  }

  const elapsedMs = Math.round(performance.now() - start);
  const response: AstGrepResponse = { type: 'result', matches, elapsedMs };
  self.postMessage(response);
};
```

Note: the exact `@ast-grep/wasm` API may vary by version. If `initializeAstGrep` / `parseFiles` differ, adjust to match the actual exports (check the package's README on npm). The spike measurement (Task 14) will surface any API mismatch.

- [ ] **Step 4: Type-check**

Run:
```powershell
cd D:\decodemind
npm run typecheck
```

If `@ast-grep/wasm` exports differ from the imports above, fix the imports based on the actual package and re-run.

- [ ] **Step 5: Commit**

Run:
```powershell
cd D:\decodemind
git add src/workers/ast-grep.worker.ts src/spike/rules/llm-fake-pandas-method.yml package.json package-lock.json
git commit -m "feat(workers): ast-grep WASM scanner + sample LLM hallucination rule"
```

---

## Task 10: ESLint browserify worker

**Files:**
- Create: `src/workers/eslint.worker.ts`

- [ ] **Step 1: Install eslint-linter-browserify**

Run:
```powershell
cd D:\decodemind
npm install eslint-linter-browserify@^10.0.0
```

- [ ] **Step 2: Implement eslint.worker.ts**

Create `D:\decodemind\src\workers\eslint.worker.ts`:

```typescript
import { Linter } from 'eslint-linter-browserify';

export interface EslintRequest {
  type: 'lint';
  source: string;
  filename: string;
}

export interface EslintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface EslintResponse {
  type: 'result';
  messages: EslintMessage[];
  elapsedMs: number;
}

const linter = new Linter();

const config = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'error',
    'eqeqeq': 'warn',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-debugger': 'warn',
  },
};

self.onmessage = (event: MessageEvent<EslintRequest>) => {
  if (event.data.type !== 'lint') return;
  const start = performance.now();
  const messages = linter.verify(event.data.source, config as never, event.data.filename) as EslintMessage[];
  const elapsedMs = Math.round(performance.now() - start);
  const response: EslintResponse = { type: 'result', messages, elapsedMs };
  self.postMessage(response);
};
```

- [ ] **Step 3: Type-check**

Run:
```powershell
cd D:\decodemind
npm run typecheck
```

Expected: no errors (the `as never` cast for the config is intentional — `eslint-linter-browserify` types lag the flat config shape).

- [ ] **Step 4: Commit**

Run:
```powershell
cd D:\decodemind
git add src/workers/eslint.worker.ts package.json package-lock.json
git commit -m "feat(workers): ESLint browserify in dedicated worker with minimal config"
```

---

## Task 11: Prettier standalone worker

**Files:**
- Create: `src/workers/prettier.worker.ts`

- [ ] **Step 1: Install Prettier**

Run:
```powershell
cd D:\decodemind
npm install prettier@^3.8.0
```

- [ ] **Step 2: Implement prettier.worker.ts**

Create `D:\decodemind\src\workers\prettier.worker.ts`:

```typescript
import prettier from 'prettier/standalone';
import parserBabel from 'prettier/plugins/babel';
import parserEstree from 'prettier/plugins/estree';
import parserTypescript from 'prettier/plugins/typescript';
import parserHtml from 'prettier/plugins/html';
import parserCss from 'prettier/plugins/postcss';

export interface PrettierRequest {
  type: 'format';
  source: string;
  parser: 'babel' | 'typescript' | 'html' | 'css';
}

export interface PrettierResponse {
  type: 'result';
  formatted: string;
  changed: boolean;
  elapsedMs: number;
}

self.onmessage = async (event: MessageEvent<PrettierRequest>) => {
  if (event.data.type !== 'format') return;
  const start = performance.now();
  const formatted = await prettier.format(event.data.source, {
    parser: event.data.parser,
    plugins: [parserBabel, parserEstree, parserTypescript, parserHtml, parserCss],
  });
  const elapsedMs = Math.round(performance.now() - start);
  const response: PrettierResponse = {
    type: 'result',
    formatted,
    changed: formatted !== event.data.source,
    elapsedMs,
  };
  self.postMessage(response);
};
```

- [ ] **Step 3: Type-check**

Run:
```powershell
cd D:\decodemind
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

Run:
```powershell
cd D:\decodemind
git add src/workers/prettier.worker.ts package.json package-lock.json
git commit -m "feat(workers): Prettier standalone formatter with 5 parsers"
```

---

## Task 12: Spike page UI

**Files:**
- Create: `src/spike/SpikePage.tsx`, `src/spike/ResultsTable.tsx`

- [ ] **Step 1: Create ResultsTable.tsx**

Create `D:\decodemind\src\spike\ResultsTable.tsx`:

```typescript
import { formatBytes, formatDuration } from '@/lib/measurement/instrument';

export interface Measurement {
  label: string;
  durationMs?: number;
  bytes?: number;
  count?: number;
  note?: string;
}

export function ResultsTable({ measurements }: { measurements: Measurement[] }) {
  if (measurements.length === 0) {
    return <p className="text-brand-muted italic">No measurements yet.</p>;
  }
  return (
    <table className="w-full text-left text-sm font-mono border border-brand-card">
      <thead className="bg-brand-card">
        <tr>
          <th className="px-3 py-2">Measurement</th>
          <th className="px-3 py-2">Duration</th>
          <th className="px-3 py-2">Size</th>
          <th className="px-3 py-2">Count</th>
          <th className="px-3 py-2">Note</th>
        </tr>
      </thead>
      <tbody>
        {measurements.map((m, i) => (
          <tr key={i} className="border-t border-brand-card">
            <td className="px-3 py-2">{m.label}</td>
            <td className="px-3 py-2">{m.durationMs != null ? formatDuration(m.durationMs) : '—'}</td>
            <td className="px-3 py-2">{m.bytes != null ? formatBytes(m.bytes) : '—'}</td>
            <td className="px-3 py-2">{m.count != null ? String(m.count) : '—'}</td>
            <td className="px-3 py-2 text-brand-muted">{m.note ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Create SpikePage.tsx**

Create `D:\decodemind\src\spike\SpikePage.tsx`:

```typescript
import { useState } from 'react';
import { MODELS, type Tier } from '@/lib/llm/models';
import { detectAdapter, loadModel } from '@/lib/llm/loader';
import { translateFinding, type Finding } from '@/lib/llm/translator';
import { startTimer } from '@/lib/measurement/instrument';
import { ResultsTable, type Measurement } from './ResultsTable';
import { PYTHON_SAMPLE, TYPESCRIPT_SAMPLE, HTML_SAMPLE, SAMPLE_FINDING } from './fixtures';

export function SpikePage() {
  const [tier, setTier] = useState<Tier>('quick');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [engine, setEngine] = useState<any>(null);

  const push = (m: Measurement) => setMeasurements((prev) => [...prev, m]);

  async function runDetectAdapter() {
    setBusy('detect-adapter');
    const adapter = await detectAdapter();
    push({
      label: 'WebGPU adapter',
      note: adapter ? `${adapter.vendor} / ${adapter.architecture}` : 'not available',
    });
    setBusy(null);
  }

  async function runLoadModel() {
    setBusy('load-model');
    setProgress('starting download…');
    try {
      const result = await loadModel(tier, (p) =>
        setProgress(`${Math.round(p.progress * 100)}% — ${p.text}`)
      );
      setEngine(result.engine);
      push({
        label: `Load ${MODELS[tier].label}`,
        durationMs: result.loadTimer.elapsedMs(),
        bytes: MODELS[tier].approxDiskBytes,
        note: 'cold load (first time)',
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
      push({ label: 'Translate (1 finding)', note: 'no engine loaded' });
      return;
    }
    setBusy('translate-1');
    const t = startTimer();
    const out = await translateFinding(engine, SAMPLE_FINDING, 'en');
    push({
      label: 'Translate 1 finding',
      durationMs: t.elapsedMs(),
      count: out.length,
      note: `${out.slice(0, 60)}…`,
    });
    setBusy(null);
  }

  async function runTranslateBatch() {
    if (!engine) {
      push({ label: 'Translate batch of 8', note: 'no engine loaded' });
      return;
    }
    setBusy('translate-8');
    const t = startTimer();
    const batch: Finding[] = Array.from({ length: 8 }, (_, i) => ({
      ...SAMPLE_FINDING,
      ruleId: `${SAMPLE_FINDING.ruleId}-${i}`,
    }));
    for (const f of batch) {
      await translateFinding(engine, f, 'en');
    }
    push({
      label: 'Translate batch of 8 (sequential)',
      durationMs: t.elapsedMs(),
      count: 8,
      note: `avg ${Math.round(t.elapsedMs() / 8)} ms/finding`,
    });
    setBusy(null);
  }

  async function runRuff() {
    setBusy('ruff');
    const worker = new Worker(new URL('@/workers/ruff.worker.ts', import.meta.url), { type: 'module' });
    const t = startTimer();
    worker.postMessage({ type: 'scan', source: PYTHON_SAMPLE });
    const result = await new Promise<{ diagnostics: unknown[]; elapsedMs: number }>((resolve) => {
      worker.onmessage = (e) => resolve(e.data);
    });
    push({
      label: 'Ruff scan (sample.py)',
      durationMs: t.elapsedMs(),
      count: result.diagnostics.length,
      note: `worker reported ${result.elapsedMs} ms internally`,
    });
    worker.terminate();
    setBusy(null);
  }

  async function runEslint() {
    setBusy('eslint');
    const worker = new Worker(new URL('@/workers/eslint.worker.ts', import.meta.url), { type: 'module' });
    const t = startTimer();
    worker.postMessage({ type: 'lint', source: TYPESCRIPT_SAMPLE, filename: 'sample.ts' });
    const result = await new Promise<{ messages: unknown[]; elapsedMs: number }>((resolve) => {
      worker.onmessage = (e) => resolve(e.data);
    });
    push({
      label: 'ESLint scan (sample.ts)',
      durationMs: t.elapsedMs(),
      count: result.messages.length,
      note: `worker reported ${result.elapsedMs} ms internally`,
    });
    worker.terminate();
    setBusy(null);
  }

  async function runPrettier() {
    setBusy('prettier');
    const worker = new Worker(new URL('@/workers/prettier.worker.ts', import.meta.url), { type: 'module' });
    const t = startTimer();
    worker.postMessage({ type: 'format', source: HTML_SAMPLE, parser: 'html' });
    const result = await new Promise<{ formatted: string; elapsedMs: number }>((resolve) => {
      worker.onmessage = (e) => resolve(e.data);
    });
    push({
      label: 'Prettier format (sample.html)',
      durationMs: t.elapsedMs(),
      bytes: result.formatted.length,
      note: `worker reported ${result.elapsedMs} ms internally`,
    });
    worker.terminate();
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">DecodeMind — Phase 0 Spike</h1>
        <p className="text-brand-muted">Click each button in order. Then export JSON and paste into the findings doc.</p>
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
          <h2 className="text-xl font-semibold">Measurements</h2>
          <Button onClick={exportJson} disabled={measurements.length === 0}>Export JSON</Button>
        </div>
        <ResultsTable measurements={measurements} />
      </section>
    </div>
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
```

- [ ] **Step 3: Type-check**

Run:
```powershell
cd D:\decodemind
npm run typecheck
```

Note: `src/spike/fixtures.ts` doesn't exist yet (Task 13). Errors about it are expected.

- [ ] **Step 4: Commit**

Run:
```powershell
cd D:\decodemind
git add src/spike/SpikePage.tsx src/spike/ResultsTable.tsx
git commit -m "feat(spike): measurement UI with one-button-per-scanner + JSON export"
```

---

## Task 13: Sample fixtures

**Files:**
- Create: `src/spike/fixtures.ts`

- [ ] **Step 1: Create fixtures.ts**

Create `D:\decodemind\src\spike\fixtures.ts`:

```typescript
import type { Finding } from '@/lib/llm/translator';

export const PYTHON_SAMPLE = `import subprocess
import pandas as pd

def unsafe_run(cmd):
    # shell=True is dangerous: command injection
    return subprocess.run(cmd, shell=True)

def fake_method_call(df):
    # this method doesn't exist (LLM hallucination)
    return df.read_excel_advanced("file.xlsx")

unused_var = 42
def f():
    pass
`;

export const TYPESCRIPT_SAMPLE = `const user = { name: "alice" };

// loose equality
if (user.name == undefined) {
  console.log("no name");
}

// using eval — security risk
eval("console.log('hi')");

// unused variable
const SECRET = "sk-abc123";

debugger;
`;

export const HTML_SAMPLE = `<!doctype html><html><head><title>messy</title></head><body><div    class="foo"   ><p>hi<img src="a.png"></p></div></body></html>`;

export const SAMPLE_FINDING: Finding = {
  ruleId: 'S605',
  rawMessage: 'Starting a process with a shell, possible injection detected',
  codeSnippet: 'return subprocess.run(cmd, shell=True)',
  language: 'python',
};
```

- [ ] **Step 2: Type-check the project**

Run:
```powershell
cd D:\decodemind
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run the dev server and verify the page loads**

Run:
```powershell
cd D:\decodemind
npm run dev
```

Open the URL shown (usually http://localhost:5173). Expected: the spike page renders with all the buttons, "Detect WebGPU adapter" click should not error.

Stop the server with Ctrl+C.

- [ ] **Step 4: Commit**

Run:
```powershell
cd D:\decodemind
git add src/spike/fixtures.ts
git commit -m "feat(spike): sample fixtures for Python / TS / HTML + reference finding"
```

---

## Task 14: Run measurements

**Files:** No code changes. Manual execution.

- [ ] **Step 1: Start dev server**

Run:
```powershell
cd D:\decodemind
npm run dev
```

- [ ] **Step 2: Open in Chrome (Edge OK) and run each button in order**

Open the URL (e.g. `http://localhost:5173/`). Click in this exact order:

1. **Detect WebGPU adapter** — note vendor + architecture
2. **Scan Python with Ruff** — first run (cold), then click again (warm)
3. **Lint TS with ESLint** — same
4. **Format HTML with Prettier** — same
5. **Select Quick tier**, then **Load model** — wait for download (could be 5-15 min first time)
6. **Translate 1 finding** — once warmed
7. **Translate batch of 8** — once
8. **Switch to Better tier**, **Load model**, **Translate 1**, **Translate batch of 8** — only if disk space permits
9. (Optional, only if dGPU/M-series) **Switch to Best tier**, **Load model**, **Translate 1**, **Translate batch of 8**

- [ ] **Step 3: Export JSON**

Click "Export JSON" — saves `decodemind-spike-YYYY-MM-DD.json` to Downloads.

- [ ] **Step 4: Note any failures or unexpected behavior**

Write down in a scratch file:
- Any scanner that errored out and why
- Whether download progress callbacks fire smoothly
- Browser DevTools memory tab: peak RSS during Best-tier load
- Network tab: actual model download size (right-click model URL → Save as → check file size)

- [ ] **Step 5: Stop the dev server**

Ctrl+C in the PowerShell window.

---

## Task 15: Write findings doc + update spec

**Files:**
- Create: `docs/superpowers/spike-results/2026-05-18-phase-0-findings.md`
- Modify: `docs/superpowers/specs/2026-05-18-decodemind-design.md` (sections 6 + 7 + 8)

- [ ] **Step 1: Move exported JSON into the repo**

Run:
```powershell
cd D:\decodemind
New-Item -ItemType Directory -Path 'docs\superpowers\spike-results' -Force | Out-Null
Move-Item -Path "$env:USERPROFILE\Downloads\decodemind-spike-*.json" -Destination 'docs\superpowers\spike-results\'
```

- [ ] **Step 2: Create the findings document**

Create `D:\decodemind\docs\superpowers\spike-results\2026-05-18-phase-0-findings.md`:

```markdown
# Phase 0 Spike — Findings

**Date:** 2026-05-18
**Hardware:** [fill in: CPU model, RAM, GPU vendor/model]
**Browser:** [fill in: Chrome XXX.X.XXXX.XXX on Windows 11]
**Network:** [fill in: connection speed, e.g. 100 Mbps fiber]

## Raw measurements

See [`decodemind-spike-YYYY-MM-DD.json`](./decodemind-spike-YYYY-MM-DD.json) for the full JSON export.

## Scanner performance (sample files, single file each)

| Scanner | Cold ms | Warm ms | Findings | Notes |
|---|---|---|---|---|
| Ruff (sample.py) | _fill_ | _fill_ | _fill_ | |
| ESLint (sample.ts) | _fill_ | _fill_ | _fill_ | |
| Prettier (sample.html) | _fill_ | _fill_ | n/a (format) | |

## Model load times

| Tier | Approx download | Cold load | Notes |
|---|---|---|---|
| Quick (1.5B) | _fill_ | _fill_ | |
| Better (3B) | _fill_ | _fill_ | |
| Best (7B) | _fill_ | _fill_ | |

## Translation performance

| Tier | 1 finding | Batch of 8 | Avg ms/finding |
|---|---|---|---|
| Quick (1.5B) | _fill_ | _fill_ | _fill_ |
| Better (3B) | _fill_ | _fill_ | _fill_ |
| Best (7B) | _fill_ | _fill_ | _fill_ |

## Failures and surprises

_list anything that crashed, anything that surprised you, anything the spec assumed wrong_

## V1 budget recommendations

Based on measured numbers, the V1 spec should be updated:

- **Default scan budget** for 10k LOC, Quick tier: should be set to _fill_ s (was: ≤ 45 s)
- **First-load size estimate** for Quick: was 840 MB, actual: _fill_
- **Model download time** on 50 Mbps for Quick: was <5 min, actual: _fill_
- **Tiered model strategy**: still valid? _fill_

## ast-grep package API

If the `@ast-grep/wasm` API in Task 9 differed from the package's actual exports, document the correct API here so the V1 plan uses the right imports.

## Next steps

- Apply the recommended budget revisions to the spec (Task 15 Step 3)
- Write the V1 sprint plan using these numbers as constraints
```

- [ ] **Step 3: Fill in the findings doc with real data**

Manually edit the `_fill_` placeholders with measurements from the exported JSON.

- [ ] **Step 4: Update spec sections 6 (Phases & Scope), 7 (Success Criteria), 8 (Risks) with measured numbers**

Open `D:\decodemind\docs\superpowers\specs\2026-05-18-decodemind-design.md`. In section 6 (V1 → Non-functional), section 7 (Technical), and section 8 (Risks → first row), replace estimated numbers with the measured ones.

Make the change inline. If the measured numbers invalidate the V1 scope (e.g. Quick tier takes 3 min for 10k LOC instead of 45s), document the trade-off (either accept longer scan times, drop translation, or reconsider tier strategy).

- [ ] **Step 5: Commit findings + spec update**

Run:
```powershell
cd D:\decodemind
git add docs/superpowers/spike-results/ docs/superpowers/specs/2026-05-18-decodemind-design.md
git commit -m "docs(spike): Phase 0 findings + revised V1 perf budget from measured data"
```

- [ ] **Step 6: Phase 0 complete — write the V1 plan**

Phase 0 is done. The next action is to invoke the writing-plans skill again to produce the V1 sprint plan, using the revised spec as input.

---

## Self-Review Notes

Performed inline after writing the plan:

**Spec coverage:** This plan covers Phase 0 (sections 6.0 of the spec). V1 sections (6.V1) are explicitly deferred to a follow-up plan. No spec requirement is silently dropped.

**Placeholder scan:** No `TBD`, `TODO`, or "implement later" in the code blocks. Task 14 (manual measurement run) and Task 15 (filling in the findings) contain `_fill_` markers, which are **intentional** — they're for the human running the spike, not gaps in the plan.

**Type consistency:** `Tier`, `Finding`, `ModelDescriptor`, `Timer` types defined in early tasks are imported with consistent names in later tasks. Function signatures verified (e.g. `startTimer(label?)`, `translateFinding(engine, finding, lang)`).

**API risk:** Task 9 (`@ast-grep/wasm`) uses a best-guess API based on package documentation. If the actual exports differ, Task 9 Step 4 will surface the error during type-checking and the engineer will adjust. This is acceptable — Phase 0 is a spike, learning the API is the point.

**Out-of-scope explicitly:** OPFS storage, IndexedDB translation cache, File System Access API folder picking, full SARIF normalization, ESLint+TypeScript integration, full L1/L2 fix application UI, brand/design pass, custom rule library beyond one sample, accessibility audit. All deferred to V1.
