# Staging Deploy Summary - P4.2

> **Commit:** `2426a3c`  
> **Date:** 2026-04-08  
> **Status:** Ready for Deploy

---

## Deploy Sequence

```bash
# 1. Push commit
git push origin main

# 2. Install & Build
cd ~/ctrlclaw
npm install
npm run build

# 3. Deploy WS Server (PM2 recommended)
pm2 start scripts/start-ws-server.js --name "ctrlclaw-ws"
pm2 save

# 4. Deploy Next.js App
pm2 start npm --name "ctrlclaw-app" -- start
pm2 save

# 5. Verify
pm2 status
```

---

## Recommended: PM2 for Process Management

**Why PM2:**
- Auto-restart on crash
- Built-in logging (`pm2 logs`)
- Cluster mode support
- Systemd integration (`pm2 startup`)

**Alternative:** Docker Compose if containerization preferred.

---

## Smoke Checklist (Post-Deploy)

```bash
# Quick (2 min)
curl http://localhost:3000/api/health          # 200 OK
node scripts/test-ws-rate-limit.js             # 10 acc, 5 blocked
pm2 status                                     # 2 online

# Full (5 min)
cd load-testing/k6
k6 run --duration 30s scripts/01-http-baseline.js
k6 run --duration 30s scripts/02-http-ratelimit-pressure.js
k6 run --env WS_URL=ws://localhost:3002 --duration 30s scripts/03-ws-baseline.js
```

---

## Rollback Criteria

- HTTP health fails
- WS server not responding
- Error rate > 1%

**Rollback Point:** `2426a3c^` (parent commit)
**Command:** `git revert 2426a3c`

---

## Full Documentation

See `docs/STAGING-DEPLOY-2426a3c.md` for complete procedures.
