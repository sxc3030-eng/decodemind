# Using DecodeMind

DecodeMind scans a folder of source code in your browser and reports security issues, bugs, logic problems, and quality concerns — in plain language.

## What you need

- **Chrome or Edge** (recent version). Firefox and Safari work in a degraded read-only mode.
- A folder of code to scan (any size; the scanner skips `node_modules/`, vendored libraries, and other generated directories by default).
- Optional: a graphics card with WebGPU support if you want plain-language explanations from the local LLM. Without it, you'll see raw scanner messages plus the built-in explanation dictionary.

## First scan

1. Open https://decodemind.dev
2. Click "Pick a folder…" and select your project root in the OS dialog
3. Grant the browser read permission for the folder
4. Wait while DecodeMind:
   - Lists files matching supported extensions (Python, JS/TS, HTML, CSS)
   - Runs each file through Ruff, ESLint, Prettier, and ast-grep custom rules in parallel
5. Read the report:
   - 🔒 **Security** — show-stoppers like shell injection, hardcoded secrets, weak crypto
   - 🐛 **Bugs** — undefined variables, missing awaits, type confusion
   - 🧠 **Logic** — likely-incorrect control flow
   - ✨ **Quality** — style, complexity, dead code

## Tuning the scan

### `.decodemind-ignore` file

Add a `.decodemind-ignore` file at the root of your project, with gitignore-style patterns:

```
src/generated/
**/*.test.ts
vendor/
```

DecodeMind reads this file and skips matching paths before scanning. Combine with the built-in ignore list (`node_modules`, `dist`, `build`, `whisper-cpp`, `ggml`, etc.) for clean results.

### Strictness modes

In **Settings**, choose:
- **Strict** — all rules fire, including style nitpicks
- **Standard** (default) — security + bugs + logic rules; suppresses most style noise
- **Permissive** — only critical security and crash-bug rules

## Local LLM tiers

On first scan, DecodeMind offers three model tiers:

| Tier | Model | Disk | When to use |
|---|---|---|---|
| Quick | Qwen 2.5 Coder 1.5B | ~840 MB | Default. Works on most laptops |
| Better | Qwen 2.5 Coder 3B | ~1.9 GB | Mid-range GPU, Apple Silicon |
| Best | Qwen 2.5 Coder 7B | ~4.1 GB | Desktop GPU with ≥6 GB VRAM |
| (Skip) | None | 0 | Use built-in dictionary only |

The chosen tier downloads once into your browser cache (OPFS); subsequent scans load it from cache in seconds.

## Applying fixes

For each finding, you can:
- **Apply** — DecodeMind backs up the original file to `.decodemind-backup/<timestamp>-<file>` and applies the fix in place. Available for mechanical (L1) and suggested (L2) fixes from the underlying linters.
- **Ignore** — the finding will be skipped on future scans of this project.
- **Details** — see the plain-language explanation: what the problem is, what could break, how to fix it.

DecodeMind suggests adding `.decodemind-backup/` to your `.gitignore` on first apply.

## Export

After a scan, export the report:
- **PDF** — share with a non-technical reviewer
- **SARIF** — import into VS Code's SARIF Viewer or any SARIF-aware tool
- **Markdown** — paste into a ticket or PR description
- **Copy summary** — quick clipboard copy of just the counts

## Privacy

DecodeMind makes one technical promise: **your code never leaves your machine.**

- Files are read via the File System Access API directly from disk in the browser tab
- Linters and the LLM run in browser-local Web Workers and WebGPU
- The only network requests are:
  - First load: the static site (HTML, JS, WASM blobs) from Cloudflare Pages
  - First-time tier download: model weights from Hugging Face CDN
  - That's it. No telemetry, no analytics on code content, no accounts.

## Troubleshooting

- **"Most findings are style"** — your project has lots of style noise. Add the noisiest directories to `.decodemind-ignore` and re-scan.
- **WebGPU not available** — Chrome on Linux still flag-gates WebGPU in some versions. Try Edge, or skip the model download and use the built-in dictionary.
- **Scan is slow** — try the Quick tier (1.5B). Avoid the Best tier on iGPUs (Intel Iris Xe). Or just skip the model.
- **Folder picker missing in Firefox/Safari** — use the "Choose folder (read-only)" button. Fixes will be downloaded as a ZIP instead of applied in place.
