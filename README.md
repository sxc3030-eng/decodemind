# DecodeMind

> A privacy-first code scanner that runs entirely in your browser.

DecodeMind scans a folder of source code and reports bugs, security flaws, logic issues, and quality problems — in plain language anyone can understand. No upload. No server. No login. Free forever.

## Status

🚧 **Phase 0 spike implemented.** The measurement harness for WebLLM + 4 scanners is built and ready for benchmarking on the author's machine. V1 sprint plan comes next (after measurements revise the perf budget).

## What makes it different

- **100% in the browser.** Your code never leaves your machine. Detection runs in WebAssembly / JS Web Workers; explanations come from a local LLM (Qwen 2.5 Coder via WebLLM, tiered 1.5B / 3B / 7B).
- **Plain language.** Linter jargon translated into actionable explanations.
- **Four dimensions in one scan.** Security, bugs, logic, quality — together, not separate tools.
- **Free forever, no account.** Static site, anonymous, no telemetry on your code.

## Tech stack (Phase 0)

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite 5, TypeScript 5.9, Tailwind CSS 3 |
| Detection — Python | Ruff (WASM) via `@astral-sh/ruff-wasm-web` |
| Detection — JS/TS | ESLint via `eslint-linter-browserify` + TypeScript (planned for V1) |
| Detection — multi-lang patterns | ast-grep via `@ast-grep/wasm` (MIT) + custom YAML rules |
| Detection — formatting | Prettier 3.8 standalone + parsers (babel, estree, typescript, html, postcss) |
| Translation | WebLLM 0.2.83 + Qwen 2.5 Coder (1.5B default, 3B, 7B opt-in) |
| Storage | OPFS (model weights), IndexedDB (translation cache, history), Cache API (static) — planned for V1 |
| Hosting | Cloudflare Pages (planned) |

## Languages supported (V1 scope)

- JavaScript / TypeScript
- Python
- HTML / CSS

## Design + plan

- Full design spec: [`docs/superpowers/specs/2026-05-18-decodemind-design.md`](docs/superpowers/specs/2026-05-18-decodemind-design.md)
- Phase 0 plan: [`docs/superpowers/plans/2026-05-18-phase-0-spike.md`](docs/superpowers/plans/2026-05-18-phase-0-spike.md)

## Running the spike

```powershell
npm install
npm run dev          # opens http://localhost:5173
```

Open in Chrome or Edge (WebGPU required for full LLM experience). Click each button in order on the spike page, then "Export JSON".

```powershell
npm test             # 31 unit tests (smoke, instrument, models, translator)
npm run typecheck    # tsc --noEmit
npm run build        # production build — has known worker-URL bundling issue, addressed in V1
```

## Known gaps (Phase 0 → V1)

- **Worker URLs**: production build emits broken worker payloads when the `@/` alias is used. Spike page now uses relative paths (`../workers/...`), but a full audit + V1 fix is tracked.
- **ast-grep grammars**: the worker compiles but live scans need `tree-sitter-<lang>.wasm` files copied to `public/`. Spike UI shows a note.
- **`requestAdapterInfo()` deprecated** in current WebGPU spec; loader will switch to `adapter.info` getter in V1.

## License

MIT.

## Author

Built by [sxc_2](https://github.com/sxc_2) with [Claude](https://claude.ai) as a brainstorming + implementation partner.
