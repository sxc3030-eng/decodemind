# Post-launch checklist

DecodeMind is live at **https://decodemind.dev**. Everything below is something I (the human) need to do myself — agents cannot do these because they need passwords, dashboard logins, or browser actions.

Pick a row, do it, check the box.

---

## 🔴 Today, urgent (under 30 min total)

### [ ] 1. Push rotated secrets to the i5 production server

The local `.env` files have new values. The i5 still has the OLD values. Until pushed, GeniA prod is using outdated secrets that don't match.

```powershell
cd D:\GeniA
pip install paramiko  # one-time
python scripts/rotation/transfer_rotation.py <i5-host> --dry-run    # preview
python scripts/rotation/transfer_rotation.py <i5-host>              # actual push, prompts for SSH password
```

Replace `<i5-host>` with the actual hostname or IP of your i5 server.

The script:
- Reads new values from local `apps/api/.env`, `apps/web/.env.local`, `apps/node-python/.env`
- SSH to i5 as user `optimus` (prompts for password)
- Backs up remote `.env` files to `/srv/omnipost/.env-backups/<timestamp>/`
- Writes new values
- Runs `ALTER USER genia WITH PASSWORD '<new>'` in Postgres
- Restarts services: `genia-api`, `genia-web`, `genia-node-python`, `genia-media`, `omnipost`

After it finishes: test the GeniA web app, the mobile app, and a media upload. If anything is broken, the backup is at `/srv/omnipost/.env-backups/<last-timestamp>/` on the i5 — restore the relevant file and `systemctl restart` the service.

### [ ] 2. Rotate the third-party API keys

Not in git history but still on disk + on the i5. Quick revoke-and-replace on each provider's dashboard:

| Service | URL | What to do |
|---|---|---|
| Anthropic | https://console.anthropic.com/settings/keys | Revoke `sk-ant-api03-965gv...`, create new, paste into `D:\GeniA\apps\web\.env.local` |
| Groq | https://console.groq.com/keys | Same — revoke `gsk_CFNfr7Sk...`, create new |
| Hugging Face | https://huggingface.co/settings/tokens | Revoke `hf_drRww...`, create new |
| Gmail | https://myaccount.google.com/apppasswords | Revoke the existing app password, generate new, paste in `D:\GeniA\apps\node-python\.env` as `GMAIL_APP_PASSWORD` |
| PayPal | https://developer.paypal.com/dashboard | Sandbox only — low priority but worth doing |
| Spotify | https://developer.spotify.com/dashboard | Reset client secret, update `SPOTIFY_CLIENT_SECRET` in `D:\GeniA\apps\web\.env.local` |

After updating each, re-run `python scripts/rotation/transfer_rotation.py <i5-host>` from Step 1 if you want the i5 to pick up the new third-party keys too (it pushes only the rotation set, but a follow-up sync would handle these).

OR: SSH to i5 yourself and edit the relevant `.env` files manually for these specific keys.

---

## 🟡 This week (announcing + final polish)

### [ ] 3. Test the live site

Open https://decodemind.dev in Chrome:
1. Click "Pick a folder…", select a small folder (e.g., `D:\decodemind\src\spike`)
2. Verify the scan runs and findings appear
3. On a Ruff F401 finding (unused import), click "Apply fix"
4. Open the file in a text editor — verify the import was removed
5. Verify `.decodemind-backup/<timestamp>-...` exists in the project

If anything fails: open DevTools Console (F12), look for `[DecodeMind/...]` log entries, share with me.

### [ ] 4. Publish the blog post

Source: `D:\decodemind\docs\BLOG_POST_DRAFT.md`

Recommended order (highest signal-to-noise first):
1. **Hacker News "Show HN"** — copy the body from `D:\decodemind\docs\ANNOUNCEMENT_COPY.md` section 3. Post: https://news.ycombinator.com/submit
2. **dev.to** — paste the full blog post. https://dev.to/new — tags: `webassembly`, `security`, `tooling`, `opensource`, `webdev`
3. **LinkedIn** — copy the post from ANNOUNCEMENT_COPY section 2, add a screenshot of the sectioned report.
4. **Twitter/X** — copy the 4-tweet thread from ANNOUNCEMENT_COPY section 1.
5. (Optional) **Email to 2-3 friends** — copy the casual FR or EN version from ANNOUNCEMENT_COPY section 5.

### [ ] 5. Watch for and respond to first-week feedback

The first 50 users are the most valuable. Watch:
- GitHub issues: https://github.com/sxc3030-eng/decodemind/issues
- Hacker News comments on your post
- Cloudflare Pages analytics: https://dash.cloudflare.com → Pages → decodemind → Analytics

Most common failure modes to expect:
- "WebGPU not available" on Firefox or old Chrome
- "Folder picker not supported" on Firefox/Safari → suggest Chrome/Edge
- "Out of memory" on the 7B tier → suggest 1.5B
- False positives on vendored code → suggest `.decodemind-ignore`

---

## 🟢 Whenever you want

### [ ] 6. Scrub git history of old secret values (DESTRUCTIVE)

The OLD secret values are still findable via `git log -S "old-value"` in the GeniA repo. They're rotated so they're invalid, but if you want to remove them from history:

See `D:\GeniA\docs\SECURITY_ROTATION_2026-05-19.md` step 4. Requires BFG + force-push.

⚠️ Force-push breaks any other clones of the GeniA repo. Solo dev only.

### [ ] 7. Update memory

Read `C:\Users\sxc_2\.claude\projects\D--\memory\project_decodemind.md` and add a final "Launched" section noting:
- Date of launch
- Live URL
- Initial feedback signal (number of HN upvotes, dev.to reads, GitHub stars)

This helps any future Claude session pick up the post-launch context.

### [ ] 8. Track DecodeMind usage

Optional but useful for CV value: add a simple counter that reports anonymous scan counts (no user code, no PII — just an HTTP POST with `scans_per_session` and the model tier chosen). Cloudflare Workers can host this for free.

If you do this:
- Endpoint: `https://decodemind.dev/api/usage`
- POST body: `{"event": "scan_complete", "tier": "quick", "duration_ms": 2300}`
- Storage: Cloudflare KV (free 100k writes/day)
- Privacy disclosure: add a line to USAGE.md saying "We count scans, not code."

### [ ] 9. Decide on V2 priorities

The V2 backlog from `docs/superpowers/specs/2026-05-18-decodemind-design.md`:
- L3 LLM-generated fixes
- "Second opinion" via user's API key
- Inline Monaco patch editor
- More languages (Go, Rust, Java, C#, PHP)
- VS Code / JetBrains extensions
- GitHub Action
- Fine-tuned custom model
- Team mode
- Full SARIF 2.1.0

Pick 1-3 based on user feedback. Don't try to ship them all.

---

## ⚪ "Done done" — DecodeMind is shipped

You can mark this task as done when:
- [ ] All 🔴 tasks above are checked
- [ ] You have at least 1 unsolicited "I tried it on my code and it caught X" message from a stranger
- [ ] The GitHub repo has ≥ 10 stars
- [ ] Cloudflare Pages analytics show ≥ 100 unique visitors in a week

At that point, DecodeMind is officially a real shipped product, not just code.

---

## What this checklist explicitly does NOT include

- Building V2 features → start a new session when you're ready
- Marketing beyond the initial 4-platform launch → save for V2
- Internationalization beyond EN+FR → V2
- Mobile app → out of scope per spec
