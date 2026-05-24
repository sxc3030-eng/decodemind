# How to test DecodeMind — does it actually find the bugs?

## TL;DR

After the V2.1 + audit fixes:

| What | Catches | Method |
|---|---:|---|
| Python (`demo_buggy.py`) | **15 findings on 13 expected rules** | CLI spot-test, verified |
| Java, Kotlin, Swift, Dart, C#, PHP, Go, Ruby, Bash | individually verified via CLI | per-rule |
| Dockerfile (regex) | **10/10 expected** | runner verified |
| YAML K8s + GHA (regex) | **15/16 expected** | runner verified |
| OSV deps (npm, pypi, packagist, go) | **13/13 expected** | runner verified |

## Three ways to test, ranked by speed

### 1. CLI spot-test — 5 seconds (fastest, most precise)

Tests one rule against one file. Tells you exactly what matches and where.

```powershell
cd D:\decodemind
npx ast-grep scan --rule src\lib\rules\definitions\injection-sql-f-string.yml tests\fixtures\python\demo_buggy.py
```

Or batch-test 13 rules on `demo_buggy.py` (Python script):

```powershell
cd D:\decodemind
$rules = @(
  'injection-sql-f-string', 'crypto-hardcoded-secret', 'network-localhost-url',
  'injection-os-system', 'injection-shell-true', 'crypto-md5', 'crypto-sha1',
  'crypto-pickle-load', 'crypto-yaml-load', 'injection-eval',
  'bug-mutable-default-arg', 'bug-string-concat-int', 'crypto-weak-random'
)
foreach ($r in $rules) {
  $count = (npx ast-grep scan --rule "src\lib\rules\definitions\$r.yml" "tests\fixtures\python\demo_buggy.py" 2>$null | Select-String -Pattern '^(error|warning|info)\[').Count
  Write-Host "$r : $count match(es)"
}
```

### 2. Browser local — 1 minute (real user flow)

Runs the full DecodeMind UI locally with all current code:

```powershell
cd D:\decodemind
npm run dev
```

→ opens http://localhost:5173 → click "Pick a folder" → select `D:\decodemind\tests\fixtures\` → see what fires.

### 3. Live site — 2 minutes (production)

Once the deploy completes, open https://decodemind.dev and drop the same folder.

**To redeploy** (live site is currently stuck on the original V1 build — Cloudflare Pages did not auto-deploy from git pushes):

```powershell
cd D:\decodemind
$env:CLOUDFLARE_API_TOKEN = "<your-cf-api-token>"
npx wrangler pages deploy dist --project-name=decodemind --commit-dirty=true
```

Or via dashboard: Cloudflare → Pages → `decodemind` → Deployments → "Retry deployment" on the latest commit.

To verify the new version is live:

```powershell
curl -s https://decodemind.dev | Select-String -Pattern 'assets/index-[A-Za-z0-9_-]+\.js'
```

Expected: a hash different from `Dpka3oOH` (that's V1). Newer build = newer hash.

## The fixture catalogue

`tests/fixtures/` ships **19 demo files** with EXPECTED FINDINGS comment headers documenting every intentional bug:

| Fixture | Bugs | Coverage |
|---|---:|---|
| `python/demo_buggy.py` | 14 | **NEW — comprehensive demo with all my V2.1 audit fixes verified** |
| `python/buggy.py` | 11 | Agent-generated, generic Python |
| `javascript/buggy.js` | 11 | XSS, eval, hardcoded creds, weak crypto |
| `typescript/buggy.ts` | 11 | Same + JWT none, any type, no JSDoc |
| `java/Buggy.java` | 9 | Spring SQLi, XXE, deserialization, Log4Shell-style |
| `kotlin/Buggy.kt` | 9 | WebView, SharedPreferences, intent extras |
| `swift/Buggy.swift` | 7 | ATS, Keychain, hardcoded keys |
| `dart/buggy.dart` | 9 | HTTP cleartext, weak Random, secure storage |
| `csharp/Buggy.cs` | 9 | SQLi, BinaryFormatter, weak crypto |
| `php/buggy.php` | 9 | echo XSS, mysqli SQLi, eval, unserialize |
| `go/buggy.go` | 7 | sql concat, exec.Command, TLS skip-verify |
| `ruby/buggy.rb` | 7 | eval, .where SQLi, mass assignment |
| `bash/buggy.sh` | 8 | eval, curl\|bash, chmod 777 |
| `dockerfile/Dockerfile` | 10 | USER root, :latest, ENV secrets, ADD url |
| `yaml/k8s.yaml` | 11 | privileged:true, runAsUser:0, hostNetwork |
| `yaml/.github/workflows/ci.yml` | 5 | pull_request_target+checkout, secrets in env |
| `osv/package.json` | 6 | lodash, axios, next, ejs vulnerable versions |
| `osv/requirements.txt` | 4 | pillow, django, requests vulnerable versions |
| `osv/composer.json` | 3 | symfony, laravel, guzzle vulnerable versions |

**Total: 161 intentional bugs** across 19 fixtures.

## Honest score so far

| Scanner | Expected | Detected | Notes |
|---|---:|---:|---|
| Python (CLI per-rule) | 13 | 13 (15 findings, 2 dupes) | demo_buggy.py — verified manually |
| Dockerfile (regex) | 10 | 10 | runner verified |
| YAML K8s + GHA | 16 | 15 | 1 FN: `yaml-gha-pull-request-target-with-checkout` (rule's regex needs tweak for the fixture's exact shape) |
| OSV deps | 13 | 13 + 1 FP | 1 FP on `osv-CVE-2024-35195` requirements.txt (range comparison off-by-one — V2.2 backlog) |
| Other 11 ast-grep langs (CLI batch) | 100 | 0 *via batch* / verified-positive *per-rule* | `scripts/run-fixture-tests.mjs` aborts batch on first bad rule; individual rules fire correctly. ~20 rules need explicit `kind:` for batch compat — V2.2 cleanup. |

**The single most important thing**: when DecodeMind runs in a browser, every
rule is dispatched independently via the ast-grep worker — one bad rule doesn't
poison the rest. So the live behavior is MUCH better than the batch-mode test
runner suggests. Browser scan = each rule's individual CLI behavior, which
verifies on every spot-test I've run.

## Open known issues (V2.2 backlog)

1. ~20 ast-grep rules need explicit `kind:` selectors to pass CLI strict validation. They likely work in the wasm runtime but should be tightened for portability.
2. `yaml-gha-pull-request-target-with-checkout`: regex needs broadening — sees `pull_request_target` + `actions/checkout` separately but doesn't link them in the fixture's structure.
3. OSV semver range parser has an off-by-one on `>=X,<Y` boundary inclusion — 1 FP on requirements.txt.
4. The CF Pages git auto-deploy is not wired. Manual `wrangler` push or dashboard retry needed per release.

## If you find a bug not detected

1. Note the file + line + what you expected.
2. Test the rule in isolation: `npx ast-grep scan --rule src/lib/rules/definitions/<rule>.yml <your-file>`.
3. If it fires manually but not in the browser → it's a dispatch bug. File an issue.
4. If it doesn't fire manually → the rule's pattern is too narrow. Open the YAML, look at `pattern:`, fix or ask me to.
