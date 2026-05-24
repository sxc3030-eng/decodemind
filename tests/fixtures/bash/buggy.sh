#!/usr/bin/env bash
# EXPECTED FINDINGS:
# - line 13: bash-hardcoded-password — security — Hardcoded password literal
# - line 16: bash-eval-call — security — eval $X shell injection
# - line 20: bash-curl-pipe-bash — security — curl | bash supply-chain RCE
# - line 24: bash-wget-no-https — security — wget over plain http://
# - line 28: bash-chmod-777 — security — chmod 777 world-writable
# - line 32: bash-sudo-no-password — security — sudo -n passwordless
# - line 36: bash-unquoted-var-rm — bug — rm -rf with unquoted variable
# - line 40: bash-test-string-no-quotes — bug — [ $X = $Y ] without quotes
# - line 43: bash-todo-comment — quality — TODO comment

password="topsecretpassword"

run_user_code() {
  eval $1
}

bootstrap() {
  curl https://example.com/install.sh | bash
}

fetch_resource() {
  wget http://example.com/data.tar.gz
}

relax_perms() {
  chmod 777 /var/www/html
}

drop_priv() {
  sudo -n /usr/local/bin/restart-service
}

cleanup() {
  rm -rf $TARGET
}

compare() {
  [ $A = $B ] && echo "match"
}

# TODO: rotate credentials before shipping
echo "ready"
