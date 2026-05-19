# Phase 0 Spike — Findings (template, fill in from measurement run)

**Date:** 2026-05-19
**Hardware:** _fill in: CPU model + cores, RAM, GPU vendor/model_
**OS / Browser:** _fill in: Windows 11 + Chrome XXX.X.XXXX.XXX (or Edge)_
**Network for first model download:** _fill in: connection speed_

## Raw export

Drop the exported JSON next to this file (e.g. `decodemind-spike-2026-05-19.json`) and reference it here.

## Scanner performance (sample files)

| Scanner | Cold ms (1st click) | Warm ms (2nd click) | Findings count | Notes |
|---|---|---|---|---|
| Ruff (sample.py) | _fill_ | _fill_ | _fill_ | _e.g. shell=True + hallucinated method + unused var detected_ |
| ESLint (sample.ts) | _fill_ | _fill_ | _fill_ | _e.g. == undefined, eval, debugger detected_ |
| Prettier (sample.html) | _fill_ | _fill_ | n/a (formatter) | _bytes before / after_ |

## WebGPU adapter

| Field | Value |
|---|---|
| Vendor | _fill_ |
| Architecture | _fill_ |
| Available? | _yes / no (degraded mode)_ |

## Model load times

Repeat per tier (Quick required, Better/Best optional based on disk + GPU):

| Tier | Approx download (MB) | First-load duration | Cached-load duration | Notes |
|---|---|---|---|---|
| Quick (1.5B, ~840 MB) | _fill_ | _fill_ | _refresh page, click Load again — should be <5s if cached_ | |
| Better (3B, ~1.9 GB) | _fill_ | _fill_ | _fill_ | _skip if disk full_ |
| Best (7B, ~4.1 GB) | _fill_ | _fill_ | _fill_ | _skip if iGPU/limited VRAM_ |

## Translation performance

| Tier | 1 finding (ms) | Batch of 8 sequential (ms) | Avg ms/finding | Output quality (subjective) |
|---|---|---|---|---|
| Quick (1.5B) | _fill_ | _fill_ | _fill_ | _e.g. "Good plain English, on-topic"_ |
| Better (3B) | _fill_ | _fill_ | _fill_ | |
| Best (7B) | _fill_ | _fill_ | _fill_ | |

## Failures and surprises

_List anything that crashed, anything that surprised you, anything the spec assumed wrong._

- _e.g. "Worker XYZ took 3× longer than estimated"_
- _e.g. "Browser ran out of memory on Best tier"_
- _e.g. "Hard to know when 'still loading' became 'frozen'"_

## V1 budget revisions

Based on measured numbers, the V1 spec should be updated:

- **Default-tier end-to-end scan budget** (10k LOC, Quick tier): was ≤ 45 s, measured ≈ _fill_ s → revise to _fill_ s
- **First-load size estimate** (Quick): was 840 MB, actual ≈ _fill_ MB
- **First-load duration on 50 Mbps**: was < 5 min, actual ≈ _fill_ min
- **Tier strategy validity**: still 3 tiers? Promote/demote any? _fill_

## Tech surprises to capture in V1 plan

- ast-grep tree-sitter grammar pipeline: _confirmed needed; document the V1 task_
- `@ast-grep/wasm` API mismatch from initial spec: _real exports are initializeTreeSitter / registerDynamicLanguage / parse_
- Ruff WASM: _Workspace constructor needs PositionEncoding.Utf16; Diagnostic uses start_location not location_
- ESLint browser: _eslint-linter-browserify works; eslint should be added as devDep for proper types_
- Prettier 3.x: _async API in 3.0+, plugins as default imports_
- WebGPU: _check `adapter.info` vs deprecated `requestAdapterInfo()` per actual browser version_
- Production build: _worker URLs must be relative literals (no `@/` alias) — already fixed in spike_

## Next steps

- [ ] Apply budget revisions above to the spec at `docs/superpowers/specs/2026-05-18-decodemind-design.md`
- [ ] Write the V1 sprint plan using these numbers as constraints
- [ ] Commit findings + spec update with message `docs(spike): Phase 0 findings + revised V1 perf budget from measured data`
