# Contributing to DecodeMind

Thank you for considering a contribution! DecodeMind is built by an independent author with [Claude](https://claude.ai) as a partner — clear, focused contributions are very welcome.

## Setup

```sh
npm install
npm run dev          # opens http://localhost:5173 in your default browser
npm test             # unit tests (Vitest)
npm run typecheck    # strict TypeScript
npm run build        # production build to dist/
```

A pre-commit hook (Husky) runs `npm run typecheck && npm test` automatically — your commit will be blocked if either fails.

## Project layout

```
src/
├── components/      # React components organized by feature
├── lib/             # Pure logic modules (no React)
│   ├── cache/         # Translation cache
│   ├── export/        # PDF / SARIF / Markdown export
│   ├── fixes/         # L1/L2 edit application + backup
│   ├── grammars/      # Tree-sitter grammar registry + Vite plugin
│   ├── hooks/         # React hooks
│   ├── llm/           # WebLLM loader + translator
│   ├── measurement/   # Timing + formatting utilities
│   ├── report/        # Report types + categorization
│   └── rules/         # ast-grep YAML rules + EN/FR dictionary
├── spike/           # Phase 0 measurement harness (kept for reference)
├── stores/          # Zustand state
└── workers/         # Web Workers (Ruff, ESLint, Prettier, ast-grep)
docs/
├── superpowers/specs/      # Design specs
├── superpowers/plans/      # Sprint plans
└── superpowers/spike-results/  # Phase 0 measurement findings
```

## Adding a new rule

1. Create a YAML file at `src/lib/rules/definitions/<id>.yml`:
   ```yaml
   id: my-new-rule
   language: Python
   category: security
   severity: warning
   message: <one-line description>
   rule:
     pattern: <ast-grep pattern>
   ```
2. Add the EN explanation to `src/lib/rules/explanations.en.json`:
   ```json
   {
     "my-new-rule": {
       "problem": "What's wrong, in plain language.",
       "impact": "What could break.",
       "fix": "How to fix it."
     }
   }
   ```
3. Add the FR translation to `src/lib/rules/explanations.fr.json`.
4. The existing test (`tests/lib/rules/definitions.test.ts`) discovers the new rule and validates parsing + dictionary coverage. Run `npm test`.

## Adding a language

1. Add the extension to `EXT_TO_SCANNER` in `src/spike/folderScan.ts`
2. If it's a tree-sitter-supported language, add it to `GRAMMAR_REGISTRY` in `src/lib/grammars/registry.ts`
3. Otherwise wire up a new scanner in `src/workers/` following the existing pattern (request/response discriminated union, error handling, `performance.now()` timing)

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat(scope):` new feature
- `fix(scope):` bug fix
- `docs:` documentation only
- `chore:` tooling, build, deps

The pre-commit hook will block commits that fail typecheck or tests.

## Code quality

- All `src/` code is strict TypeScript.
- Prefer pure functions in `src/lib/` and keep React state in `src/components/`.
- Web Workers handle long-running CPU work — never block the main thread.
- Privacy is non-negotiable: no `fetch` to any third party with user code content.

## License

MIT.
