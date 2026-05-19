# DecodeMind — Design Specification

**Status:** Approved (revised post-research) — ready for implementation planning
**Date:** 2026-05-18 (revised same day after 12-agent verification pass)
**Author:** sxc_2 (with Claude as brainstorming partner)
**Project root:** `D:\decodemind\`

---

## 1. Vision

DecodeMind is a static web app where a user selects a folder of source code and receives a plain-language report explaining what is wrong — security flaws, bugs, logic inconsistencies, and quality issues — with one-click fixes when possible.

All analysis runs **in the user's browser**: WebAssembly for the deterministic scanners, a local LLM for translation. No code is ever uploaded. No server compute. No login. No telemetry on code content. The site is a free, anonymous, privacy-first tool that scales to any number of users at zero marginal cost.

### Why this exists

LLM-generated code is everywhere (Claude, GPT, Copilot) and people ship more code while understanding less of it. Existing tools either:
- Speak in technical jargon non-experts can't act on (raw ESLint / Ruff / pylint output)
- Require uploading source code to a vendor's cloud (Codacy, Snyk Code, SonarCloud)
- Charge per seat / per repo (Snyk, GitHub Advanced Security)
- Focus on a single dimension (Snyk = security only, Prettier = style only)

DecodeMind addresses all four limitations together.

### Target users

| Tier | Profile | Primary need |
|---|---|---|
| Primary | **"AI-assisted builders"** — makers, indie hackers, low-code → code transitioners who ship code generated with LLMs but don't fully understand it | Validate AI-generated code before shipping |
| Secondary | Self-taught and junior developers | Get a second opinion without bothering a senior |
| Tertiary | The author (dogfooding) | Validate own releases on real Next.js + Python codebases |

> "Vibe coders" is the working term during brainstorming; in user-facing copy use **"builders who ship with AI"** or similar — never the slang.

### Value proposition

> Drop your code folder in. Get back a plain-language report of what could break, what's dangerous, and how to fix it. Without your code ever leaving your machine.

### Competitive positioning

| Competitor | Limitation | How DecodeMind beats it |
|---|---|---|
| Raw ESLint / Ruff / pylint | Technical jargon | LLM translates to plain language |
| Codacy / Snyk Code / SonarCloud | Paid + code uploaded to cloud | Free + 100% browser-local |
| Snyk / GitHub Code Scanning | Security-only | Four dimensions in one pass |
| Semgrep CLI | Requires install + YAML literacy | Open the site, click, done |
| CodeRabbit / Cursor reviews | Tied to specific IDE/flow | Browser, zero install, language-agnostic |

Confirmed market position after May 2026 competitive audit: **no commercial competitor combines (a) zero-upload WASM execution, (b) zero-account/CLI/repo friction, (c) plain-language output, (d) four categories in one pass.** This wedge is genuinely unclaimed.

---

## 2. System Architecture

### Layered architecture (everything runs in the user's browser)

```
┌────────────────────────────────────────────────────────────────────┐
│                  User's browser (Chrome / Edge primary)            │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    UI layer (React + Vite)                   │  │
│  │   - File picker (File System Access API)                     │  │
│  │   - Report rendering (sections, filters, diffs)              │  │
│  │   - Fix application controls (L1 / L2)                       │  │
│  └────────────┬─────────────────────────────────┬───────────────┘  │
│               │                                 │                  │
│               ▼                                 ▼                  │
│  ┌──────────────────────────────┐   ┌──────────────────────────┐   │
│  │  Detection layer             │   │ Translation layer        │   │
│  │  Web Workers in parallel:    │   │ (WebLLM + WebGPU)        │   │
│  │  - Ruff (WASM, Python)       │   │ - Qwen 2.5 Coder         │   │
│  │  - ESLint + tsc (JS, runs    │   │   (tier-selected: 7B /   │   │
│  │    in JS worker)             │   │    3B / 1.5B)            │   │
│  │  - ast-grep (WASM,           │   │ - Dedup findings (JS)    │   │
│  │    custom rules)             │   │ - Translate jargon       │   │
│  │  - Prettier + Stylelint (JS) │   │   → plain language       │   │
│  └──────────────┬───────────────┘   └──────────┬───────────────┘   │
│                 │                              │                   │
│                 └──────────┬───────────────────┘                   │
│                            ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │   Browser storage                                            │  │
│  │   - OPFS: model weights (4 GB Qwen 7B q4f16_1), WASM blobs   │  │
│  │   - IndexedDB: translation cache, scan history, custom rules │  │
│  │   - Cache API: static assets, lib.d.ts                       │  │
│  │   - Quota strategy: navigator.storage.persist() + estimate() │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                            ▲
                            │  HTTPS, first-load only for static assets
                            │
┌────────────────────────────────────────────────────────────────────┐
│   Static hosting (Cloudflare Pages preferred, GitHub Pages backup) │
│   - index.html + JS bundle (~2 MB)                                 │
│   - Linter / engine bundles served via CDN                         │
│   - Qwen model weights served from Hugging Face CDN                │
│   No backend, no database, no auth.                                │
└────────────────────────────────────────────────────────────────────┘
```

### Tech stack per layer

| Layer | Tech | Status (May 2026 verification) |
|---|---|---|
| UI framework | React 18 + Vite + Tailwind CSS | ✅ standard |
| State management | Zustand + TanStack Query | ✅ matches user's GeniA conventions |
| File access | File System Access API (Chromium) + `<input webkitdirectory>` fallback | ⚠️ Chromium-only for full UX (~70% reach) |
| Workers | Web Workers (one per scanner) | ✅ standard |
| Detection — Python | `@astral-sh/ruff-wasm-web` (Ruff via WASM) | ✅ ready — 10.7 MB unpacked, ~3 MB Brotli, bandit rules (`S` family) included |
| Detection — JS/TS | `eslint-linter-browserify` (~5 MB min) + `typescript` via `@typescript/vfs` | ⚠️ usable with caveats — runs in JS worker, not WASM |
| Detection — multi-language pattern matching | `@ast-grep/wasm` + custom YAML rules + tree-sitter grammars | ✅ ready — MIT license, lazy-load grammars per language |
| Detection — formatting | `prettier/standalone` 3.8 + `stylelint-bundle` (community) | ✅ Prettier official; Stylelint via community wrapper |
| Translation | `@mlc-ai/web-llm` 0.2.83 + Qwen 2.5 Coder MLC variants | ✅ active, monthly releases |
| LLM model (tiered) | Qwen 2.5 Coder **1.5B** (default, ~840 MB), **3B** (mid), **7B** (high-end) | ✅ all three available in `prebuiltAppConfig` |
| Storage | OPFS (model weights, big WASM blobs), IndexedDB (translations, history), Cache API (static) | ✅ — OPFS works on all major browsers, ~3-4× faster than IndexedDB |
| Hosting | Cloudflare Pages (primary); GitHub Pages (backup) | ✅ |

### Key architectural properties

- **Zero backend.** No server, no database, no auth. All state lives in the browser.
- **Parallel detection.** Four scanners run simultaneously in Web Workers; UI stays responsive.
- **Heavy first load, instant repeat runs.** Default tier (1.5B model) loads ~840 MB once; full tier (7B) is ~4 GB if user opts in.
- **WebGPU recommended; gracefully degrades without it.** Degraded mode (linters-only, raw English output) covers ~30% of sessions that lack WebGPU or use a non-Chromium browser. **This is treated as a first-class UX, not an edge case.**

### Browser storage quota strategy

- On first load: call `navigator.storage.estimate()`, surface available quota.
- Call `navigator.storage.persist()` before any download larger than 100 MB to avoid eviction.
- If user is on the 7B tier and `quota < 5 GB`, recommend the 3B or 1.5B tier instead.
- Show a clear progress + ETA during model download (the dominant pain point per WebLLM community).

---

## 3. Detection Layer

Four scanners run in parallel Web Workers. Three are WASM-backed (Ruff, ast-grep, native Prettier/Stylelint when possible); ESLint + `tsc` run as JavaScript inside their worker.

### Scanner 1 — Ruff (Python)

- **Tech:** `@astral-sh/ruff-wasm-web`
- **Detects:** undefined names, missing imports, type mismatches; PEP8 style; security via the `S` rule group (flake8-bandit port: `eval`, `exec`, shell injection, hardcoded creds, pickle, etc.); dead code.
- **Auto-fix L1:** Diagnostic carries a `fix` field; the app applies edits and re-runs `check()` (the WASM build does not orchestrate the fix loop natively).
- **Caveat:** WASM build is single-file — cross-file import resolution is not available. Acceptable for V1 (most rules are file-local).

### Scanner 2 — ESLint + TypeScript (JS / TS)

- **Tech:** `eslint-linter-browserify` (Linter class only) + `typescript` + `@typescript/vfs`. **Both run as JavaScript inside a Web Worker — not WASM.**
- **Detects:** ESLint rules (recommended + `@typescript-eslint` non-type-aware rules); `tsc` semantic diagnostics through a virtual file system.
- **Auto-fix L1:** ESLint's `verifyAndFix()` for fixable rules; Prettier handles formatting via Scanner 4.
- **Caveats:**
  - First check on a 10k-line project: 2-6 s; incremental rechecks sub-100 ms.
  - `skipLibCheck: true`, `skipDefaultLibCheck: true`, narrow `lib` to control memory.
  - Plugins that touch `fs`/`path` (e.g. `eslint-plugin-import` resolvers) do not work — out of scope for V1.

### Scanner 3 — ast-grep + DecodeMind custom rules (CORE)

- **Tech:** `@ast-grep/wasm` + custom YAML rule library + tree-sitter grammars (lazy-loaded per detected language)
- **Detects:** OWASP categories (SQL injection, XSS, path traversal, hardcoded secrets, command injection); LLM-typical hallucinations; multi-language structural patterns.
- **Why ast-grep (not Semgrep):** Semgrep WASM has no consumable package and the Semgrep Rules License v1.0 (2024) forbids competing products. ast-grep is MIT-licensed Rust+tree-sitter, has an official `@ast-grep/wasm` npm package, and powers the official browser playground.
- **Trade-off:** ast-grep does AST/structural matching but does **not** have Semgrep's interprocedural taint/dataflow analysis. Accepted for V1 — V2 may pair it with a JS-side dataflow pass.
- **Custom rule families (V1 seed, ~80-150 rules):**

| Family | Origin | Examples |
|---|---|---|
| `ws-auth-*` | NetGuardPro Phase 1 (real fixes in `sentinel/cortex.py:1656`) | Missing token, missing Origin check, missing `max_size` |
| `crypto-*` | NetGuardPro Phase 2 (`vpnguard/vpnguard.py:228-241`, `permissions.py:45-50`) | Keys not rotated, file perms != 0600, weak scrypt params, Ed25519 misuse |
| `injection-*` | NetGuardPro Phase 3 (`vpnguard/vpnguard.py:342, 418`) | `shell=True`, path traversal, config injection |
| `xss-*` | NetGuardPro Phase 4 (`netguard_dashboard.html:2701`) | Missing HTML escaping in templates, dangerouslySetInnerHTML misuse |
| `integrity-*` | NetGuardPro Phase 5 (`fim/file_integrity_monitor.py:158-227`, `licensing/license_manager.py:151-153`) | Non-atomic writes, backups without Fernet, FIM without HMAC, weak password hashing |
| `llm-hallucination-*` | Documented LLM patterns (CodeHalu, Spracklen et al. 2024, Veracode 2025) | Fake pandas/numpy methods (~5-8%), hallucinated imports (~19.7%), deprecated React lifecycle (~12%), wrong kwargs, missing `await`, type confusion, off-by-one (~6%), security anti-patterns (~35-45% of LLM output) |

### Scanner 4 — Prettier + Stylelint (HTML / CSS / formatting)

- **Tech:** `prettier/standalone` 3.8 (lazy-loaded parsers: babel/estree/typescript/html/postcss) + `stylelint-bundle` 16
- **Detects:** unclosed HTML tags, invalid attributes, basic accessibility (missing `alt`, missing ARIA), invalid CSS selectors, unknown properties, inconsistent indentation.
- **Auto-fix L1:** 100% of formatting; CSS rule auto-fixes via Stylelint where supported.

### Normalized finding (subset of SARIF 2.1.0)

Findings are emitted as the SARIF result structure, simplified for V1:

```json
{
  "ruleId": "ws-auth-001",
  "level": "error",
  "message": { "text": "WebSocket without Origin header validation" },
  "locations": [{
    "physicalLocation": {
      "artifactLocation": { "uri": "server.py" },
      "region": { "startLine": 42, "endLine": 45 }
    }
  }],
  "fixes": [{
    "description": { "text": "Validate Origin against allowlist" },
    "artifactChanges": [{
      "artifactLocation": { "uri": "server.py" },
      "replacements": [{
        "deletedRegion": { "startLine": 42, "endLine": 42 },
        "insertedContent": { "text": "ws = WebSocketApp(..., origin_validator=check_origin)" }
      }]
    }]
  }]
}
```

This is a **subset** of SARIF 2.1.0 — full conformance is a V2 goal. The subset is intentional: every emitted field validates against the schema.

### Performance budget (revised, internally consistent)

On Intel i5 (11th gen), 16 GB RAM, scanning a 10k-line project:

| Stage | Target |
|---|---|
| Ruff | 0.5 – 2 s |
| ESLint + tsc (cold) | 2 – 6 s |
| ast-grep + custom rules | 1 – 5 s |
| Prettier / Stylelint | 1 – 3 s |
| **Parallel detection total** | **5 – 10 s** |
| Translation (Qwen 1.5B, ~80 findings batched 8/call) | 10 – 25 s |
| **End-to-end scan (default 1.5B tier)** | **15 – 35 s** |
| End-to-end scan (7B tier on iGPU) | 60 – 180 s (warn user) |
| End-to-end scan (7B tier on M-series / dGPU) | 20 – 50 s |

V1 requirement: **end-to-end scan on default (1.5B) tier ≤ 45 s for a 10k-line project** on Intel i5 / 16 GB. Power tier (7B) carries no strict SLA and is opt-in.

---

## 4. Translation Layer

The translation layer turns four streams of raw findings into a single human-readable report.

### Pipeline (4 stages)

```
4 finding streams (Ruff + ESLint/tsc + ast-grep + Prettier)
                    │
                    ▼
┌───────────────────────────────────────────┐
│ Stage 1 — Deterministic dedup (pure JS)  │
│ - Hash by (file, line, ruleCategory)      │
│ - Merge duplicates                        │
│ - Note "seen by N scanners" → confidence ↑│
│ → Cost: ~50 ms, no LLM                    │
└───────────────┬───────────────────────────┘
                ▼
┌───────────────────────────────────────────┐
│ Stage 2 — Classification (pure JS)        │
│ Bucket each finding into one of:          │
│   🔒 Security  🐛 Bugs                    │
│   🧠 Logic     ✨ Quality                 │
│ Rule: ruleId prefix → bucket              │
│ → Cost: ~10 ms                            │
└───────────────┬───────────────────────────┘
                ▼
┌───────────────────────────────────────────┐
│ Stage 3 — Translation batch (Qwen, tier-  │
│ selected). For each finding without cached│
│ translation:                              │
│   prompt = template + ruleId + code       │
│   output = plain-language explanation     │
│ Batches of 8 findings per LLM call        │
│ → Cost: 1 – 4 s per batch (tier-dependent)│
│ → Cache: (ruleId + normalizedCode) →      │
│   translation                             │
└───────────────┬───────────────────────────┘
                ▼
         Final structured report
```

**V1 deliberately stops here.** L3 LLM-generated fixes are moved to V2 (see scope).

### Why split deterministic JS vs LLM work

Stages 1 and 2 are pure deterministic JavaScript — fast, debuggable, reproducible, zero LLM cost. The LLM is reserved for tasks needing linguistic reasoning (translation). Doing everything through the LLM would be ~10× slower and non-reproducible.

### Translation cache (killer feature)

| Without cache | With cache (DecodeMind) |
|---|---|
| Every scan re-explains everything | Already-seen findings → instant |
| LLM cost is linear in scans | LLM cost decays with usage |
| ~25 s per scan baseline | ~3 s for a re-scan after fixes |

#### Cache key: `(ruleId, normalizedCode)`

`normalizedCode` is the offending code excerpt after a normalization pass:
- Strip leading/trailing whitespace
- Collapse internal whitespace runs to single space
- Strip inline comments (Python `#`, JS `//`, `/* */`)
- Replace string literals with `"<STR>"`
- Replace number literals with `<NUM>`
- Replace identifiers matching `[A-Z_][A-Z0-9_]*` (likely user constants) with `<CONST>`

Goal: high cache hit rate across **lexically different but semantically identical** findings. Measure hit rate during beta; tune normalization based on data.

### Degraded mode (no WebGPU / non-Chromium browser)

If the user's browser lacks WebGPU OR is Firefox/Safari (where the folder picker doesn't work for write-back):
- ✅ Detection still works (Ruff WASM, ESLint, ast-grep, Prettier all run without WebGPU)
- ❌ No LLM translation → raw rule descriptions are shown (DecodeMind ships a built-in JSON dictionary of plain-English descriptions per `ruleId` as a fallback for common rules — ~200 entries covering the top-confidence rules)
- ❌ No write-back of fixes on Firefox/Safari → user downloads patched files as a ZIP
- UI shows a non-blocking banner explaining the limitation and recommending Chrome/Edge

**Treat the degraded path as a first-class UX**, not a fallback. WebGPU adoption is ~85-90% on Chromium but only ~70% globally, and Firefox/Safari users (~30% of the web) will hit the degraded mode by default.

### Prompt template (translation)

```
SYSTEM: You are an expert who explains code bugs to non-experts.
Reply in {{language}}, max 3 sentences, no technical jargon.

USER:
Linter: {{ruleId}}
Raw message: {{rawMessage}}
Code excerpt:
```{{language}}
{{codeSnippet}}
```

Explain in 3 sentences:
1. What is the problem?
2. What is the impact (what could break)?
3. How do you fix it?
```

---

## 5. User Experience

### Code reading model (privacy promise)

**The code is read directly from the user's disk via the File System Access API. It is never uploaded.**

| Browser | File System Access | DecodeMind behavior |
|---|---|---|
| Chrome / Edge / Opera (desktop) | ✅ Full (read + write, persistent permissions since Chrome 122) | Full experience, auto-applied fixes, backups in `.decodemind-backup/` |
| Brave / Vivaldi (Chromium) | ✅ Full | Same as Chrome |
| Safari (macOS) | ⚠️ OPFS only — no `showDirectoryPicker` | Read-only via `<input webkitdirectory>`, fixes downloaded as ZIP |
| Firefox | ❌ Folder picker not implemented | Same fallback as Safari |
| Mobile | ❌ Out of scope V1 | Banner: "DecodeMind is desktop-only" |

UI surfaces a friendly recommendation to use Chrome/Edge when the user lands on a non-supporting browser.

### First-time user flow

1. **Landing page** — one big CTA "Scan a folder", value props (free, private, multi-language).
2. **Tier selection** (first visit only) — explain three tiers:
   - **Quick (1.5B model, ~840 MB)** — default, works on most laptops, plain explanations available
   - **Better (3B model, ~1.9 GB)** — recommended if user has dedicated GPU or M-series Mac
   - **Best (7B model, ~4.1 GB)** — power users / desktop GPUs only
   - **Skip download** — degraded mode with built-in description dictionary
3. **File picker** — native browser folder selection.
4. **Scan in progress** — per-scanner progress, ETA estimate.
5. **Final report** — sectioned by severity category.

### Report layout

Rendered as four collapsible sections (🔒 Security, 🐛 Bugs, 🧠 Logic, ✨ Quality), each with severity badges, plain-language explanations, code snippets (before/after), and per-finding actions.

Per-finding actions in V1:

| Action | When | Behavior |
|---|---|---|
| ✅ Apply | L1 / L2 fix available from linter | Modifies the file via FS Access API; backup written to `.decodemind-backup/{timestamp}-{filename}` |
| Ignore | Always | Stored in IndexedDB; won't return on next scan |
| Details | Always | Side panel: full rule doc, examples, OWASP/CVE references |

Deferred to V2: ✏️ inline edit fix (Monaco editor), 🧠 "second opinion" via user's API key.

### Persistent header

- **Dashboard** — current scan
- **History** — last 10 scans (metadata only in IndexedDB; never sent anywhere)
- **Settings** — UI language (FR/EN), tier selection, cache management, theme toggle, strict/standard/permissive mode

### Export formats

- **PDF** — share with a human
- **JSON SARIF subset** — re-import in IDE / CI pipeline (V2: full SARIF compliance)
- **Markdown** — paste into README or ticket

### Error states

| Case | UX |
|---|---|
| No WebGPU | Banner + degraded mode (built-in description dictionary, no LLM) |
| First scan, model not downloaded | Tier selection modal |
| Download interrupted | Auto-resume on refresh |
| Storage quota exceeded mid-download | Warning + suggest lower tier |
| Folder too large (>50k files) | Confirmation modal + time estimate |
| One scanner crashes | Continue with the other three, badge "Ruff failed" |
| Windows Controlled Folder Access blocks write | Show actionable error + docs link |
| Zero findings | 🎉 animation: "Your code is clean!" |

### Backup mechanism

When the user applies a fix:
1. Original file copied to `D:\<project>\.decodemind-backup\<ISO-timestamp>-<filename>`
2. Fix applied in place via FS Access API
3. UI shows an "Undo last fix" button (per-scan)
4. Backups older than 7 days auto-cleaned (only after user is informed once)

V1 caveat: backups are not git-aware; `.gitignore` should include `.decodemind-backup/` (DecodeMind offers to add it on first apply).

---

## 6. Phases & Scope

### Phase 0 — Spike (1-2 days, before V1 sprint 1)

Before committing to the V1 timeline, run a **measurement spike** in a throwaway page:
- Actual download size for Qwen 2.5 Coder 7B q4f16_1 on the author's machine
- Cold-load time, first-token latency
- Real performance of a batch of 8 finding translations
- Verify ast-grep WASM bundle size + grammar lazy-load works as advertised
- Confirm `@astral-sh/ruff-wasm-web` and `eslint-linter-browserify` integrate cleanly in a Vite project

Output: revised performance budget for V1 based on data, not estimates. Without this spike, the V1 timeline is fiction.

### V1 — Polished MVP (after Phase 0)

**Functional:**
- Static site deployed on Cloudflare Pages
- Folder selection via File System Access API (Chromium) + `<input webkitdirectory>` fallback
- Four scanners in parallel: Ruff (WASM), ESLint + tsc (JS), ast-grep (WASM), Prettier + Stylelint
- Custom ast-grep rule library: ~80-150 rules at launch (seeded from NetGuardPro audit + LLM hallucination research)
- Built-in plain-English description dictionary for ~200 top rules (degraded-mode fallback)
- Qwen 2.5 Coder via WebLLM, tier-selected (1.5B default, 3B mid, 7B opt-in)
- Translation cache in IndexedDB with `(ruleId, normalizedCode)` key
- Sectioned report (Security / Bugs / Logic / Quality)
- L1 / L2 auto-fix with automatic timestamped backup
- Export PDF / SARIF subset / Markdown
- Settings (FR / EN, tier, cache, theme, strictness mode)
- Degraded mode without WebGPU
- Browser support: Chrome/Edge full; Safari/Firefox fallback with download-as-ZIP

**Non-functional (revised from measured data after Phase 0):**
- Default tier (1.5B) scan of 10k-line project: ≤ 45 s on Intel i5 / 16 GB
- First-load (default tier 1.5B): ~840 MB, <5 min on 50 Mbps connection
- No telemetry transmits source code or findings
- Site works fully offline after first load (service worker + Cache API + OPFS)
- Lighthouse Performance ≥ 80 (relaxed from 90 — realistic for a WASM + WebGPU app), Accessibility ≥ 90

**Estimated timeline:** 10-14 weeks solo for polished V1 (post-Phase 0); 6-8 weeks for a rough usable MVP.

### V2 — Only if V1 gains traction

| Feature | Reason for V2 |
|---|---|
| L3 LLM-generated fixes (Qwen synthesizes patch) | Requires reliable code generation; fragile, defer |
| "Second opinion" with user's API key | Whole new network/auth surface |
| Inline patch editor (Monaco) | ~3 MB dep for an edge action |
| More languages (Go, Rust, Java, C#, PHP) | Each language ≈ 2-3 weeks |
| VS Code / JetBrains extensions | Wait for user demand |
| `decodemind-scan` GitHub Action | CI workflow, beyond the browser |
| Fine-tuned custom model | Needs real dataset (collected from V1) |
| Team mode with shared rule library | B2B pivot, separate story |
| Cross-file refactor | Very complex, uncertain value |
| Interprocedural taint / dataflow | ast-grep gap; pair with custom JS pass |
| Full SARIF 2.1.0 conformance | Current is a clean subset, expand on demand |

### V3+ — Long-term vision (mentioned, not scoped)

- Cross-file detection (architecture, dependency cycles)
- Continuous audit mode (PWA + extended permissions)
- Community rule library (users share their custom rules)
- Paid team tier with centralized orchestrator (path to revenue)

### Explicitly out of scope (V1 — what we deliberately won't do)

| Out of scope | Why |
|---|---|
| Desktop app (Electron / Tauri) | Web + WASM is sufficient; no install friction |
| Backend / login / auth | Breaks the "100% private, zero friction" promise |
| Code telemetry | Breaks trust irreparably |
| Code completion / IntelliSense | Not an IDE |
| Test execution | Not a test runner |
| Performance profiling | Different tool category |
| Mobile support | Not the use case (editing code on a phone) |
| Auto-generated documentation | Not our mission |
| Architectural refactoring | Too complex and risky for V1 |
| CI / CD integration | V2 if users ask |

---

## 7. Success Criteria

### Technical

- Default-tier scan of 10k-line project ≤ 45 s on Intel i5 / 16 GB (benchmark on author's machine)
- <5% false-positive rate on author's own projects
- Lighthouse Performance ≥ 80, Accessibility ≥ 90

### Adoption

- Author uses DecodeMind on next three releases (dogfooding)
- 100 unique users in the first month post-launch
- 10 qualitative feedback responses

### Product

- A first-time user completes a full scan without external help
- 5 non-experts read 10 findings each and rate "Did this explain the problem clearly?" — ≥ 80% yes
- Translation cache hit rate ≥ 50% after a user's second scan of the same project

---

## 8. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| WebLLM / Qwen too slow on average machines | High | Tiered model strategy (1.5B default); Phase 0 spike measures real perf |
| ast-grep can't express all the security rules Semgrep would have | Medium | Accept structural-only for V1; pair with JS dataflow pass in V2 |
| File System Access API doesn't reach Firefox/Safari | High (already known) | Degraded mode with `<input webkitdirectory>` + ZIP download is first-class |
| Browser storage quota exceeded | Medium | `navigator.storage.estimate()` + `persist()` + tier downgrade suggestion |
| False positives erode trust | High | Tight QA on the seed rules; private beta first |
| Nobody downloads even 840 MB | Medium | Degraded mode with built-in description dictionary stays useful |
| GitHub `decodemind` squatter persists | Low | Use `getdecodemind` org; file dispute in parallel |
| Author burns out before shipping | Medium | Strict scope discipline; Phase 0 + MVP first, polish later |

---

## 9. Tech Stack Reference

| Concern | Choice | Notes |
|---|---|---|
| Build tool | Vite | Matches GeniA convention |
| Framework | React 18 | Matches GeniA |
| Styling | Tailwind CSS | Custom DecodeMind palette (TBD); not the GeniA "metal" theme |
| State | Zustand + TanStack Query | Matches GeniA |
| Type checking | TypeScript (strict mode on `apps/web`) | Matches GeniA tsconfig pattern |
| Monorepo (if needed) | Turborepo with `apps/web` + `packages/*` | Optional; only adopt if a second package emerges |
| Package manager | npm 10 | Matches GeniA |
| Testing | Vitest (unit) + Playwright (E2E) | Matches GeniA |
| Python linter | `@astral-sh/ruff-wasm-web` | Includes bandit-equivalent `S` rules |
| JS / TS linter | `eslint-linter-browserify` | Linter class only (no CLI) |
| TS type checker | `typescript` + `@typescript/vfs` | Lazy-load `lib.d.ts` once, cache in OPFS |
| Multi-language patterns | `@ast-grep/wasm` + custom YAML rules | MIT license; tree-sitter grammars lazy-loaded |
| Formatter | `prettier/standalone` 3.8 + lazy parser plugins | |
| CSS linter | `stylelint-bundle` 16 (community wrapper) | No official browser build |
| LLM runtime | `@mlc-ai/web-llm` ^0.2.83 | Use `CreateServiceWorkerMLCEngine` for persistence |
| LLM models | `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` (default), `Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC` (mid), `Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC` (high) | All in `prebuiltAppConfig` |
| File system access | File System Access API (W3C) + `<input webkitdirectory>` fallback | |
| Persistent storage | OPFS (models, big WASM blobs) + IndexedDB (cache, history) + Cache API (static) | |
| Hosting | Cloudflare Pages (primary); GitHub Pages (backup) | |
| Domain (primary) | `decodemind.dev` (~$15/yr, confirmed available May 2026) | |
| Domain (defensive) | `decodemind.app` + `getdecodemind.com` (~$30 combined, both available) | |
| Repository | `github.com/getdecodemind/decodemind` (decodemind org is squatted; file dispute in parallel) | |
| npm scope | `decodemind` (available May 2026) | |
| Social | `@decodemind` on `fosstodon.org` (Mastodon) | Skip LinkedIn `/decodemind` to avoid collision |

---

## 10. Open Questions (post-research)

| Question | Resolution path |
|---|---|
| Exact Qwen 7B download time on author's machine | Phase 0 spike |
| Real ast-grep WASM bundle size with 3 grammars loaded | Phase 0 spike |
| Whether `eslint-linter-browserify` + `@typescript-eslint` can coexist with custom rules in browser | Phase 0 spike |
| Final shape of the `normalizedCode` cache key (which normalizations help / hurt hit rate) | Beta data |
| Tailwind palette / DecodeMind brand colors | Pre-launch design pass |
| Whether `decodemind` GitHub org dispute succeeds | Outcome-driven; fallback `getdecodemind` already locked |

---

## 11. Appendix — Brainstorm + Research Decision Log

| Decision | Choice | Date | Source |
|---|---|---|---|
| Coverage scope | All four categories | 2026-05-18 | Brainstorm |
| Merge architecture | Orchestrator pattern | 2026-05-18 | Brainstorm |
| Detection engine | Hybrid linters + LLM | 2026-05-18 | Brainstorm |
| Hosting model | WebAssembly in browser | 2026-05-18 | Brainstorm |
| LLM library | WebLLM | 2026-05-18 | Brainstorm |
| **LLM model strategy** | **Tiered: 1.5B default / 3B mid / 7B high** | 2026-05-18 | **Research (model size + iGPU perf)** |
| Detection strategy | Pragmatic hybrid: pattern library first, fine-tune later if traction | 2026-05-18 | Brainstorm |
| Auto-fix levels (V1) | **L1 + L2 only (L3 moved to V2)** | 2026-05-18 | **QA review** |
| Cost constraint | 100% free, no LLM API cost, no server compute | 2026-05-18 | Brainstorm |
| Languages V1 | JS/TS + Python + HTML/CSS | 2026-05-18 | Brainstorm |
| Distribution | Free standalone site | 2026-05-18 | Brainstorm |
| Name | DecodeMind | 2026-05-18 | Brainstorm |
| UI language priority | English first, French second | 2026-05-18 | Brainstorm |
| **Pattern engine** | **ast-grep (not Semgrep) — license + packaging** | 2026-05-18 | **Research (critical)** |
| **Domain** | **`decodemind.dev`; `decodemind.io` is $3,500 aftermarket** | 2026-05-18 | **Research** |
| **GitHub org** | **`getdecodemind` (decodemind is squatted)** | 2026-05-18 | **Research** |
| **Phase 0 spike** | **1-2 day measurement spike before V1 sprint 1** | 2026-05-18 | **QA review** |
| **Browser support tier** | **Degraded mode is first-class (30% of sessions)** | 2026-05-18 | **Research (WebGPU + FS Access adoption)** |
| **Storage** | **OPFS (large blobs) + IndexedDB (cache) + Cache API (static)** | 2026-05-18 | **Research (Chrome quota behavior)** |
| **Perf budget** | **Default tier ≤ 45 s on 10k LOC; tier-aware ETAs** | 2026-05-18 | **QA review (resolved 60s/75s contradiction)** |
