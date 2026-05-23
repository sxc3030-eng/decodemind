# DecodeMind — Announcement Copy

Ready-to-publish copy for each platform. Character counts shown where applicable.
Do not edit before publishing — these are final.

---

## Platform 1 — Twitter / X (4-tweet thread)

---

**Tweet 1 — Hook + URL** [270 chars]

Your code never leaves your browser. DecodeMind scans Python, JS, TS, HTML and CSS for security bugs, logic problems, and quality issues — using Ruff, ESLint, and ast-grep compiled to WebAssembly, all running locally. No account. No upload. Free.

https://decodemind.dev

---

**Tweet 2 — Why it's technically interesting** [278 chars]

Under the hood:
• Ruff + ESLint + ast-grep compiled to WASM — scanners run in Web Workers, no server
• 60 custom AST-based security/bug rules with plain-English (and French) explanations
• Optional local LLM (Qwen 2.5 Coder via WebGPU) for deeper context — stays on your machine

---

**Tweet 3 — Real-world result: the Zip Slip find** [268 chars]

Real test: I ran it on a Python security tool I had manually audited 5 times.

It flagged S202 — tarfile.extractall() without a filter argument — a Zip Slip vulnerability that lets an attacker overwrite arbitrary files on extraction.

Had missed it every audit.

---

**Tweet 4 — Open source + call for feedback** [272 chars]

It's MIT, the repo is at https://github.com/sxc3030-eng/decodemind

246 unit tests, TypeScript strict, pre-commit quality gate.

Adding a rule = one YAML file + one plain-English explanation. Contributions welcome.

If you try it and it catches (or misses) something, tell me. That's the data I need.

---

## Platform 2 — LinkedIn (long-form post, ~1200 chars)

---

Most code scanners have the same problem: to get a useful result, you hand over your code. You create an account, agree to a terms of service, push to a CI integration, and trust a third-party cloud to handle what might be your most sensitive IP. For individual developers and small teams, that's not a trade-off — it's a tax on getting feedback.

I built DecodeMind to remove that tax.

It's a static web app that scans a folder of source code entirely inside your browser tab. No upload, no account, no server that ever sees your files. You pick a folder, the scanners run, and you get a categorized report — security findings, bugs, logic problems, and quality issues — with plain-language explanations and one-click fixes where the linter provides them.

Key technical choices:
- Ruff and ast-grep are compiled to WebAssembly and run in parallel Web Workers
- 60 custom AST-based rules cover OWASP-style patterns, LLM-hallucination traps, and common bug classes
- An optional local LLM (Qwen 2.5 Coder via WebGPU) generates deeper explanations on-device — tiered 1.5B / 3B / 7B based on your GPU
- 246 unit tests, TypeScript strict mode throughout, Husky pre-commit enforcing both

Concrete result: I ran it on a Python security tool I had audited manually five times. It immediately flagged S202 — `tarfile.extractall()` without a filter — a Zip Slip vulnerability that lets a malicious archive overwrite files outside the target directory. Five manual passes had missed it.

Live at https://decodemind.dev — MIT, source on GitHub. If you try it, I'd genuinely like to know what it finds (or fails to find) in your code.

#DeveloperTools #OpenSource #WebAssembly #AppSec #PrivacyByDesign

---

## Platform 3 — HackerNews "Show HN"

---

**Title:** `Show HN: DecodeMind – Privacy-first code scanner running entirely in your browser`

**Body:**

DecodeMind scans a folder of source code for security issues, bugs, logic problems, and quality concerns, then shows plain-language explanations and applies one-click fixes. The unusual constraint I imposed on myself: zero server involvement. Your code never leaves the browser tab. There is no backend, no account, no telemetry on code content.

The detection pipeline is four linters running in parallel Web Workers. Ruff (Rust → WASM via `@astral-sh/ruff-wasm-web`) handles Python. ESLint (`eslint-linter-browserify`) handles JS/TS. Prettier 3 standalone handles HTML/CSS formatting. ast-grep (also Rust → WASM) runs a custom library of 60 AST-based rules covering common OWASP patterns and bug classes. Explanations are either drawn from a built-in static dictionary (EN + FR) or, optionally, generated on-device by Qwen 2.5 Coder via WebLLM + WebGPU, with weights cached to OPFS.

Honest assessment: it is not as deep as enterprise SAST (Semgrep Pro, Snyk Code, SonarCloud). It has no cross-file taint tracking, no inter-procedural analysis, and no LLM-generated fixes yet (detection + auto-fix for linter-addressable issues only). What it does that those tools don't: works without giving up your code, requires no account, and returns results in under 60 seconds on a 500-file project.

Stack details for the curious: React 18 + Vite 5 + TypeScript strict. Zustand for state. OPFS for model weight storage, IndexedDB for translation cache. COOP/COEP headers on Cloudflare Pages for SharedArrayBuffer / WebGPU. 246 unit tests, Husky pre-commit gate. No backend infra to maintain.

I'd welcome feedback on: the UX flow (especially the LLM tier selection on first scan), the rule library (gaps, false positives), and the tier strategy. MIT, source at https://github.com/sxc3030-eng/decodemind.

---

## Platform 4 — dev.to / Medium / Hashnode

---

### Opening hook (2 sentences — replaces TL;DR)

Every code scanner I tried asked me to upload my code first.
I built DecodeMind to prove that useful static analysis — with plain-language output, one-click fixes, and an optional local LLM — can run entirely inside a browser tab, on your machine, with zero bytes of your code ever leaving it.

---

### Author bio

**English:**
I'm a solo builder working at the intersection of security tooling and AI-assisted development. DecodeMind is one of several tools I ship under my own name — built fast, tested carefully, and kept as simple as the constraints allow. I'm reachable on GitHub at github.com/sxc3030-eng or through the repo.

**French:**
Je suis un développeur solo qui travaille à l'intersection des outils de sécurité et du développement assisté par IA. DecodeMind fait partie d'un ensemble d'outils que je publie sous mon propre nom — construits vite, testés sérieusement, et maintenus aussi simples que les contraintes le permettent. Retrouvez-moi sur GitHub à github.com/sxc3030-eng ou via le dépôt.

---

### Tags (dev.to / Hashnode)

`webassembly` `security` `tooling` `opensource` `privacy`

---

## Platform 5 — Email to friends / Slack DM (casual)

---

**English:**

Hey — I shipped a side project and would love a quick sanity check if you have 5 minutes. It's a code scanner that runs entirely in your browser — no upload, no account, just pick a folder and it finds security issues, bugs, and quality problems in plain English. It's free, MIT, and live at https://decodemind.dev. Grab any project folder you have lying around and let me know if it catches anything interesting (or if it misses something obvious — that's equally useful feedback).

---

**French:**

Salut — j'ai sorti un side project et j'aurais besoin d'un œil dessus si t'as 5 minutes. C'est un scanner de code qui tourne entièrement dans le navigateur — pas d'upload, pas de compte, tu choisis un dossier et il remonte les bugs de sécurité, les problèmes logiques et les soucis de qualité en langage clair. C'est gratuit, MIT, et en ligne sur https://decodemind.dev. Prends n'importe quel projet qui traîne et dis-moi si ça trouve quelque chose d'intéressant (ou si ça loupe un truc évident — c'est aussi utile).
