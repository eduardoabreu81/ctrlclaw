# Staging Deploy - Commit 2426a3c

> **Commit:** `2426a3c`  
> **Date:** 2026-04-08  
> **Status:** Ready for Staging Deploy

---

## 1. Pre-Deploy Checklist

```bash
# 1. Verify commit is on main
git log --oneline -5
# Should show: 2426a3c feat(p4.2): implement websocket protection...

# 2. Push to remote (if not already)
git push origin main

# 3. Verify environment
cat .env.local
# Required: NEXT_PUBLIC_DEPLOYMENT_SCENARIO=staging (or vps)
```

---

## 2. Deploy Sequence

### Step 1: Install Dependencies
```bash
cd ~/ctrlclaw
npm install
```

### Step 2: Build Application
```bash
npm run build
# Verify no TypeScript errors
```

### Step 3: Deploy WebSocket Server (PM2)

```bash
# Install PM2 globally (if not present)
sudo npm install -g pm2

# Start WS Server with PM2
pm2 start scripts/start-ws-server.js \
  --name "ctrlclaw-ws" \
  --restart-delay 3000 \
  --max-restarts 5

# Save PM2 config
pm2 save
pm2 startup systemd
```

**PM2 Commands:**
```bash
pm2 status              # Check status
pm2 logs ctrlclaw-ws    # View logs
pm2 restart ctrlclaw-ws # Restart
pm2 stop ctrlclaw-ws    # Stop
```

### Step 4: Deploy Next.js Application (PM2)

```bash
pm2 start npm \
  --name "ctrlclaw-app" \
  -- start \
  --restart-delay 3000 \
  --max-restarts 5

pm2 save
```

### Alternative: Docker Compose

If using Docker:
```yaml
# docker-compose.staging.yml
version: '3.8'
services:
  ws-server:
    build: .
    command: node scripts/start-ws-server.js
    ports:
      - "3002:3002"
    restart: unless-stopped
    
  app:
    build: .
    command: npm start
    ports:
      - "3000:3000"
    restart: unless-stopped
    depends_on:
      - ws-server
```

```bash
docker-compose -f docker-compose.staging.yml up -d
```

---

## 3. Post-Deploy Smoke Test

### Quick Smoke (2 minutes)
```bash
# Test 1: HTTP Health
curl -f http://localhost:3000/api/health || echo "FAIL: HTTP health"

# Test 2: WS Server
cd ~/ctrlclaw && node scripts/test-ws-rate-limit.js
# Expected: 10 accepted, 5 blocked

# Test 3: PM2 Status
pm2 status
# Both services should show "online"
```

### Full Smoke (5 minutes)
```bash
cd ~/ctrlclaw/load-testing/k6

# HTTP Tests
k6 run --duration 30s scripts/01-http-baseline.js
k6 run --duration 30s scripts/02-http-ratelimit-pressure.js

# WS Test
k6 run --env WS_URL=ws://localhost:3002 --duration 30s scripts/03-ws-baseline.js
```

---

## 4. Smoke Checklist

| Test | Command | Expected | Status |
|------|---------|----------|--------|
| HTTP Health | `curl /api/health` | 200 OK | ⬜ |
| WS Rate Limit | `test-ws-rate-limit.js` | 10 acc, 5 blocked | ⬜ |
| PM2 Status | `pm2 status` | 2 processes online | ⬜ |
| HTTP Baseline | `01-http-baseline.js` | p95 < 500ms | ⬜ |
| HTTP Rate Limit | `02-http-ratelimit-pressure.js` | 429s present | ⬜ |
| WS Baseline | `03-ws-baseline.js` | >80% success | ⬜ |

**All tests must pass for staging to be considered healthy.**

---

## 5. Rollback Plan

### Rollback Trigger Criteria
- HTTP health check fails
- WS server not responding
- Error rate > 1%
- Manual decision

### Rollback Steps

```bash
# 1. Stop current services
pm2 stop ctrlclaw-ws ctrlclaw-app

# 2. Revert to pre-P4.2 commit
git revert --no-commit 2426a3c
# Or: git reset --hard <commit-before-2426a3c>

# 3. Rebuild
npm run build

# 4. Restart without WS protection
pm2 start npm --name "ctrlclaw-app" -- start

# 5. Verify rollback
curl http://localhost:3000/api/health
```

### Rollback Point
**Safe commit:** `2426a3c^` (parent of P4.2)
**Effect:** WS protection disabled, HTTP layer functional

---

## 6. Sign-off

| Step | Verified | By | Time |
|------|----------|-----|------|
| Deploy completed | ⬜ | | |
| Smoke tests passed | ⬜ | | |
| Monitoring active | ⬜ | | |
| Rollback tested | ⬜ | | |

---

**Staging Deploy Ready**
