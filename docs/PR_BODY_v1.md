# DecodeMind V1 — full implementation

## Summary

Phase 0 spike (15 tasks) + V1 sprints (1-8) + post-launch polish: a privacy-first browser code scanner now works end-to-end.

## What's in this PR

### Phase 0 (spike branch merged earlier)
- Vite + React 18 + TypeScript 5.9 + Tailwind 3 scaffold
- 4 in-browser scanners: Ruff (WASM), ESLint, ast-grep (WASM, deferred), Prettier
- WebLLM + Qwen 2.5 Coder loader (tier-selected 1.5B / 3B / 7B)
- Folder picker via File System Access API
- 31 unit tests

### V1 (sprints 1-8 in this branch)
- Sprint 1: foundation cleanup (eslint devDep, adapter.info, Zustand, vite-plugin-pwa, Husky)
- Sprint 2: `.decodemind-ignore` support, worker pool, persistent FS handle, Firefox/Safari fallback
- Sprint 3: ast-grep grammar pipeline (Vite plugin copies tree-sitter wasms) + 30 custom rules + EN/FR explanation dictionary
- Sprint 4: WebLLM tier modal + IndexedDB translation cache with LRU
- Sprint 5: sectioned report UI (Security / Bugs / Logic / Quality) + noise score + severity routing
- Sprint 6: auto-fix L1/L2 machinery + backup mechanism + 30 more rules (60 total)
- Sprint 7: PDF / SARIF / Markdown export
- Sprint 8: Cloudflare Pages `_headers`, favicon, OG meta, manual chunks, USAGE/CONTRIBUTING docs

### Post-launch fixes
- Severity mapping derived from Ruff rule prefix (E501/UP* = info, S*/F* = error)
- ESLint CommonJS auto-detection (kills `require not defined` false positives on Node files)
- Web/Node platform globals (`performance`, `crypto`, `TextEncoder`, etc.) + test-runner globals for `.test/.spec` files
- Wired Apply-fix flow end-to-end with SHA-256 verify-after-write
- ErrorBoundary, console.error visibility, PWA prompt mode
- ESLint fix.range exposure — JS/TS findings now get the Apply button (latest commit)

## Numbers

- 246+ unit tests passing (subject to latest commits)
- TypeScript strict mode, zero errors
- Husky pre-commit runs typecheck + tests
- Production build: ~6 MB JS (gzipped: ~1.7 MB), 3 separate worker chunks, service worker via Workbox
- 60 custom ast-grep rules across 5 families with EN+FR plain-language explanations
- 0 server-side dependencies, 100% browser-local execution
- 0 network requests carry source code (verified by audit)

## How to verify

```sh
git checkout v1
npm install
npm run typecheck     # 0 errors
npm test              # 246+/246+ passing
npm run build         # production build
npm run dev           # local server at http://localhost:5173
# Or double-click start.bat to launch
```

## Known follow-ups (V2, not blocking this merge)

- L3 LLM-generated fixes (Qwen synthesizes patches)
- "Second opinion" via user-provided API key
- Inline Monaco patch editor
- More languages (Go, Rust, Java, C#, PHP)
- VS Code / JetBrains extensions
- GitHub Action
- Fine-tuned custom model
- Team mode with shared rule library
- Full SARIF 2.1.0 conformance

## Closes

N/A — this is the initial V1 implementation.
