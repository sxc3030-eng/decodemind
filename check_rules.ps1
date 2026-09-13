$candidates = @(
  "src\lib\rules\definitions\java\java-sqli-statement-concat.yml",
  "src\lib\rules\definitions\java\java-sqli-prepared-concat.yml",
  "src\lib\rules\definitions\java\java-spring-permitall.yml",
  "src\lib\rules\definitions\java\java-printstacktrace-prod.yml",
  "src\lib\rules\definitions\java\java-null-comparison-equals.yml",
  "src\lib\rules\definitions\java\java-jndi-lookup-user-input.yml",
  "src\lib\rules\definitions\java\java-deserialization-readobject.yml",
  "src\lib\rules\definitions\java\java-hardcoded-password.yml",
  "src\lib\rules\definitions\csharp\csharp-xpath-injection.yml",
  "src\lib\rules\definitions\csharp\csharp-deserialize-binaryformatter.yml",
  "src\lib\rules\definitions\csharp\csharp-hardcoded-password.yml",
  "src\lib\rules\definitions\go\go-sql-query-concat.yml",
  "src\lib\rules\definitions\go\go-sql-exec-concat.yml",
  "src\lib\rules\definitions\go\go-defer-unlock-without-lock.yml",
  "src\lib\rules\definitions\go\go-http-redirect-user-input.yml",
  "src\lib\rules\definitions\go\go-http-handlefunc-no-auth.yml",
  "src\lib\rules\definitions\go\go-hardcoded-password.yml",
  "src\lib\rules\definitions\go\go-exec-command-user-input.yml",
  "src\lib\rules\definitions\ruby\ruby-rails-where-sql-concat.yml",
  "src\lib\rules\definitions\ruby\ruby-rails-find-by-sql-string.yml",
  "src\lib\rules\definitions\ruby\ruby-mass-assignment-attributes.yml",
  "src\lib\rules\definitions\ruby\ruby-system-call-shell.yml",
  "src\lib\rules\definitions\ruby\ruby-hardcoded-password.yml",
  "src\lib\rules\definitions\kotlin\kotlin-webview-universal-access.yml",
  "src\lib\rules\definitions\kotlin\kotlin-webview-js-enabled.yml",
  "src\lib\rules\definitions\kotlin\kotlin-webview-file-access.yml",
  "src\lib\rules\definitions\kotlin\kotlin-shared-prefs-plaintext-token.yml",
  "src\lib\rules\definitions\kotlin\kotlin-shared-prefs-plaintext-password.yml",
  "src\lib\rules\definitions\kotlin\kotlin-shared-prefs-mode-world.yml",
  "src\lib\rules\definitions\kotlin\kotlin-shared-prefs-mode-world-writable.yml",
  "src\lib\rules\definitions\kotlin\kotlin-intent-getextra-no-check.yml",
  "src\lib\rules\definitions\swift\swift-webview-load-untrusted-html.yml",
  "src\lib\rules\definitions\swift\swift-webview-js-enabled.yml",
  "src\lib\rules\definitions\swift\swift-runtime-shell-exec.yml",
  "src\lib\rules\definitions\swift\swift-userdefaults-secret.yml",
  "src\lib\rules\definitions\swift\swift-http-cleartext-url.yml",
  "src\lib\rules\definitions\swift\swift-hardcoded-api-key.yml",
  "src\lib\rules\definitions\dart\dart-shared-prefs-secret.yml",
  "src\lib\rules\definitions\dart\dart-http-badcert-allow.yml",
  "src\lib\rules\definitions\dart\dart-flutter-secure-storage-missing.yml",
  "src\lib\rules\definitions\dart\dart-throw-error-no-stack.yml",
  "src\lib\rules\definitions\dart\dart-runtime-process-run.yml",
  "src\lib\rules\definitions\dart\dart-hardcoded-api-key.yml",
  "src\lib\rules\definitions\php\php-include-variable.yml",
  "src\lib\rules\definitions\php\php-include-once-variable.yml",
  "src\lib\rules\definitions\php\php-hardcoded-password.yml",
  "src\lib\rules\definitions\php\php-file-get-contents-url.yml",
  "src\lib\rules\definitions\php\php-echo-interp-superglobal.yml",
  "src\lib\rules\definitions\bash\bash-wget-no-https.yml",
  "src\lib\rules\definitions\bash\bash-unquoted-var-rm.yml",
  "src\lib\rules\definitions\bash\bash-test-string-no-quotes.yml",
  "src\lib\rules\definitions\bash\bash-hardcoded-password.yml"
)

foreach ($r in $candidates) {
  $out = & npx ast-grep scan --rule $r tests\fixtures\python\buggy.py 2>&1 | Out-String
  if ($out -match "Multiple AST nodes are detected|Undefined meta var") {
    Write-Host "BROKEN: $r"
    Write-Host ("  " + ($out -split "`n" | Where-Object { $_ -match "Multiple AST|Undefined meta" } | Select-Object -First 1).Trim())
  } else {
    Write-Host "OK: $r"
  }
}
