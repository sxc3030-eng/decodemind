<?php
// EXPECTED FINDINGS:
// - line 14: php-hardcoded-password — security — Hardcoded password literal
// - line 17: php-eval-call — security — eval() on user input
// - line 20: php-system-call — security — system() call
// - line 23: php-mysqli-query-concat — security — mysqli query with concat
// - line 26: php-weak-hash-md5 — security — md5() weak hash
// - line 29: php-curl-ssl-verify-false — security — CURLOPT_SSL_VERIFYPEER false
// - line 32: php-unserialize-call — security — unserialize() on untrusted data
// - line 35: php-echo-superglobal-xss — security — echo $_GET superglobal
// - line 38: php-var-dump-prod — quality — var_dump() left in code
// - line 41: php-todo-comment — quality — TODO comment

$password = "topsecretpassword";

function calc($expr) {
    return eval($expr);
}
function runCmd($cmd) {
    return system($cmd);
}
function lookupUser($conn, $name) {
    return mysqli_query($conn, "SELECT * FROM users WHERE name = '" . $name . "'");
}
function fingerprint($data) {
    return md5($data);
}
function disableTls($ch) {
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
}
function loadSession($blob) {
    return unserialize($blob);
}
function showUser($key) {
    echo $_GET[$key];
}
function inspect($value) {
    var_dump($value);
}

// TODO: rotate the credentials before release
