# Troubleshooting CtrlClaw

## Connection Issues

### The app opens but I cannot connect
**Possible causes:** WebSocket server not running, backend unavailable, wrong endpoint configuration.

**What to do:**
1. Confirm the WebSocket server is running: `node scripts/start-ws-server.js`
2. Check that environment variables are set correctly (especially `WS_URL`)
3. Review browser console for connection errors
4. Check server logs for startup messages

### WebSocket connection drops frequently
**Possible causes:** Network instability, rate limiting, browser sleep mode.

**What to do:**
1. Check if you hit rate limits (see below)
2. Disable browser power-saving mode for the tab
3. Check network stability
4. Review server logs for disconnection reasons

## Rate Limiting

### I reached a rate limit (HTTP 429)
**What happened:** Too many requests were made in a short time window.

**What to do:**
1. Wait for the retry window (check `Retry-After` header)
2. Avoid rapid reconnections - the client has exponential backoff
3. Do not refresh the page repeatedly

### WebSocket connection rejected (1013 TRY_LATER)
**What happened:** Connection quota exceeded - too many connections from the same user/IP.

**What to do:**
1. Wait 60 seconds before retrying
2. Check if you have multiple browser tabs open
3. Close unused connections

## Service Unavailability

### The service is temporarily unavailable
**What happened:** Backend protection is active (circuit breaker open).

**What to do:**
1. Wait for the reported interval (typically 30 seconds)
2. Check if the agent backend (NanoClaw/OpenClaw) is healthy
3. Retry after the cooldown period

## Authentication Issues

### Cannot log in with default credentials
**Possible causes:** Wrong credentials, auth service down, misconfigured environment.

**What to do:**
1. Double-check credentials (if using defaults, check setup documentation)
2. Verify `NANOCLAW_URL` is configured correctly
3. Check server logs for auth errors

**Security reminder:** Default credentials are for controlled local setup only. Change immediately after first login. Never use in staging/shared/public environments.

## Installation & Setup Issues

### Bootstrap script fails
**Common causes:** Node.js not installed, not in project root, missing permissions.

**What to do:**
1. Verify Node.js is installed: `node --version`
2. Run the script from project root (where `package.json` is)
3. On Unix systems, ensure the script is executable: `chmod +x scripts/bootstrap-local.sh`

**Note:** Guided installation or one-command bootstrap is planned but not yet available. The bootstrap script is a helper that still requires manual steps.

## Getting More Help

If your issue is not covered here:
1. Check the browser console for error messages
2. Review server logs for stack traces
3. Check [ARCHITECTURE.md](../../ARCHITECTURE.md) for system details
