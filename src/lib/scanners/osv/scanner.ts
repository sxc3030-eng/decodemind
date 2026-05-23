/**
 * OSV scanner entry point.
 *
 * Pure-function `scanManifest(filename, content)` — pick the right parser,
 * walk each declared dependency, and emit AggregatedFinding entries for every
 * CVE in the offline OSV_DB snapshot whose vulnerableRange matches.
 *
 * No I/O, no network, no async. Cheap enough to run inline on the main thread
 * — the optional `osv.worker.ts` wraps this to keep the UI thread free when a
 * project has dozens of manifests.
 */

import type { AggregatedFinding } from '@/spike/folderScan';
import type { OsvCve, OsvEcosystem } from './db';
import { OSV_DB } from './db';
import { versionMatchesRange } from './semverCompare';
import {
  parsePackageJson,
  parseRequirementsTxt,
  parseComposerJson,
  parseGoMod,
  parseCargoToml,
  type ParsedDep,
} from './parsers';

/**
 * Map a manifest filename to its ecosystem + parser. Recognition is by
 * basename only — we don't care where the file sits in the project tree
 * (monorepos can have many).
 */
export function ecosystemForFilename(
  filename: string,
): { ecosystem: OsvEcosystem; parse: (text: string) => ParsedDep[] } | null {
  // Strip directory and lowercase the basename for matching.
  const base = filename.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  switch (base) {
    case 'package.json':
      return { ecosystem: 'npm', parse: parsePackageJson };
    case 'requirements.txt':
    case 'requirements-dev.txt':
    case 'requirements-prod.txt':
    case 'dev-requirements.txt':
      return { ecosystem: 'pypi', parse: parseRequirementsTxt };
    case 'composer.json':
      return { ecosystem: 'packagist', parse: parseComposerJson };
    case 'go.mod':
      return { ecosystem: 'go', parse: parseGoMod };
    case 'cargo.toml':
      return { ecosystem: 'cargo', parse: parseCargoToml };
    default:
      return null;
  }
}

/**
 * True if `filename` is something `scanManifest` knows how to handle.
 * Convenience for the orchestrator to filter the file list cheaply.
 */
export function isSupportedManifest(filename: string): boolean {
  return ecosystemForFilename(filename) !== null;
}

/**
 * Build the user-facing finding message. Kept consistent with the format
 * documented in the V2 design doc: "<pkg>@<ver> has <id>: <summary> —
 * upgrade to <fixVersion>".
 */
function buildMessage(dep: ParsedDep, cve: OsvCve): string {
  return `${dep.name}@${dep.version} has ${cve.id}: ${cve.summary} — upgrade to ${cve.fixVersion}`;
}

/**
 * Main entry. Pure function — given a manifest filename and its text content,
 * returns one AggregatedFinding per (dependency, matching CVE) pair.
 *
 * Multiple CVEs can fire on the same dependency (e.g. an old `next` version
 * triggers both CVE-2023-46298 and CVE-2024-34351). We emit one finding per
 * CVE so the user sees them as separate, individually-clickable rows.
 *
 * If the filename isn't a supported manifest, returns an empty array — the
 * caller does not need to pre-filter.
 */
export function scanManifest(filename: string, content: string): AggregatedFinding[] {
  const target = ecosystemForFilename(filename);
  if (!target) return [];

  let deps: ParsedDep[];
  try {
    deps = target.parse(content);
  } catch {
    // Defense-in-depth: a parser bug should not crash the whole scan.
    return [];
  }
  if (deps.length === 0) return [];

  // Pre-index OSV_DB by (ecosystem, package) so we don't scan the whole DB
  // for every dependency. Built once per call — the DB is small and we expect
  // a fresh call per manifest file.
  const index = new Map<string, OsvCve[]>();
  for (const cve of OSV_DB) {
    if (cve.ecosystem !== target.ecosystem) continue;
    const key = `${cve.ecosystem}:${cve.package.toLowerCase()}`;
    const bucket = index.get(key);
    if (bucket) {
      bucket.push(cve);
    } else {
      index.set(key, [cve]);
    }
  }

  const findings: AggregatedFinding[] = [];
  for (const dep of deps) {
    const key = `${target.ecosystem}:${dep.name.toLowerCase()}`;
    const matches = index.get(key);
    if (!matches) continue;
    for (const cve of matches) {
      if (!versionMatchesRange(dep.version, cve.vulnerableRange)) continue;
      findings.push({
        file: filename,
        line: dep.line,
        severity: cve.severity,
        ruleId: `osv-${cve.id}`,
        message: buildMessage(dep, cve),
      });
    }
  }
  return findings;
}

/**
 * Convenience for batch scanning — feed all manifest files at once and get a
 * combined finding list. Order is stable: input file order, then dep order
 * within each file, then DB order across matching CVEs.
 */
export function scanManifests(
  files: { path: string; content: string }[],
): AggregatedFinding[] {
  const out: AggregatedFinding[] = [];
  for (const f of files) {
    out.push(...scanManifest(f.path, f.content));
  }
  return out;
}
