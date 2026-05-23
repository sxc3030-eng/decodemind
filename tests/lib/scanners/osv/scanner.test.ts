import { describe, it, expect } from 'vitest';
import {
  scanManifest,
  scanManifests,
  ecosystemForFilename,
  isSupportedManifest,
} from '@/lib/scanners/osv/scanner';

// ─── ecosystemForFilename ─────────────────────────────────────────────────────

describe('ecosystemForFilename', () => {
  it('recognises every supported manifest by basename', () => {
    expect(ecosystemForFilename('package.json')?.ecosystem).toBe('npm');
    expect(ecosystemForFilename('requirements.txt')?.ecosystem).toBe('pypi');
    expect(ecosystemForFilename('composer.json')?.ecosystem).toBe('packagist');
    expect(ecosystemForFilename('go.mod')?.ecosystem).toBe('go');
    expect(ecosystemForFilename('Cargo.toml')?.ecosystem).toBe('cargo');
  });

  it('strips paths and is case-insensitive', () => {
    expect(ecosystemForFilename('apps/web/Package.json')?.ecosystem).toBe('npm');
    expect(ecosystemForFilename('backend\\Cargo.TOML')?.ecosystem).toBe('cargo');
  });

  it('returns null for unsupported files', () => {
    expect(ecosystemForFilename('README.md')).toBeNull();
    expect(ecosystemForFilename('pnpm-lock.yaml')).toBeNull();
  });
});

describe('isSupportedManifest', () => {
  it('matches ecosystemForFilename', () => {
    expect(isSupportedManifest('package.json')).toBe(true);
    expect(isSupportedManifest('foo.txt')).toBe(false);
  });
});

// ─── scanManifest — end-to-end ────────────────────────────────────────────────

describe('scanManifest — npm', () => {
  it('fires a finding for vulnerable lodash declared in package.json', () => {
    const pkg = JSON.stringify(
      {
        name: 'demo',
        dependencies: { lodash: '4.17.20' },
      },
      null,
      2,
    );
    const findings = scanManifest('package.json', pkg);
    // Two lodash CVEs cover <4.17.21 (CVE-2021-23337 and the older
    // CVE-2019-10744 with <4.17.12), so 4.17.20 only triggers the newer one.
    expect(findings.length).toBe(1);
    const f = findings[0];
    expect(f.ruleId).toBe('osv-CVE-2021-23337');
    expect(f.severity).toBe('error');
    expect(f.file).toBe('package.json');
    expect(f.message).toContain('lodash@4.17.20');
    expect(f.message).toContain('CVE-2021-23337');
    expect(f.message).toContain('upgrade to 4.17.21');
    expect(f.line).toBeGreaterThan(0);
  });

  it('emits multiple findings when several CVEs match the same version', () => {
    const pkg = JSON.stringify({ dependencies: { lodash: '4.17.0' } });
    const findings = scanManifest('package.json', pkg);
    // 4.17.0 is below both <4.17.12 (CVE-2019-10744) and <4.17.21 (CVE-2021-23337)
    const ids = findings.map((f) => f.ruleId).sort();
    expect(ids).toEqual(['osv-CVE-2019-10744', 'osv-CVE-2021-23337']);
  });

  it('does not fire for a patched version', () => {
    const pkg = JSON.stringify({ dependencies: { lodash: '4.17.21' } });
    expect(scanManifest('package.json', pkg)).toEqual([]);
  });

  it('strips caret prefixes before comparing', () => {
    // ^4.17.20 declares "4.17.20 ≤ x < 5.0.0" — the *minimum* the user is
    // pinning is the version we report against.
    const pkg = JSON.stringify({ dependencies: { lodash: '^4.17.20' } });
    const findings = scanManifest('package.json', pkg);
    expect(findings.map((f) => f.ruleId)).toContain('osv-CVE-2021-23337');
  });
});

describe('scanManifest — pypi', () => {
  it('finds a vulnerable django version in requirements.txt', () => {
    const req = `# pinned for prod\ndjango==4.0.5\nrequests==2.31.0\n`;
    const findings = scanManifest('requirements.txt', req);
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain('osv-CVE-2023-23969');
    const dj = findings.find((f) => f.ruleId === 'osv-CVE-2023-23969');
    expect(dj?.message).toContain('django@4.0.5');
    expect(dj?.line).toBe(2);
  });
});

describe('scanManifest — packagist', () => {
  it('finds vulnerable laravel/framework in composer.json', () => {
    const composer = JSON.stringify({
      require: { 'laravel/framework': '8.74.0' },
    });
    const findings = scanManifest('composer.json', composer);
    expect(findings.map((f) => f.ruleId)).toContain('osv-CVE-2021-43808');
  });
});

describe('scanManifest — go', () => {
  it('finds a vulnerable gin version in go.mod', () => {
    const mod = `module x\n\nrequire github.com/gin-gonic/gin v1.9.0\n`;
    const findings = scanManifest('go.mod', mod);
    expect(findings.map((f) => f.ruleId)).toContain('osv-CVE-2023-29401');
  });
});

describe('scanManifest — cargo', () => {
  it('finds a vulnerable chrono version in Cargo.toml', () => {
    const cargo = `[dependencies]\nchrono = "0.4.19"\n`;
    const findings = scanManifest('Cargo.toml', cargo);
    expect(findings.map((f) => f.ruleId)).toContain('osv-RUSTSEC-2020-0159');
  });
});

// ─── unrelated files / safe inputs ────────────────────────────────────────────

describe('scanManifest — safety', () => {
  it('returns [] for an unsupported file', () => {
    expect(scanManifest('README.md', 'hi')).toEqual([]);
  });

  it('returns [] for malformed JSON without throwing', () => {
    expect(scanManifest('package.json', '{{{{ broken')).toEqual([]);
  });

  it('returns [] for a clean manifest', () => {
    const pkg = JSON.stringify({ dependencies: { 'absolutely-not-a-real-pkg': '1.0.0' } });
    expect(scanManifest('package.json', pkg)).toEqual([]);
  });
});

// ─── batch scan ───────────────────────────────────────────────────────────────

describe('scanManifests', () => {
  it('aggregates findings across multiple manifests preserving file order', () => {
    const files = [
      { path: 'apps/api/requirements.txt', content: `django==4.0.5\n` },
      {
        path: 'apps/web/package.json',
        content: JSON.stringify({ dependencies: { lodash: '4.17.0' } }),
      },
    ];
    const findings = scanManifests(files);
    // django finding(s) come first because of input order
    expect(findings[0].file).toBe('apps/api/requirements.txt');
    expect(findings.some((f) => f.file === 'apps/web/package.json')).toBe(true);
    // every finding has the security-style ruleId prefix
    for (const f of findings) {
      expect(f.ruleId).toMatch(/^osv-/);
    }
  });
});
