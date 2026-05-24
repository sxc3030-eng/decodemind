import requests

def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return query

API_KEY = "sk-1234567890abcdef"

def render():
    print(undefined_variable)

def fetch():
    return requests.get("http://localhost:9999/nonexistent")

import os
def run(cmd):
    os.system(cmd)

import hashlib
def hash_pw(pw):
    return hashlib.md5(pw.encode()).hexdigest()
