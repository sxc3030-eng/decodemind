// EXPECTED FINDINGS:
// - line 22: go-hardcoded-password — security — Hardcoded password literal
// - line 25: go-sql-query-concat — security — db.Query with string concat
// - line 29: go-exec-command-user-input — security — exec.Command with variable
// - line 33: go-tls-insecureskipverify — security — InsecureSkipVerify: true
// - line 37: go-weak-crypto-md5 — security — md5.New() weak hash
// - line 43: go-weak-random — security — math/rand not cryptographically secure
// - line 47: go-fmt-println-prod — bug — fmt.Println in production code
// - line 50: go-todo-comment — quality — TODO comment

package main

import (
	"crypto/md5"
	"crypto/tls"
	"database/sql"
	"fmt"
	"math/rand"
	"os/exec"
)

var password = "topsecretpassword"

func lookupUser(db *sql.DB, name string) (*sql.Rows, error) {
	return db.Query("SELECT * FROM users WHERE name = '" + name + "'")
}

func runCmd(cmd string, args ...string) error {
	return exec.Command(cmd, args...).Run()
}

func newTlsConfig() *tls.Config {
	return &tls.Config{InsecureSkipVerify: true}
}

func fingerprint(data []byte) []byte {
	h := md5.New()
	h.Write(data)
	return h.Sum(nil)
}

func randomDigit() int {
	return rand.Intn(10)
}

func debugTrace(message string) {
	fmt.Println("trace:", message)
}

// TODO: replace hardcoded credentials with vault lookup before shipping
func main() {}
