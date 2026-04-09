# Getting Started with CtrlClaw

## What is CtrlClaw?

CtrlClaw is a web interface for the Claw ecosystem. It makes agent interaction feel like a modern chat application.

## Environment Requirements

| Environment | Support Level | Use Case |
|-------------|---------------|----------|
| **Linux** | ✅ Reference | Staging and production deployment |
| **WSL** | ✅ Supported | Local development and validation |
| **Windows Native** | ⚠️ Convenience only | Local convenience, not for staging validation |

**For staging and production:** Use Linux (Ubuntu recommended).

**For local development:** Use WSL2 on Windows or native Linux/macOS.

## Prerequisites

Before you start, make sure you have:
- Node.js installed (v18 or higher recommended)
- WSL2 (if on Windows) or native Linux/macOS
- Project dependencies installed (`npm install`)
- Working Claw-compatible backend or agent environment
- Required environment variables configured
- WebSocket server ready to run

## Quickest Way to Try CtrlClaw

**Note:** CtrlClaw currently requires manual setup steps. A guided installation or one-command bootstrap flow is not yet available.

### Option 1: Bootstrap Script (Linux/macOS/WSL)

```bash
./scripts/bootstrap-local.sh
```

### Option 2: Manual Setup

If you prefer manual control:

```bash
# 1. Install dependencies
npm install

# 2. Start WebSocket server
node scripts/start-ws-server.js

# 3. Start web app (in another terminal)
npm start

# 4. Open browser at http://localhost:3000
```

**Windows users:** Use WSL2 for the commands above, or run them in Windows Terminal with Node.js installed (convenience only, not for staging validation).

## Quick Validation Checklist

After starting the services, verify:

- [ ] Health endpoint returns OK (`curl http://localhost:3000/api/health`)
- [ ] WebSocket server accepts connections (check browser console)
- [ ] Can create a conversation and send a message
- [ ] Login works (if authentication is configured)

## Security Notice

**Important:** Default credentials, when present in local setup examples, are for controlled development use only.

- Change the password immediately after the first login
- Never keep default credentials in staging, shared, or public environments
- Use strong authentication for any exposed deployment

**Security follow-up:** The system does not currently enforce password change on first login for bootstrap accounts. You must change default credentials manually.

## Common Beginner Mistakes

| Issue | Cause | Solution |
|-------|-------|----------|
| App opens but shows "Connecting..." | WebSocket server not running | Start with `node scripts/start-ws-server.js` |
| Cannot send messages | Backend not configured | Check `NANOCLAW_URL` environment variable |
| Login fails | Wrong credentials or misconfigured auth | Verify environment variables and try again |

## Next Steps

Once running, check out:
- [Using CtrlClaw](USING-CTRLCLAW.md) - How to use the interface
- [Connecting to Claw](CONNECTING-TO-CLAW.md) - Architecture explanation
- [Troubleshooting](TROUBLESHOOTING.md) - If something goes wrong
