/**
 * Dockerfile rules library.
 *
 * Dockerfile has no tree-sitter grammar available, so we use a small regex-based
 * matcher instead. Each rule receives ONE logical Dockerfile line (instructions
 * joined across `\` continuations) plus the index of that line in `allLines`
 * (which is the array of all logical lines in the file). File-level rules
 * inspect `allLines` and only fire on `lineNum === 0` to report once per file.
 */

export interface DockerfileRule {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'security' | 'bug' | 'logic' | 'quality';
  message: string;
  // matcher receives one logical Dockerfile line (instructions joined across `\` continuations)
  // and returns true if the rule fires on that line
  matcher: (line: string, lineNum: number, allLines: string[]) => boolean;
}

// ---------- helpers ----------

/** Strip leading whitespace + optional inline comment. */
function stripComment(line: string): string {
  // Dockerfile only treats `#` at the start of a line (after whitespace) as a comment.
  const trimmed = line.replace(/^\s+/, '');
  if (trimmed.startsWith('#')) return '';
  return trimmed;
}

/** Match the instruction keyword (case-insensitive) at the start of a logical line. */
function instructionIs(line: string, instr: string): boolean {
  const stripped = stripComment(line);
  const re = new RegExp(`^${instr}\\b`, 'i');
  return re.test(stripped);
}

/** Get the arguments part after the instruction keyword. */
function instructionArgs(line: string): string {
  const stripped = stripComment(line);
  const m = stripped.match(/^[A-Z]+\b\s*(.*)$/i);
  return m ? m[1].trim() : '';
}

/** True if any line in the file matches the given instruction. */
function fileHasInstruction(allLines: string[], instr: string): boolean {
  return allLines.some((l) => instructionIs(l, instr));
}

// ---------- rules ----------

export const DOCKERFILE_RULES: DockerfileRule[] = [
  // --- SECURITY ---

  {
    id: 'dockerfile-user-root',
    severity: 'error',
    category: 'security',
    message:
      'Container runs as root — add a non-privileged USER instruction (USER appuser) before CMD/ENTRYPOINT to limit blast radius',
    matcher: (_line, lineNum, allLines) => {
      // file-level: only emit once at first line
      if (lineNum !== 0) return false;
      const userLines = allLines.filter((l) => instructionIs(l, 'USER'));
      if (userLines.length === 0) return true; // no USER at all
      const lastUser = instructionArgs(userLines[userLines.length - 1]);
      // matches `root`, `0`, `root:root`, `0:0` (case insensitive on `root`)
      return /^(root|0)(:.*)?$/i.test(lastUser);
    },
  },

  {
    id: 'dockerfile-image-tag-latest',
    severity: 'warning',
    category: 'security',
    message:
      'FROM uses :latest or no tag — pins to a moving target; builds are non-reproducible and may pull a vulnerable image',
    matcher: (line) => {
      if (!instructionIs(line, 'FROM')) return false;
      const args = instructionArgs(line);
      // image name is the first token (ignore `--platform=`, `AS name`)
      const tokens = args.split(/\s+/).filter((t) => !t.startsWith('--'));
      if (tokens.length === 0) return false;
      const image = tokens[0];
      // ignore `FROM scratch` and stage references like `FROM builder`
      if (image === 'scratch') return false;
      // ignore image referenced by digest
      if (image.includes('@sha256:')) return false;
      // explicit :latest tag
      if (/:latest$/i.test(image)) return true;
      // no tag at all: contains no `:` after the last `/`
      const lastSegment = image.split('/').pop() ?? image;
      return !lastSegment.includes(':');
    },
  },

  {
    id: 'dockerfile-env-secret',
    severity: 'error',
    category: 'security',
    message:
      'Secret baked into image via ENV — anyone with image read access can recover it via `docker inspect`. Use BuildKit secrets or runtime env vars instead',
    matcher: (line) => {
      if (!instructionIs(line, 'ENV')) return false;
      const args = instructionArgs(line);
      return /\b(PASSWORD|PASSWD|API[_-]?KEY|SECRET|TOKEN|ACCESS[_-]?KEY|PRIVATE[_-]?KEY)\b\s*=?\s*["']?[^\s"']+/i.test(
        args,
      );
    },
  },

  {
    id: 'dockerfile-arg-secret',
    severity: 'error',
    category: 'security',
    message:
      'Secret passed via ARG — visible in `docker history` and in image layers. Use `RUN --mount=type=secret` (BuildKit) instead',
    matcher: (line) => {
      if (!instructionIs(line, 'ARG')) return false;
      const args = instructionArgs(line);
      // `\b` treats underscore as a word char, so `\bSECRET\b` does NOT match
      // inside `SECRET_TOKEN`. Use (?:^|[^A-Z0-9])…(?:[^A-Z0-9]|$) anchors so
      // SECRET in SECRET_TOKEN, TOKEN in API_TOKEN, etc. all fire.
      return /(?:^|[^A-Z0-9])(PASSWORD|PASSWD|API[_-]?KEY|SECRET|TOKEN|ACCESS[_-]?KEY|PRIVATE[_-]?KEY)(?:[^A-Z0-9]|$)/i.test(
        args,
      );
    },
  },

  {
    id: 'dockerfile-add-url',
    severity: 'warning',
    category: 'security',
    message:
      'ADD <url> downloads at build time without checksum verification — supply-chain risk. Prefer COPY for local files, or RUN curl with a sha256 check for remote',
    matcher: (line) => {
      if (!instructionIs(line, 'ADD')) return false;
      const args = instructionArgs(line);
      return /\bhttps?:\/\//i.test(args);
    },
  },

  {
    id: 'dockerfile-add-instead-of-copy',
    severity: 'info',
    category: 'security',
    message:
      'ADD has implicit tar-extraction and URL-fetch behavior — prefer COPY for plain file copies to avoid surprises',
    matcher: (line) => {
      if (!instructionIs(line, 'ADD')) return false;
      const args = instructionArgs(line);
      // skip if URL (covered by dockerfile-add-url) or a tarball (genuine ADD use)
      if (/\bhttps?:\/\//i.test(args)) return false;
      if (/\.(tar|tgz|tar\.gz|tar\.bz2|tar\.xz|zip)\b/i.test(args)) return false;
      return true;
    },
  },

  {
    id: 'dockerfile-curl-no-verify',
    severity: 'error',
    category: 'security',
    message:
      'curl/wget with TLS verification disabled — defeats certificate pinning and exposes the build to MITM',
    matcher: (line) => {
      if (!instructionIs(line, 'RUN')) return false;
      const args = instructionArgs(line);
      // curl -k / --insecure, wget --no-check-certificate
      return /\b(curl|wget)\b[^\n]*?(\s-k\b|\s--insecure\b|\s--no-check-certificate\b)/i.test(
        args,
      );
    },
  },

  {
    id: 'dockerfile-apt-get-no-clean',
    severity: 'warning',
    category: 'security',
    message:
      'apt-get install without rm -rf /var/lib/apt/lists/* bloats the image and may leave a stale cache that masks security updates',
    matcher: (line) => {
      if (!instructionIs(line, 'RUN')) return false;
      const args = instructionArgs(line);
      if (!/\bapt-get\s+install\b/i.test(args)) return false;
      return !/rm\s+-rf\s+\/var\/lib\/apt\/lists\/\*/i.test(args);
    },
  },

  {
    id: 'dockerfile-pip-no-version-pin',
    severity: 'warning',
    category: 'security',
    message:
      'pip install without an `==` version pin produces non-reproducible builds and may silently pull a compromised release',
    matcher: (line) => {
      if (!instructionIs(line, 'RUN')) return false;
      const args = instructionArgs(line);
      // look for `pip install` (any form) — skip -r requirements, -e .
      const pipMatch = args.match(/\bpip3?\s+install\s+([^\n;&|]+)/i);
      if (!pipMatch) return false;
      const pkgs = pipMatch[1].trim();
      // skip if using requirements file or editable install
      if (/^-r\b|^--requirement\b|^-e\b|^--editable\b|^\./.test(pkgs)) return false;
      // tokenize, ignore flags
      const tokens = pkgs
        .split(/\s+/)
        .filter((t) => t.length > 0 && !t.startsWith('-'));
      if (tokens.length === 0) return false;
      // fire when at least one package token has no `==`
      return tokens.some((t) => !t.includes('=='));
    },
  },

  {
    id: 'dockerfile-no-healthcheck',
    severity: 'info',
    category: 'security',
    message:
      'No HEALTHCHECK in Dockerfile — orchestrator cannot detect a wedged process, only that the container is still running',
    matcher: (_line, lineNum, allLines) => {
      if (lineNum !== 0) return false;
      // skip files that are clearly multi-stage builder images (no CMD/ENTRYPOINT either)
      const hasRuntime =
        fileHasInstruction(allLines, 'CMD') ||
        fileHasInstruction(allLines, 'ENTRYPOINT');
      if (!hasRuntime) return false;
      return !fileHasInstruction(allLines, 'HEALTHCHECK');
    },
  },

  // --- QUALITY ---

  {
    id: 'dockerfile-multiple-from-no-name',
    severity: 'info',
    category: 'quality',
    message:
      'Multi-stage build without `AS <name>` — later stages cannot reference earlier ones by name and the file is harder to read',
    matcher: (_line, lineNum, allLines) => {
      if (lineNum !== 0) return false;
      const fromLines = allLines.filter((l) => instructionIs(l, 'FROM'));
      if (fromLines.length < 2) return false;
      // fire only if at least one FROM is missing `AS <name>`
      return fromLines.some((l) => !/\bAS\s+\w+/i.test(l));
    },
  },

  {
    id: 'dockerfile-shell-form-cmd',
    severity: 'info',
    category: 'quality',
    message:
      'CMD/ENTRYPOINT in shell form runs the command through `/bin/sh -c`, which does not forward signals — use JSON exec form ["cmd","arg"] instead',
    matcher: (line) => {
      const isCmd = instructionIs(line, 'CMD');
      const isEntry = instructionIs(line, 'ENTRYPOINT');
      if (!isCmd && !isEntry) return false;
      const args = instructionArgs(line);
      if (args.length === 0) return false;
      // exec form starts with `[`
      return !args.trimStart().startsWith('[');
    },
  },
];
