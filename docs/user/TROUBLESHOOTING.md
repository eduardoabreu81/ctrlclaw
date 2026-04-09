# Troubleshooting CtrlClaw

## The app opens but I cannot connect

**Possible causes:**
- The WebSocket server is not running
- The backend is unavailable
- Environment variables are incomplete
- The configured endpoint is wrong

**What to do:**
- Confirm the WebSocket server is running
- Confirm the backend is reachable
- Review the environment configuration
- Check server logs

---

## Messages are not being delivered

**Possible causes:**
- Backend failure
- Disconnected WebSocket
- Temporary rate limiting
- Agent-side problem

**What to do:**
- Retry once
- Check the health endpoint
- Inspect backend logs
- Verify whether a protection message was returned

---

## The WebSocket connection keeps dropping

**Possible causes:**
- WebSocket server is unstable
- Reconnect protection is being triggered
- Local network issues
- Server restart or process exit

**What to do:**
- Verify the WebSocket server process
- Inspect logs
- Avoid aggressive reconnect loops
- Confirm the service manager is keeping the process alive

---

## I reached a rate limit

This means too many requests, messages, or connection attempts happened inside a protected time window.

**What to do:**
- Wait for the retry window
- Reduce repeated retries
- Avoid reconnect storms
- Check whether multiple tabs or clients are using the same identity

---

## The service is temporarily unavailable

This usually means a backend protection mechanism is active.

**What to do:**
- Wait a short time
- Retry after the reported interval
- Check server logs
- Verify whether the backend dependency is healthy
