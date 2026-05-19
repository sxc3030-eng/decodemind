# DecodeMind

> A privacy-first code scanner that runs entirely in your browser.

DecodeMind scans a folder of source code and reports security issues, bugs, logic problems, and quality concerns — in plain language. **No upload. No server. No account. Free forever.**

## Live demo

🚀 **Try it now: [decodemind.dev](https://decodemind.dev)**

No signup, no upload — pick a folder, scan it, fix issues. Your code never leaves your browser.

## Status

**V1 live at [decodemind.dev](https://decodemind.dev)**

## What makes it different

- **100% in the browser** — your code never leaves your machine. Detection runs in WebAssembly / JS Web Workers; explanations come from a local LLM (Qwen 2.5 Coder via WebLLM).
- **Plain language** — linter jargon translated into actionable explanations.
- **Four dimensions in one scan** — Security, bugs, logic, quality — together.
- **Free forever, no account** — static site, anonymous, no telemetry on your code.
- **Configurable noise** — `.decodemind-ignore` per project + auto-generated-file detection.

## Tech stack

| Concern | Stack |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5.9 + Tailwind 3 |
| State | Zustand (persisted preferences) |
| Detection — Python | Ruff WASM (`@astral-sh/ruff-wasm-web`) |
| Detection — JS/TS | ESLint (`eslint-linter-browserify`) + TypeScript checker |
| Detection — multi-lang patterns | ast-grep WASM (`@ast-grep/wasm`) + tree-sitter grammars |
| Detection — formatting | Prettier 3.8 standalone |
| Translation | WebLLM 0.2.83 + Qwen 2.5 Coder (tiered 1.5B / 3B / 7B) |
| Storage | OPFS (model weights) + IndexedDB (translation cache, backups) + Cache API (static) |
| PWA | vite-plugin-pwa + Workbox |
| Hosting | Cloudflare Pages |

## Languages supported (V1)

Python, JavaScript, TypeScript, HTML, CSS.

## Running

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # 228+ unit tests
npm run typecheck    # tsc --noEmit
npm run build        # production build → dist/
```

A pre-commit hook (Husky) runs typecheck + tests before every commit.

## Documentation

- [Usage guide](docs/USAGE.md) — how to scan, tune, and apply fixes
- [Contributing](CONTRIBUTING.md) — project layout, adding rules / languages
- [Design spec](docs/superpowers/specs/2026-05-18-decodemind-design.md) — full V1 design rationale
- [Phase 0 findings](docs/superpowers/spike-results/2026-05-18-phase-0-findings.md) — measurement notes from the spike

## License

MIT.

## Author

Built by [sxc_2](https://github.com/sxc_2) with [Claude](https://claude.ai) as a brainstorming + implementation partner.
