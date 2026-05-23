import { describe, it, expect } from 'vitest';
import {
  parsePackageJson,
  parseRequirementsTxt,
  parseComposerJson,
  parseGoMod,
  parseCargoToml,
} from '@/lib/scanners/osv/parsers';

// ─── package.json ─────────────────────────────────────────────────────────────

describe('parsePackageJson', () => {
  it('parses dependencies and devDependencies', () => {
    const text = `{
  "name": "demo",
  "dependencies": {
    "lodash": "^4.17.20",
    "react": "18.2.0"
  },
  "devDependencies": {
    "vitest": "~1.0.0"
  }
}`;
    const deps = parsePackageJson(text);
    expect(deps).toHaveLength(3);
    const lodash = deps.find((d) => d.name === 'lodash');
    expect(lodash?.version).toBe('4.17.20');
    expect(lodash?.ecosystem).toBe('npm');
    expect(lodash?.line).not.toBeNull();
    expect(deps.find((d) => d.name === 'react')?.version).toBe('18.2.0');
    expect(deps.find((d) => d.name === 'vitest')?.version).toBe('1.0.0');
  });

  it('skips file/link/workspace/git/npm-alias/github refs', () => {
    const text = JSON.stringify({
      dependencies: {
        a: 'file:./local',
        b: 'workspace:*',
        c: 'git+https://example.com/repo.git',
        d: 'npm:alias@1.0.0',
        e: 'user/repo',
        f: 'https://example.com/pkg.tgz',
        g: '1.2.3',
      },
    });
    const deps = parsePackageJson(text);
    expect(deps.map((d) => d.name)).toEqual(['g']);
  });

  it('returns [] on malformed JSON without throwing', () => {
    expect(parsePackageJson('{ this is not json')).toEqual([]);
  });
});

// ─── requirements.txt ─────────────────────────────────────────────────────────

describe('parseRequirementsTxt', () => {
  it('parses common pip operators and skips comments / option-lines / urls', () => {
    const text = `# top comment
django==4.0.5
requests >= 2.20.0    # inline comment
Pillow~=9.0.1
flask
-r other-requirements.txt
-e .
git+https://github.com/foo/bar.git
SomePkg ; python_version<'3.10'
`;
    // Add a version to SomePkg so the env-marker test exercises that path.
    const text2 = text + `numpy[all]==1.24.0\n`;
    const deps = parseRequirementsTxt(text2);
    const byName = Object.fromEntries(deps.map((d) => [d.name, d]));
    expect(byName['django']?.version).toBe('4.0.5');
    expect(byName['requests']?.version).toBe('2.20.0');
    expect(byName['pillow']?.version).toBe('9.0.1');
    expect(byName['numpy']?.version).toBe('1.24.0');
    // Skipped (no version) / option-line / URL — none of these should land:
    expect(byName['flask']).toBeUndefined();
    expect(byName['somepkg']).toBeUndefined();
    expect(byName['bar']).toBeUndefined();
    // Every entry should be tagged pypi and have a 1-based line number.
    for (const d of deps) {
      expect(d.ecosystem).toBe('pypi');
      expect(d.line).toBeGreaterThan(0);
    }
  });

  it('normalizes underscores to hyphens and lowercases the package name', () => {
    const deps = parseRequirementsTxt(`MY_Package==1.0.0\n`);
    expect(deps).toEqual([
      { name: 'my-package', version: '1.0.0', ecosystem: 'pypi', line: 1 },
    ]);
  });
});

// ─── composer.json ────────────────────────────────────────────────────────────

describe('parseComposerJson', () => {
  it('walks require and require-dev, skipping platform packages', () => {
    const text = `{
  "require": {
    "php": ">=8.1",
    "ext-mbstring": "*",
    "laravel/framework": "^8.0.0",
    "guzzlehttp/psr7": "2.4.0"
  },
  "require-dev": {
    "phpunit/phpunit": "^10.0"
  }
}`;
    const deps = parseComposerJson(text);
    const names = deps.map((d) => d.name).sort();
    expect(names).toEqual(['guzzlehttp/psr7', 'laravel/framework', 'phpunit/phpunit']);
    const laravel = deps.find((d) => d.name === 'laravel/framework');
    expect(laravel?.version).toBe('8.0.0');
    expect(laravel?.ecosystem).toBe('packagist');
  });
});

// ─── go.mod ───────────────────────────────────────────────────────────────────

describe('parseGoMod', () => {
  it('parses both single-line and block require directives', () => {
    const text = `module example.com/demo

go 1.21

require github.com/gin-gonic/gin v1.9.0

require (
    golang.org/x/net v0.10.0 // indirect
    github.com/jackc/pgx/v4 v4.18.0
)
`;
    const deps = parseGoMod(text);
    expect(deps).toHaveLength(3);
    const gin = deps.find((d) => d.name === 'github.com/gin-gonic/gin');
    expect(gin?.version).toBe('1.9.0');
    expect(gin?.ecosystem).toBe('go');
    expect(deps.find((d) => d.name === 'golang.org/x/net')?.version).toBe('0.10.0');
    expect(deps.find((d) => d.name === 'github.com/jackc/pgx/v4')?.version).toBe('4.18.0');
  });
});

// ─── Cargo.toml ───────────────────────────────────────────────────────────────

describe('parseCargoToml', () => {
  it('parses simple strings, inline tables, and dotted keys; skips git/path/workspace', () => {
    const text = `[package]
name = "demo"
version = "0.1.0"

[dependencies]
chrono = "0.4.19"
mio = { version = "0.8.10", features = ["os-poll"] }
local-thing = { path = "../local" }
forked = { git = "https://example.com/repo.git" }
rustls.version = "0.21.10"
inherited.workspace = true

[dev-dependencies]
proptest = "1.0.0"
`;
    const deps = parseCargoToml(text);
    const byName = Object.fromEntries(deps.map((d) => [d.name, d]));
    expect(byName['chrono']?.version).toBe('0.4.19');
    expect(byName['mio']?.version).toBe('0.8.10');
    expect(byName['rustls']?.version).toBe('0.21.10');
    expect(byName['proptest']?.version).toBe('1.0.0');
    // Path / git / workspace inheritance should not produce entries
    expect(byName['local-thing']).toBeUndefined();
    expect(byName['forked']).toBeUndefined();
    expect(byName['inherited']).toBeUndefined();
    // Package name from [package] is not in a dependencies section
    expect(byName['name']).toBeUndefined();
    expect(byName['version']).toBeUndefined();
    for (const d of deps) {
      expect(d.ecosystem).toBe('cargo');
    }
  });
});
