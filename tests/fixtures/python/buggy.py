# EXPECTED FINDINGS:
# - line 14: crypto-hardcoded-secret — security — Hardcoded secret literal
# - line 19: injection-sql-f-string — security — cursor.execute with f-string SQL
# - line 22: injection-os-system — security — os.system shell injection
# - line 25: injection-shell-true — security — subprocess.run shell=True
# - line 28: crypto-md5 — security — hashlib.md5 weak hash
# - line 31: crypto-pickle-load — security — pickle.loads on untrusted data
# - line 34: crypto-yaml-load — security — yaml.load without SafeLoader
# - line 37: injection-eval — security — eval on user input
# - line 38: bug-mutable-default-arg — bug — mutable default argument
# - line 44: crypto-weak-random — security — random.random() not cryptographically secure
# - line 47: bug-string-concat-int — bug — implicit string+int concatenation
"""Intentionally buggy Python fixture for DecodeMind scanner tests."""
API_TOKEN = "sk-supersecretvalue1234"

import hashlib, os, pickle, random, subprocess, yaml

def lookup_user(cursor, name):
    cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")

def run_command(filename):
    os.system("cat " + filename)

def run_pipeline(cmd):
    subprocess.run(cmd, shell=True)

def fingerprint(data):
    return hashlib.md5(data).hexdigest()

def load_session(blob):
    return pickle.loads(blob)

def parse_config(text):
    return yaml.load(text)

def calc(expr):
    return eval(expr)
def append_item(item, bucket=[]):
    bucket.append(item)
    return bucket


def token():
    return str(random.random())

def label(prefix):
    return prefix + 5
