# =============================================================================
# DecodeMind — DEMO BUGGY FILE (Python)
# =============================================================================
# Drop this file (or its parent folder) into https://decodemind.dev to see
# what DecodeMind catches. Below is the expected report.
#
# EXPECTED FINDINGS — what DecodeMind should detect:
#
# SECURITY (10)
#   line 22  crypto-hardcoded-secret      API key in source code
#   line 27  injection-sql-f-string       f-string SQL via cursor.execute
#   line 31  injection-sql-f-string       f-string SQL via assignment to `query`
#   line 36  network-localhost-url        localhost URL hardcoded in production code
#   line 41  injection-os-system          os.system shell injection
#   line 46  injection-shell-true         subprocess.run with shell=True
#   line 51  crypto-md5                   weak hash algorithm
#   line 56  crypto-sha1                  weak hash algorithm
#   line 61  crypto-pickle-load           pickle.loads on untrusted data
#   line 66  crypto-yaml-load             yaml.load without SafeLoader
#
# BUGS (3)
#   line 71  injection-eval               eval on user input
#   line 76  bug-mutable-default-arg      mutable default argument
#   line 82  bug-string-concat-int        implicit string + int concatenation
#
# QUALITY (1)
#   line 86  crypto-weak-random           random.random() not cryptographically secure
#
# Total: 14 findings — and Ruff may add more on top (F-codes, W-codes, S-codes
# from its bandit-equivalent ruleset).
# =============================================================================

import hashlib
import os
import pickle
import random
import subprocess
import requests
import yaml

API_KEY = "sk-supersecretvalue1234567890abcdef"

def lookup_user(cursor, name):
    # line 27 — direct f-string in cursor.execute
    cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")

def build_query(user_id):
    # line 31 — f-string assigned to a variable, then probably executed elsewhere
    query = f"SELECT * FROM accounts WHERE id = {user_id}"
    return query

def fetch_internal():
    # line 36 — hardcoded localhost URL
    return requests.get("http://localhost:9999/api/internal")

def run_command(filename):
    # line 41 — os.system shell injection
    os.system("cat " + filename)

def run_pipeline(cmd):
    # line 46 — subprocess with shell=True
    subprocess.run(cmd, shell=True)

def fingerprint(data):
    # line 51 — weak hash MD5
    return hashlib.md5(data).hexdigest()

def legacy_signature(payload):
    # line 56 — weak hash SHA1
    return hashlib.sha1(payload).hexdigest()

def load_session(blob):
    # line 61 — pickle deserialization on untrusted input
    return pickle.loads(blob)

def parse_config(text):
    # line 66 — yaml.load without SafeLoader (= RCE)
    return yaml.load(text)

def calc(expr):
    # line 71 — eval on user input (RCE)
    return eval(expr)

def append_item(item, bucket=[]):
    # line 76 — mutable default argument (classic Python footgun)
    bucket.append(item)
    return bucket


def label(prefix):
    # line 82 — implicit string + int concatenation (TypeError at runtime)
    return prefix + 5


def session_token():
    # line 86 — random.random() not cryptographically secure
    return str(random.random())
