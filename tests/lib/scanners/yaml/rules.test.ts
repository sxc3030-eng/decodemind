/**
 * Positive + negative cases for every regex YAML rule.
 * NOTE: vitest.config.ts only picks up tests under `tests/**`, so this file
 * is not auto-run by `npm test`. It exists as an executable specification —
 * each block documents what each rule should/shouldn't catch.
 *
 * Run manually with: `npx vitest run --include 'src/lib/scanners/yaml/**'`
 */
import { describe, it, expect } from 'vitest';
import { YAML_RULES } from '@/lib/scanners/yaml/rules';

const byId = (id: string) => {
  const r = YAML_RULES.find((x) => x.id === id);
  if (!r) throw new Error(`no rule ${id}`);
  return r;
};

const K8S_HEADER = 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: x\nspec:\n';
const K8S_PATH = 'manifests/deploy.yaml';

describe('K8s boolean rules', () => {
  it('flags privileged: true', () => {
    const r = byId('yaml-k8s-privileged-true');
    expect(r.match(K8S_HEADER + '      privileged: true').length).toBe(1);
    expect(r.match(K8S_HEADER + '      privileged: false').length).toBe(0);
    expect(r.pathMatches!(K8S_PATH, K8S_HEADER)).toBe(true);
  });

  it('flags runAsUser: 0', () => {
    const r = byId('yaml-k8s-runasuser-root');
    expect(r.match(K8S_HEADER + '  runAsUser: 0').length).toBe(1);
    expect(r.match(K8S_HEADER + '  runAsUser: 1000').length).toBe(0);
  });

  it('flags runAsNonRoot: false', () => {
    const r = byId('yaml-k8s-runasnonroot-false');
    expect(r.match(K8S_HEADER + '  runAsNonRoot: false').length).toBe(1);
    expect(r.match(K8S_HEADER + '  runAsNonRoot: true').length).toBe(0);
  });

  it('flags hostNetwork/hostPID/hostIPC: true', () => {
    expect(byId('yaml-k8s-host-network').match(K8S_HEADER + '  hostNetwork: true').length).toBe(1);
    expect(byId('yaml-k8s-host-pid').match(K8S_HEADER + '  hostPID: true').length).toBe(1);
    expect(byId('yaml-k8s-host-ipc').match(K8S_HEADER + '  hostIPC: true').length).toBe(1);
    expect(byId('yaml-k8s-host-network').match(K8S_HEADER + '  hostNetwork: false').length).toBe(0);
  });

  it('flags allowPrivilegeEscalation: true', () => {
    const r = byId('yaml-k8s-allowprivilegeescalation-true');
    expect(r.match(K8S_HEADER + '      allowPrivilegeEscalation: true').length).toBe(1);
    expect(r.match(K8S_HEADER + '      allowPrivilegeEscalation: false').length).toBe(0);
  });

  it('flags readOnlyRootFilesystem: false', () => {
    const r = byId('yaml-k8s-readonlyrootfs-false');
    expect(r.match(K8S_HEADER + '      readOnlyRootFilesystem: false').length).toBe(1);
    expect(r.match(K8S_HEADER + '      readOnlyRootFilesystem: true').length).toBe(0);
  });

  it('does not match boolean rules inside comments', () => {
    const r = byId('yaml-k8s-privileged-true');
    expect(r.match(K8S_HEADER + '  # privileged: true # disabled').length).toBe(0);
  });
});

describe('K8s capabilities ALL', () => {
  const r = byId('yaml-k8s-capabilities-add-all');
  it('matches flow form', () => {
    const src = K8S_HEADER + '      capabilities:\n        add: ["ALL"]\n';
    expect(r.match(src).length).toBe(1);
  });
  it('matches block form', () => {
    const src = K8S_HEADER + '      capabilities:\n        add:\n          - ALL\n';
    expect(r.match(src).length).toBe(1);
  });
  it('does not flag specific capabilities', () => {
    const src = K8S_HEADER + '      capabilities:\n        add: ["NET_ADMIN"]\n';
    expect(r.match(src).length).toBe(0);
  });
});

describe('K8s no resources.limits (file-level)', () => {
  const r = byId('yaml-k8s-no-resources-limits');
  it('flags a Deployment with containers and no limits', () => {
    const src = `apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          image: nginx:1.27`;
    expect(r.match(src).length).toBe(1);
  });
  it('does not flag when limits: is present', () => {
    const src = `apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          image: nginx:1.27
          resources:
            limits:
              cpu: "500m"`;
    expect(r.match(src).length).toBe(0);
  });
  it('does not flag a ConfigMap', () => {
    const src = `apiVersion: v1
kind: ConfigMap
data:
  foo: bar`;
    expect(r.match(src).length).toBe(0);
  });
});

describe('K8s image tag latest', () => {
  const r = byId('yaml-k8s-image-tag-latest');
  it('flags :latest', () => {
    expect(r.match(K8S_HEADER + '      image: nginx:latest').length).toBe(1);
  });
  it('flags no tag', () => {
    expect(r.match(K8S_HEADER + '      image: nginx').length).toBe(1);
  });
  it('does not flag a pinned semver tag', () => {
    expect(r.match(K8S_HEADER + '      image: nginx:1.27.1').length).toBe(0);
  });
  it('does not flag a digest-pinned image', () => {
    expect(r.match(K8S_HEADER + '      image: nginx@sha256:abcd1234').length).toBe(0);
  });
  it('handles a host:port/path:tag reference', () => {
    expect(r.match(K8S_HEADER + '      image: registry.example.com:5000/nginx:1.0').length).toBe(0);
    expect(r.match(K8S_HEADER + '      image: registry.example.com:5000/nginx').length).toBe(1);
  });
});

describe('K8s imagePullPolicy Always with pinned tag', () => {
  const r = byId('yaml-k8s-imagepullpolicy-always-with-tag');
  it('flags Always + pinned tag', () => {
    const src = K8S_HEADER + '      image: nginx:1.27\n      imagePullPolicy: Always\n';
    expect(r.match(src).length).toBe(1);
  });
  it('does not flag Always + :latest', () => {
    const src = K8S_HEADER + '      image: nginx:latest\n      imagePullPolicy: Always\n';
    expect(r.match(src).length).toBe(0);
  });
});

describe('GHA pull_request_target with checkout', () => {
  const r = byId('yaml-gha-pull-request-target-with-checkout');
  it('flags the combination', () => {
    const src = `on: pull_request_target
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}`;
    expect(r.match(src).length).toBe(1);
    expect(r.pathMatches!('.github/workflows/x.yml', src)).toBe(true);
  });
  it('does not flag pull_request alone', () => {
    const src = `on: pull_request
jobs:
  build:
    steps:
      - uses: actions/checkout@v4`;
    expect(r.match(src).length).toBe(0);
  });
  it('does not fire on K8s manifest path', () => {
    expect(r.pathMatches!('manifests/x.yaml', '')).toBe(false);
  });
});

describe('GHA third-party action without SHA pin', () => {
  const r = byId('yaml-gha-third-party-no-sha-pin');
  it('flags someorg/action@v2', () => {
    const src = `jobs:\n  x:\n    steps:\n      - uses: someorg/action@v2`;
    expect(r.match(src).length).toBe(1);
  });
  it('does not flag actions/checkout@v4 (first-party)', () => {
    const src = `jobs:\n  x:\n    steps:\n      - uses: actions/checkout@v4`;
    expect(r.match(src).length).toBe(0);
  });
  it('does not flag a SHA-pinned third party', () => {
    const src = `jobs:\n  x:\n    steps:\n      - uses: someorg/action@0123456789abcdef0123456789abcdef01234567`;
    expect(r.match(src).length).toBe(0);
  });
  it('does not flag local actions', () => {
    const src = `jobs:\n  x:\n    steps:\n      - uses: ./.github/actions/local@main`;
    expect(r.match(src).length).toBe(0);
  });
});

describe('GHA hardcoded secret in env', () => {
  const r = byId('yaml-gha-secret-in-env-name');
  it('flags literal token', () => {
    const src = `jobs:\n  x:\n    env:\n      GITHUB_TOKEN: ghp_abc123`;
    expect(r.match(src).length).toBe(1);
  });
  it('does not flag ${{ secrets.X }} reference', () => {
    const src = `jobs:\n  x:\n    env:\n      GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`;
    expect(r.match(src).length).toBe(0);
  });
  it('does not flag a non-secret-looking name', () => {
    const src = `jobs:\n  x:\n    env:\n      NODE_ENV: production`;
    expect(r.match(src).length).toBe(0);
  });
});

describe('GHA permissions: write-all', () => {
  const r = byId('yaml-gha-permissions-write-all');
  it('flags top-level write-all', () => {
    expect(r.match(`permissions: write-all\njobs: {}`).length).toBe(1);
  });
  it('does not flag narrowed permissions', () => {
    expect(r.match(`permissions:\n  contents: read`).length).toBe(0);
  });
});

describe('GHA script injection via github.event.*.title/body', () => {
  const r = byId('yaml-gha-script-with-untrusted-context');
  it('flags block-scalar run with ${{ github.event.issue.title }}', () => {
    const src = `jobs:
  x:
    steps:
      - name: bad
        run: |
          echo "\${{ github.event.issue.title }}"`;
    expect(r.match(src).length).toBe(1);
  });
  it('flags PR title body in block scalar', () => {
    const src = `jobs:
  x:
    steps:
      - run: |
          echo "\${{ github.event.pull_request.body }}"`;
    expect(r.match(src).length).toBe(1);
  });
  it('does not flag env-variable indirection', () => {
    const src = `jobs:
  x:
    steps:
      - env:
          TITLE: \${{ github.event.issue.title }}
        run: |
          echo "$TITLE"`;
    expect(r.match(src).length).toBe(0);
  });
});

describe('Path filters', () => {
  it('K8s rules require K8s-looking content', () => {
    const r = byId('yaml-k8s-privileged-true');
    expect(r.pathMatches!('foo.yml', 'just: a config')).toBe(false);
    expect(r.pathMatches!('foo.yml', K8S_HEADER)).toBe(true);
  });
  it('GHA rules require workflow path', () => {
    const r = byId('yaml-gha-permissions-write-all');
    expect(r.pathMatches!('.github/workflows/ci.yml', '')).toBe(true);
    expect(r.pathMatches!('docker/compose.yaml', '')).toBe(false);
  });
});
