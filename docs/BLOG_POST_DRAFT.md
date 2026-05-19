# DecodeMind: a code scanner that runs entirely in your browser

**TL;DR — I built a code scanner that finds security issues, bugs, and quality problems in a folder of source code, applies fixes one click at a time, and does it all without sending a single byte of code to a server. Open source. Try it at [decodemind.dev](https://decodemind.dev).**

---

## The problem

People ship more LLM-generated code than ever. They also understand less of it. The existing safety net is bad for both ends of the skill curve:

- **For non-experts**: linters like Ruff and ESLint spit out terse codes (`F841`, `no-undef`, `E501`) that don't tell you what's actually wrong. Cloud code-review tools like Codacy, Snyk Code, and SonarCloud paywall the useful parts behind an account, ask you to upload your code to their servers, and frame everything for developer teams.
- **For everyone**: if your code has a security flaw — say a `shell=True` subprocess call or an `eval(user_input)` — you may not learn about it until production. Or, more likely, you never learn.

What if you could drag a folder into your browser, see the problems in plain language within seconds, click a button to fix the ones with a clear remediation, and never share your code with anyone?

That's DecodeMind.

## What I built

DecodeMind is a static web app. You visit it, click "Pick a folder," select a directory on your disk, and watch as four scanners run in parallel **inside your browser**:

- **Ruff** (a Rust Python linter, compiled to WebAssembly) finds Python bugs, style issues, and bandit-equivalent security findings.
- **ESLint** (compiled to a browser bundle) lints JavaScript and TypeScript.
- **Prettier 3** formats HTML and CSS and surfaces structural issues.
- **ast-grep** (also Rust → WASM) runs a custom rule library against any tree-sitter language. The library currently has 60 hand-written rules covering OWASP-style security, common LLM hallucinations, and bug-detection patterns.

The findings are aggregated, categorized into four sections (🔒 Security / 🐛 Bugs / 🧠 Logic / ✨ Quality), and rendered with severity-coded cards. Each card carries a plain-English explanation in EN or FR. When the underlying scanner provides a fix (Ruff has good auto-fix coverage), a button appears: **Apply fix**.

Clicking Apply does three things:
1. Backs up the original file to `.decodemind-backup/<timestamp>-<file>` inside the user's project (so undo is one read away)
2. Applies the edit in-memory
3. Writes the new content to the file on disk

Total network traffic during all this: zero requests carrying user code.

## Why this is interesting (technically)

DecodeMind has no backend. Everything happens in the browser tab:

| Concern | How it's solved without a server |
|---|---|
| **Reading a folder of code** | The File System Access API (`showDirectoryPicker`) gives the tab a handle to the user's folder. Files are read directly from disk. |
| **Running Rust linters** | Ruff and ast-grep ship as WebAssembly modules. Each runs in its own Web Worker. |
| **Running JS/TS linters** | ESLint is the JS package `eslint-linter-browserify`. Runs in another Web Worker. |
| **Plain-language explanations** | A 1.5B / 3B / 7B Qwen 2.5 Coder model runs in the browser via WebLLM + WebGPU. The user picks a tier on first scan; weights cache to OPFS. Alternative: a built-in static dictionary for 60+ rules in EN and FR. |
| **Translation cache** | IndexedDB, keyed by `(language, ruleId, sha256(normalizedCode))`. Re-explaining the same finding across scans is a cache hit. |
| **Writing fixes back** | Same File System Access API, with `createWritable` + `write` + `close`. Backup is also written through it. |
| **Hosting** | Static site on Cloudflare Pages. `_headers` file sets COOP/COEP so WebGPU and SharedArrayBuffer work in production. |

I picked **ast-grep over Semgrep** after research: Semgrep WASM exists but has no published npm package and a restrictive rules license. ast-grep ships `@ast-grep/wasm` with an MIT engine and tree-sitter grammars I serve from `public/` via a tiny Vite plugin.

I picked **tiered LLM models** because Phase 0 measurements (see below) showed the 7B Qwen Coder bricks Intel iGPUs. The Quick tier (1.5B, ~840 MB) runs on essentially anything WebGPU-capable. The Best tier (7B, ~4.1 GB) is opt-in for dGPUs and Apple Silicon.

## The Phase 0 → V1 journey

I started with a measurement spike. The plan said "before committing to 10–14 weeks of V1, build a throwaway page that exercises every risky tech choice and tells you what's real." That spike (15 tasks across two days) caught five things that would have destroyed V1 quality if I'd shipped on assumptions:

1. **`@ast-grep/wasm` API doesn't match its docs.** The real exports are `initializeTreeSitter`, `registerDynamicLanguage`, and `parse` — the spec I wrote used `initializeAstGrep` and `parseFiles`. I would have built three broken integrations.
2. **Ruff `Workspace` requires a second `PositionEncoding` argument** the docs hide, and `RuffDiagnostic` uses `start_location` (not `location`). Three minutes of reading `node_modules/.../*.d.ts` saved a day of stumbling.
3. **WebGPU's `requestAdapterInfo()` is deprecated** — the synchronous `adapter.info` getter replaced it. Trivial change, but the kind of thing that becomes a silent console warning forever if you don't catch it.
4. **First real-folder scan (a 32-file Android project that vendored `whisper-cpp/`) returned 60 findings, 4 of them actionable.** The 7% signal/noise ratio drove a hard V1 requirement: ignore patterns must be project-configurable (`.decodemind-ignore`), and auto-generated files must be detected via header heuristic.
5. **Worker URLs constructed with the `@/` path alias don't bundle correctly in production.** Vite's static worker analyzer requires a relative literal path. The spike worked in dev mode and produced broken inline data URLs in production. Caught by `npm run build` + inspecting `dist/`.

The V1 build is now branch `v1` of the repo. 240 unit tests, typecheck clean, a Husky pre-commit hook that runs both, a service worker for offline, and a working Apply-fix flow proved end-to-end on real code.

## What I learned

- **Spikes pay for themselves twice.** Once in caught bugs. Once in honest perf budgets — every V1 timeline starts as fiction until measurements replace estimates.
- **Privacy-as-product is a wedge that's open in mid-2026.** No commercial competitor combines (a) zero-upload WASM execution, (b) zero-account friction, (c) plain-language output, (d) four categories in one scan. The market crowds the cloud lane and ignores the local lane.
- **LLM-in-browser via WebLLM is real.** Not fast, not for every machine — but real, and gets better with each Chromium release. The pattern of "deterministic linters for detection + local LLM for explanation" is a sweet spot: the LLM doesn't have to find bugs, just translate them.
- **The smaller your initial scope, the more honest your final budget.** I cut "L3 LLM-generated fixes," "BYO API key," and "Monaco inline editor" from V1 after the Phase 0 final review. The result shipped in 8 sprints instead of 11.

## Try it / contribute

- **Live site**: [decodemind.dev](https://decodemind.dev) _(coming soon — pre-launch test in progress)_
- **Source**: [github.com/getdecodemind/decodemind](https://github.com/getdecodemind/decodemind) _(open-source under MIT)_
- **How to add a rule**: see [`CONTRIBUTING.md`](../CONTRIBUTING.md). One YAML file in `src/lib/rules/definitions/`, one EN explanation, one FR explanation, and the existing test suite picks it up automatically.

## Author note

I built this solo. Pair-programming with Claude was the productivity multiplier — most of the implementation work for V1's eight sprints happened via parallel subagents under a single Husky-enforced quality gate. The architectural decisions and trade-offs were mine; the code review was both of ours. I documented the workflow in [`docs/superpowers/`](./superpowers/) if anyone wants to replicate the pattern.

If DecodeMind catches a real bug in your code on its first try, let me know. If it doesn't, also let me know — that's the data I want.
