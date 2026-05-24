# EXPECTED FINDINGS:
# - line 14: ruby-hardcoded-password — security — Hardcoded password literal
# - line 17: ruby-eval-call — security — eval() on user input
# - line 21: ruby-system-call-shell — security — system() with variable
# - line 25: ruby-rails-find-by-sql-string — security — find_by_sql with concat
# - line 29: ruby-rails-where-sql-concat — security — where with SQL concat
# - line 33: ruby-yaml-load-untrusted — security — YAML.load on untrusted input
# - line 37: ruby-weak-crypto-md5 — security — Digest::MD5.hexdigest
# - line 40: ruby-todo-comment — quality — TODO comment

require 'digest'
require 'yaml'

password = "topsecretpassword"

def calc(expr)
  eval(expr)
end

def run_cmd(cmd)
  system(cmd)
end

def lookup_user(model, name)
  model.find_by_sql("SELECT * FROM users WHERE name = '" + name + "'")
end

def search_user(model, name)
  model.where("name = '" + name + "'")
end

def parse_config(text)
  YAML.load(text)
end

def fingerprint(data)
  Digest::MD5.hexdigest(data)
end

# TODO: rotate credentials and move to secrets manager before release
