import { describe, it, expect } from 'vitest';
import { DOCKERFILE_RULES, type DockerfileRule } from '@/lib/scanners/dockerfile/rules';

/** Convenience: find a rule by id and assert it exists. */
function rule(id: string): DockerfileRule {
  const r = DOCKERFILE_RULES.find((x) => x.id === id);
  if (!r) throw new Error(`rule not found: ${id}`);
  return r;
}

/**
 * Helper: run a rule against a single line. `allLines` defaults to `[line]`.
 * For file-level rules supply both args explicitly.
 */
function fires(
  r: DockerfileRule,
  line: string,
  opts: { lineNum?: number; allLines?: string[] } = {},
): boolean {
  const allLines = opts.allLines ?? [line];
  const lineNum = opts.lineNum ?? 0;
  return r.matcher(line, lineNum, allLines);
}

describe('DOCKERFILE_RULES', () => {
  it('every rule has the required shape', () => {
    for (const r of DOCKERFILE_RULES) {
      expect(r.id).toMatch(/^dockerfile-[a-z0-9-]+$/);
      expect(['error', 'warning', 'info']).toContain(r.severity);
      expect(['security', 'bug', 'logic', 'quality']).toContain(r.category);
      expect(typeof r.message).toBe('string');
      expect(r.message.length).toBeGreaterThan(10);
      expect(typeof r.matcher).toBe('function');
    }
  });

  it('rule ids are unique', () => {
    const ids = DOCKERFILE_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('dockerfile-user-root', () => {
  const r = rule('dockerfile-user-root');

  it('fires when no USER instruction exists', () => {
    const allLines = ['FROM alpine:3.18', 'CMD ["./app"]'];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(true);
  });

  it('fires when the final USER is root', () => {
    const allLines = ['FROM alpine:3.18', 'USER appuser', 'USER root'];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(true);
  });

  it('fires when the final USER is 0', () => {
    const allLines = ['FROM alpine:3.18', 'USER 0'];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(true);
  });

  it('does NOT fire when a non-root USER is set', () => {
    const allLines = ['FROM alpine:3.18', 'USER appuser', 'CMD ["./app"]'];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(false);
  });

  it('only emits once at lineNum 0', () => {
    const allLines = ['FROM alpine:3.18', 'CMD ["./app"]'];
    expect(fires(r, allLines[1], { lineNum: 1, allLines })).toBe(false);
  });
});

describe('dockerfile-image-tag-latest', () => {
  const r = rule('dockerfile-image-tag-latest');

  it('fires on FROM image:latest', () => {
    expect(fires(r, 'FROM nginx:latest')).toBe(true);
  });

  it('fires on FROM image (no tag)', () => {
    expect(fires(r, 'FROM nginx')).toBe(true);
  });

  it('does NOT fire on FROM image:1.25.3', () => {
    expect(fires(r, 'FROM nginx:1.25.3')).toBe(false);
  });

  it('does NOT fire on FROM scratch', () => {
    expect(fires(r, 'FROM scratch')).toBe(false);
  });

  it('does NOT fire on a digest pin', () => {
    expect(
      fires(r, 'FROM nginx@sha256:abc123def4567890abc123def4567890abc123def4567890abc123def4567890'),
    ).toBe(false);
  });
});

describe('dockerfile-env-secret', () => {
  const r = rule('dockerfile-env-secret');

  it('fires on ENV PASSWORD=hunter2', () => {
    expect(fires(r, 'ENV PASSWORD=hunter2')).toBe(true);
  });

  it('fires on ENV API_KEY=abcdef', () => {
    expect(fires(r, 'ENV API_KEY=abcdef')).toBe(true);
  });

  it('does NOT fire on ENV NODE_ENV=production', () => {
    expect(fires(r, 'ENV NODE_ENV=production')).toBe(false);
  });
});

describe('dockerfile-arg-secret', () => {
  const r = rule('dockerfile-arg-secret');

  it('fires on ARG SECRET_TOKEN', () => {
    expect(fires(r, 'ARG SECRET_TOKEN')).toBe(true);
  });

  it('fires on ARG PASSWORD=default', () => {
    expect(fires(r, 'ARG PASSWORD=default')).toBe(true);
  });

  it('does NOT fire on ARG BUILD_DATE', () => {
    expect(fires(r, 'ARG BUILD_DATE')).toBe(false);
  });
});

describe('dockerfile-add-url', () => {
  const r = rule('dockerfile-add-url');

  it('fires on ADD https://...', () => {
    expect(fires(r, 'ADD https://example.com/binary /usr/local/bin/binary')).toBe(true);
  });

  it('does NOT fire on ADD local file', () => {
    expect(fires(r, 'ADD ./app.tar.gz /app')).toBe(false);
  });
});

describe('dockerfile-add-instead-of-copy', () => {
  const r = rule('dockerfile-add-instead-of-copy');

  it('fires on plain ADD ./src /app', () => {
    expect(fires(r, 'ADD ./src /app')).toBe(true);
  });

  it('does NOT fire on ADD of a tarball', () => {
    expect(fires(r, 'ADD release.tar.gz /opt')).toBe(false);
  });

  it('does NOT fire on COPY', () => {
    expect(fires(r, 'COPY ./src /app')).toBe(false);
  });
});

describe('dockerfile-curl-no-verify', () => {
  const r = rule('dockerfile-curl-no-verify');

  it('fires on curl -k', () => {
    expect(fires(r, 'RUN curl -k https://example.com -o /tmp/x')).toBe(true);
  });

  it('fires on wget --no-check-certificate', () => {
    expect(fires(r, 'RUN wget --no-check-certificate https://example.com')).toBe(true);
  });

  it('does NOT fire on curl https://...', () => {
    expect(fires(r, 'RUN curl https://example.com')).toBe(false);
  });
});

describe('dockerfile-apt-get-no-clean', () => {
  const r = rule('dockerfile-apt-get-no-clean');

  it('fires on apt-get install without cleanup', () => {
    expect(fires(r, 'RUN apt-get update && apt-get install -y curl')).toBe(true);
  });

  it('does NOT fire when apt lists are cleaned', () => {
    expect(
      fires(
        r,
        'RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*',
      ),
    ).toBe(false);
  });
});

describe('dockerfile-pip-no-version-pin', () => {
  const r = rule('dockerfile-pip-no-version-pin');

  it('fires on pip install without pin', () => {
    expect(fires(r, 'RUN pip install requests')).toBe(true);
  });

  it('does NOT fire on pip install with ==pin', () => {
    expect(fires(r, 'RUN pip install requests==2.31.0')).toBe(false);
  });

  it('does NOT fire on pip install -r requirements.txt', () => {
    expect(fires(r, 'RUN pip install -r requirements.txt')).toBe(false);
  });
});

describe('dockerfile-no-healthcheck', () => {
  const r = rule('dockerfile-no-healthcheck');

  it('fires when CMD/ENTRYPOINT exists but no HEALTHCHECK', () => {
    const allLines = ['FROM nginx:1.25', 'CMD ["nginx", "-g", "daemon off;"]'];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(true);
  });

  it('does NOT fire when HEALTHCHECK is present', () => {
    const allLines = [
      'FROM nginx:1.25',
      'HEALTHCHECK CMD curl -f http://localhost || exit 1',
      'CMD ["nginx"]',
    ];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(false);
  });

  it('does NOT fire on a builder-only Dockerfile', () => {
    const allLines = ['FROM golang:1.22', 'RUN go build ./...'];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(false);
  });
});

describe('dockerfile-multiple-from-no-name', () => {
  const r = rule('dockerfile-multiple-from-no-name');

  it('fires on multi-stage build without AS names', () => {
    const allLines = ['FROM node:20', 'RUN npm ci', 'FROM nginx:1.25', 'COPY --from=0 /app /usr/share/nginx/html'];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(true);
  });

  it('does NOT fire when every FROM has AS', () => {
    const allLines = ['FROM node:20 AS builder', 'FROM nginx:1.25 AS runtime'];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(false);
  });

  it('does NOT fire on a single-stage build', () => {
    const allLines = ['FROM alpine:3.18'];
    expect(fires(r, allLines[0], { lineNum: 0, allLines })).toBe(false);
  });
});

describe('dockerfile-shell-form-cmd', () => {
  const r = rule('dockerfile-shell-form-cmd');

  it('fires on shell-form CMD', () => {
    expect(fires(r, 'CMD npm start')).toBe(true);
  });

  it('fires on shell-form ENTRYPOINT', () => {
    expect(fires(r, 'ENTRYPOINT /usr/local/bin/app')).toBe(true);
  });

  it('does NOT fire on exec-form CMD', () => {
    expect(fires(r, 'CMD ["npm", "start"]')).toBe(false);
  });

  it('does NOT fire on exec-form ENTRYPOINT', () => {
    expect(fires(r, 'ENTRYPOINT ["/usr/local/bin/app"]')).toBe(false);
  });
});
