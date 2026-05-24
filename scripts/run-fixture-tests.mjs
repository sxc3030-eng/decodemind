#!/usr/bin/env node
/**
 * scripts/run-fixture-tests.mjs
 *
 * Thin shim that delegates to scripts/run-fixture-tests.ts via tsx.
 *
 * The actual runner is the TypeScript file — it imports DecodeMind's TS
 * scanner sources directly (DOCKERFILE_RULES, YAML_RULES, scanManifest),
 * which is cleaner than mirroring them in JS. tsx is added as a devDep
 * by this runner; you don't need a build step.
 *
 * Run:   node scripts/run-fixture-tests.mjs
 *   or:  npx tsx scripts/run-fixture-tests.ts
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsEntry = join(__dirname, 'run-fixture-tests.ts');

const result = spawnSync('npx', ['tsx', tsEntry], {
  stdio: 'inherit',
  shell: true,
  cwd: resolve(__dirname, '..'),
});
process.exit(result.status ?? 1);
