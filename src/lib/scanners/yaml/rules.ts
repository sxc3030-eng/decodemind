/**
 * YAML scanner rules — regex fallbacks for Kubernetes and GitHub Actions.
 *
 * Why regex instead of ast-grep tree-sitter YAML patterns?
 *  1. Path filtering: GHA rules must only fire on .github/workflows/ files, and
 *     K8s rules must only fire on files declaring `apiVersion:` + `kind:`. The
 *     ast-grep loader has no per-rule file-path filter, so a K8s ast-grep rule
 *     would false-fire on GHA workflows that happen to use the same key names.
 *  2. Many findings (latest-tag, unpinned action SHA, secret heuristics, missing
 *     resource limits) need cross-line/file-level reasoning that regex handles
 *     more directly than a single tree-sitter pattern.
 *
 * Each rule returns 0..N hits with 1-based {line, column}. Callers should
 * dedupe per (rule.id, file, line) if invoking on partial fragments.
 */

export interface YamlRule {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'security' | 'bug' | 'logic' | 'quality';
  message: string;
  /** Match against the raw YAML text; returns 1-based {line, column} for each hit. */
  match: (text: string) => Array<{ line: number; column: number }>;
  /**
   * File-path filter. Only fire when this returns true for the file.
   * If omitted, the rule fires on every YAML file the scanner sees.
   */
  pathMatches?: (path: string, text: string) => boolean;
}

// --- helpers ---------------------------------------------------------------

const lineColFor = (text: string, idx: number): { line: number; column: number } => {
  let line = 1;
  let col = 1;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
};

/** Yield every regex hit as a 1-based line/column. */
const findAll = (text: string, re: RegExp): Array<{ line: number; column: number }> => {
  const hits: Array<{ line: number; column: number }> = [];
  // Make sure the regex is global.
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const rx = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    // Anchor on the start of the match.
    hits.push(lineColFor(text, m.index));
    if (m.index === rx.lastIndex) rx.lastIndex++; // guard zero-width
  }
  return hits;
};

/** Strip line-comments so we don't match patterns inside `# comments`. */
const stripComments = (text: string): string =>
  text
    .split('\n')
    .map((l) => {
      // naive: drop after first ` #` or leading `#`. Good enough for K8s/GHA.
      const idx = l.search(/(^|\s)#/);
      return idx === -1 ? l : l.slice(0, idx);
    })
    .join('\n');

/** Heuristic: does this file look like a Kubernetes manifest? */
const looksLikeK8s = (text: string): boolean =>
  /\bapiVersion\s*:/.test(text) && /\bkind\s*:/.test(text);

/** Heuristic: is this a GitHub Actions workflow file? Accepts both relative
 *  (`.github/workflows/ci.yml`) and absolute paths. */
const looksLikeGhaPath = (path: string): boolean =>
  /(?:^|[\\/])\.github[\\/]workflows[\\/][^\\/]+\.ya?ml$/i.test(path);

// --- K8s rules -------------------------------------------------------------

const K8S_PATH_MATCH = (_: string, text: string) => looksLikeK8s(text);

const k8sBoolRule = (
  id: string,
  key: string,
  badValue: 'true' | 'false',
  severity: YamlRule['severity'],
  message: string,
): YamlRule => ({
  id,
  severity,
  category: 'security',
  message,
  match: (text) => findAll(stripComments(text), new RegExp(`^\\s*${key}\\s*:\\s*${badValue}\\b`, 'gm')),
  pathMatches: K8S_PATH_MATCH,
});

// --- GitHub Actions rules --------------------------------------------------

const GHA_PATH_MATCH = (path: string, _text: string) => looksLikeGhaPath(path);

// --- the catalogue ---------------------------------------------------------

export const YAML_RULES: YamlRule[] = [
  // 1. Kubernetes — privileged containers
  k8sBoolRule(
    'yaml-k8s-privileged-true',
    'privileged',
    'true',
    'error',
    'Container runs privileged — equivalent to root on the host. Set securityContext.privileged: false.',
  ),

  // 2. runAsUser: 0  → root inside the container
  {
    id: 'yaml-k8s-runasuser-root',
    severity: 'error',
    category: 'security',
    message: 'Container runs as UID 0 (root). Set runAsUser to a non-zero UID.',
    match: (text) => findAll(stripComments(text), /^\s*runAsUser\s*:\s*0\b/gm),
    pathMatches: K8S_PATH_MATCH,
  },

  // 3. runAsNonRoot: false → explicitly opts out of the non-root guard
  k8sBoolRule(
    'yaml-k8s-runasnonroot-false',
    'runAsNonRoot',
    'false',
    'error',
    'runAsNonRoot: false disables the non-root guard. Set to true and use a non-zero runAsUser.',
  ),

  // 4. hostNetwork — pod shares the host network namespace
  k8sBoolRule(
    'yaml-k8s-host-network',
    'hostNetwork',
    'true',
    'error',
    'hostNetwork: true exposes the host network to the pod. Avoid unless this is a known infra DaemonSet.',
  ),

  // 5. hostPID
  k8sBoolRule(
    'yaml-k8s-host-pid',
    'hostPID',
    'true',
    'error',
    'hostPID: true lets the pod see host processes. Strongly discouraged.',
  ),

  // 6. hostIPC
  k8sBoolRule(
    'yaml-k8s-host-ipc',
    'hostIPC',
    'true',
    'error',
    'hostIPC: true shares the host IPC namespace with the pod. Strongly discouraged.',
  ),

  // 7. allowPrivilegeEscalation: true
  k8sBoolRule(
    'yaml-k8s-allowprivilegeescalation-true',
    'allowPrivilegeEscalation',
    'true',
    'error',
    'allowPrivilegeEscalation: true lets a process gain more privileges than its parent. Set to false.',
  ),

  // 8. readOnlyRootFilesystem: false
  k8sBoolRule(
    'yaml-k8s-readonlyrootfs-false',
    'readOnlyRootFilesystem',
    'false',
    'warning',
    'readOnlyRootFilesystem: false allows writes anywhere on the container FS. Prefer read-only and mount tmp volumes.',
  ),

  // 9. capabilities: add: ["ALL"] — covers block + flow + single-quoted forms
  {
    id: 'yaml-k8s-capabilities-add-all',
    severity: 'error',
    category: 'security',
    message: 'capabilities.add includes ALL — grants every Linux capability to the container.',
    match: (text) => {
      const src = stripComments(text);
      const hits: Array<{ line: number; column: number }> = [];
      // Look for an `add:` key under (assumed) `capabilities:`, then scan
      // either the same-line flow sequence or the following block sequence.
      const addRe = /^([ \t]*)add\s*:\s*(\[[^\]\n]*\])?\s*$/gm;
      let m: RegExpExecArray | null;
      while ((m = addRe.exec(src)) !== null) {
        const flow = m[2];
        if (flow && /\b(['"]?)ALL\1\b/.test(flow)) {
          hits.push(lineColFor(src, m.index));
          continue;
        }
        // Block style: scan following lines deeper-indented than `add:`.
        const baseIndent = m[1].length;
        const after = src.slice(m.index + m[0].length + 1);
        const blockLines = after.split('\n');
        for (const ln of blockLines) {
          if (ln.trim() === '') continue;
          const indent = ln.length - ln.trimStart().length;
          if (indent <= baseIndent) break;
          if (/^\s*-\s*(['"]?)ALL\1\s*$/.test(ln)) {
            hits.push(lineColFor(src, m.index));
            break;
          }
        }
      }
      return hits;
    },
    pathMatches: K8S_PATH_MATCH,
  },

  // 10. No resources.limits on a Deployment/StatefulSet/DaemonSet — file-level
  {
    id: 'yaml-k8s-no-resources-limits',
    severity: 'warning',
    category: 'quality',
    message: 'Workload defines containers but no resources.limits — risk of noisy-neighbour and unbounded memory.',
    match: (text) => {
      const src = stripComments(text);
      // Only meaningful for workloads with `kind: Deployment|StatefulSet|DaemonSet|Job|CronJob`.
      if (!/^\s*kind\s*:\s*(Deployment|StatefulSet|DaemonSet|Job|CronJob|Pod)\b/m.test(src)) return [];
      // Must have at least one container.
      if (!/^\s*containers\s*:/m.test(src)) return [];
      // If we see any `limits:` block at all, assume ok — too noisy to attribute per-container.
      if (/^\s*limits\s*:/m.test(src)) return [];
      const m = /^\s*kind\s*:/m.exec(src);
      return m ? [lineColFor(src, m.index)] : [];
    },
    pathMatches: K8S_PATH_MATCH,
  },

  // 11. image: foo:latest  OR  image: foo (no tag at all)
  {
    id: 'yaml-k8s-image-tag-latest',
    severity: 'warning',
    category: 'quality',
    message: 'Image uses :latest or no tag — pin a specific tag or, better, an image digest for reproducible deploys.',
    match: (text) => {
      const src = stripComments(text);
      const hits: Array<{ line: number; column: number }> = [];
      const re = /^(\s*)image\s*:\s*['"]?([^\s'"#]+)['"]?\s*$/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const ref = m[2];
        if (ref.includes('${')) continue;       // templated, skip
        if (ref.includes('@sha256:')) continue; // digest-pinned, ok
        // Extract tag: everything after the LAST ':' provided that ':' isn't part of a port (host:port/path).
        // Strategy: split on '/' first; the tag (if any) lives only in the final segment after a ':'.
        const lastSlash = ref.lastIndexOf('/');
        const finalSeg = ref.slice(lastSlash + 1);
        const colon = finalSeg.lastIndexOf(':');
        const tag = colon === -1 ? '' : finalSeg.slice(colon + 1);
        if (tag === '' || tag === 'latest') {
          hits.push(lineColFor(src, m.index + m[1].length));
        }
      }
      return hits;
    },
    pathMatches: K8S_PATH_MATCH,
  },

  // 12. imagePullPolicy: Always combined with a pinned tag (defeats caching, surprises)
  {
    id: 'yaml-k8s-imagepullpolicy-always-with-tag',
    severity: 'info',
    category: 'quality',
    message: 'imagePullPolicy: Always with a non-latest tag refetches every restart — only useful for mutable tags.',
    match: (text) => {
      const src = stripComments(text);
      const hits: Array<{ line: number; column: number }> = [];
      // For each container block: look at sibling `image:` and `imagePullPolicy: Always`.
      // Approximation: any `imagePullPolicy: Always` whose nearest preceding `image:` line uses an explicit non-latest tag.
      const lines = src.split('\n');
      let lastImageLine = -1;
      let lastImageTagWasPinned = false;
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        const im = /^\s*image\s*:\s*['"]?([^\s'"#]+)/.exec(ln);
        if (im) {
          lastImageLine = i;
          const ref = im[1];
          const finalSeg = ref.slice(ref.lastIndexOf('/') + 1);
          const colon = finalSeg.lastIndexOf(':');
          const tag = colon === -1 ? '' : finalSeg.slice(colon + 1);
          lastImageTagWasPinned = tag !== '' && tag !== 'latest';
        }
        if (/^\s*imagePullPolicy\s*:\s*Always\b/.test(ln) && lastImageLine !== -1 && lastImageTagWasPinned) {
          // map line index to char index via cumulative offsets
          let off = 0;
          for (let j = 0; j < i; j++) off += lines[j].length + 1;
          off += ln.length - ln.trimStart().length;
          hits.push(lineColFor(src, off));
        }
      }
      return hits;
    },
    pathMatches: K8S_PATH_MATCH,
  },

  // --- GitHub Actions ----------------------------------------------------

  // 13. pull_request_target + checkout — canonical RCE vector
  {
    id: 'yaml-gha-pull-request-target-with-checkout',
    severity: 'error',
    category: 'security',
    message: 'pull_request_target combined with actions/checkout of the PR head exposes secrets to attacker-controlled code (CWE-829).',
    match: (text) => {
      const src = stripComments(text);
      const hasTrigger = /^\s*(-\s*)?pull_request_target\s*:?/m.test(src) || /\bpull_request_target\b/.test(src);
      if (!hasTrigger) return [];
      const co = /uses\s*:\s*actions\/checkout@/i.exec(src);
      if (!co) return [];
      // Flag the checkout line — that's where the exploit actually happens.
      return [lineColFor(src, co.index)];
    },
    pathMatches: GHA_PATH_MATCH,
  },

  // 14. uses: someorg/action@<tag>  — must be a 40-char SHA
  {
    id: 'yaml-gha-third-party-no-sha-pin',
    severity: 'warning',
    category: 'security',
    message: 'Third-party action is pinned to a tag, not a 40-char commit SHA — tags are mutable and can be re-pointed by the action author.',
    match: (text) => {
      const src = stripComments(text);
      const hits: Array<{ line: number; column: number }> = [];
      const re = /^\s*-?\s*uses\s*:\s*['"]?([^\s'"#@]+)@([^\s'"#]+)/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const repo = m[1];
        const ref = m[2];
        if (repo.startsWith('./') || repo.startsWith('docker://')) continue;
        // First-party `actions/*` is widely allowed pinned by tag — flag only third-party.
        if (/^actions\//i.test(repo) || /^github\//i.test(repo)) continue;
        if (/^[0-9a-f]{40}$/i.test(ref)) continue; // already SHA-pinned
        hits.push(lineColFor(src, m.index + m[0].indexOf(repo)));
      }
      return hits;
    },
    pathMatches: GHA_PATH_MATCH,
  },

  // 15. Hardcoded secret-named env: TOKEN / KEY / SECRET / PASSWORD literal
  {
    id: 'yaml-gha-secret-in-env-name',
    severity: 'error',
    category: 'security',
    message: 'Env var name suggests a secret but the value is a literal — reference ${{ secrets.X }} instead of hardcoding.',
    match: (text) => {
      const src = stripComments(text);
      const hits: Array<{ line: number; column: number }> = [];
      // Only within a heuristic env: block — grab any `WORD: value` pair where the key matches secret words and the value isn't a ${{ secrets.* }} expression.
      const re = /^(\s+)([A-Z][A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|PASSWD|API[_-]?KEY))\s*:\s*(.+)$/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const value = m[3].trim();
        // Allowed: ${{ secrets.X }}, ${{ env.X }}, ${{ vars.X }}, empty
        if (/^\$\{\{\s*secrets\./.test(value)) continue;
        if (/^\$\{\{\s*env\./.test(value)) continue;
        if (/^\$\{\{\s*vars\./.test(value)) continue;
        if (/^['"]?\s*['"]?$/.test(value)) continue; // empty string
        // Skip when the whole value is a single ${{ ... }} expression (probably an output, not a literal).
        if (/^['"]?\$\{\{[^}]+\}\}['"]?$/.test(value)) continue;
        hits.push(lineColFor(src, m.index + m[1].length));
      }
      return hits;
    },
    pathMatches: GHA_PATH_MATCH,
  },

  // 16. permissions: write-all
  {
    id: 'yaml-gha-permissions-write-all',
    severity: 'warning',
    category: 'security',
    message: 'permissions: write-all grants the workflow token every permission — narrow to the specific scopes you need.',
    match: (text) => findAll(stripComments(text), /^\s*permissions\s*:\s*write-all\b/gm),
    pathMatches: GHA_PATH_MATCH,
  },

  // 17. run: containing ${{ github.event.*.title|body }} — script injection
  {
    id: 'yaml-gha-script-with-untrusted-context',
    severity: 'error',
    category: 'security',
    message: 'Untrusted github.event.* (issue/PR title or body) interpolated into a run: script — classic GHA command injection.',
    match: (text) => {
      const src = stripComments(text);
      const hits: Array<{ line: number; column: number }> = [];
      // Find each `run:` block and scan it for the dangerous expressions.
      // A run: block ends at the next line with same-or-lesser indent that introduces another key.
      const lines = src.split('\n');
      const dangerous = /\$\{\{\s*github\.event\.(issue|pull_request|comment|review|discussion)\.(title|body)\s*\}\}/;
      const offsets: number[] = [];
      {
        let acc = 0;
        for (const l of lines) {
          offsets.push(acc);
          acc += l.length + 1;
        }
      }
      for (let i = 0; i < lines.length; i++) {
        const m = /^(\s*)(-?\s*)run\s*:\s*(.*)$/.exec(lines[i]);
        if (!m) continue;
        const indent = m[1].length;
        const head = m[3];
        // Inline run: scalar
        if (head.trim().length > 0 && head.trim() !== '|' && head.trim() !== '>') {
          if (dangerous.test(head)) hits.push(lineColFor(src, offsets[i] + indent));
          continue;
        }
        // Block scalar: scan following lines deeper-indented than `run:`.
        for (let j = i + 1; j < lines.length; j++) {
          const ln = lines[j];
          if (ln.trim() === '') continue;
          const li = ln.length - ln.trimStart().length;
          if (li <= indent) break;
          if (dangerous.test(ln)) {
            hits.push(lineColFor(src, offsets[j] + li));
            break; // one hit per run: block
          }
        }
      }
      return hits;
    },
    pathMatches: GHA_PATH_MATCH,
  },
];
