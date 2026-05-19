# DecodeMind

> A privacy-first code scanner that runs entirely in your browser.

DecodeMind scans a folder of source code and reports bugs, security flaws, logic issues, and quality problems — in plain language anyone can understand. No upload. No server. No login. Free forever.

## Status

🚧 **In design.** Spec approved 2026-05-18. Implementation plan coming next.

## What makes it different

- **100% in the browser.** Your code never leaves your machine. Detection runs in WebAssembly; explanations come from a local LLM (Qwen 2.5 Coder 7B via WebLLM).
- **Plain language.** Linter jargon translated into actionable explanations.
- **Four dimensions in one scan.** Security, bugs, logic, quality — together, not separate tools.
- **Free forever, no account.** Static site, anonymous, no telemetry on your code.

## Tech stack (planned)

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Detection (WASM) | Ruff (Python), ESLint + tsc (JS/TS), Semgrep (custom rules), Prettier/Stylelint |
| Orchestration | WebLLM + Qwen 2.5 Coder 7B (WebGPU) |
| Storage | IndexedDB (translations, history), Cache API (model/WASM blobs) |
| Hosting | Cloudflare Pages (static, free) |

## Languages supported (V1)

- JavaScript / TypeScript
- Python
- HTML / CSS

## Design spec

The full design lives in [`docs/superpowers/specs/2026-05-18-decodemind-design.md`](docs/superpowers/specs/2026-05-18-decodemind-design.md).

## License

MIT (planned).

## Author

Built by [sxc_2](https://github.com/sxc_2) with [Claude](https://claude.ai) as a brainstorming partner.
