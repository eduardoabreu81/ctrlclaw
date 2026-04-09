# CtrlClaw

CtrlClaw is a web interface for the Claw ecosystem. It lets you talk to agents, manage conversations, keep context, and work in a chat-style interface instead of relying on terminal commands.

## Who is it for?

CtrlClaw is for people who want a cleaner and more operational way to work with Claw agents, whether in local development, VPS environments, or controlled staging setups.

## What you can do with CtrlClaw

- Talk to agents in a web interface
- Manage multiple conversations
- Keep context visible and controlled
- Work with multiple agents
- Use real-time communication through WebSocket
- Operate with more resilience and protection than a terminal-only flow

## Quickest way to try CtrlClaw

**Note:** CtrlClaw currently requires manual setup steps. A guided installation or one-command bootstrap flow is not yet available.

For now, the easiest way to try CtrlClaw is to run a controlled local setup.

### Option 1: Bootstrap script (if available)

```bash
# Clone and setup in one step
./scripts/bootstrap-local.sh
```

### Option 2: Manual setup

```bash
# 1. Install dependencies
npm install

# 2. Start the WebSocket server
node scripts/start-ws-server.js

# 3. Start the web application (in another terminal)
npm start

# 4. Open the browser at the configured address
```

### Validate the setup

Check that:

- The health endpoint returns OK
- The web app opens in the browser
- The WebSocket server accepts connections
- You can create a conversation and send a message

## Security notice

**Default credentials**, when present in local setup examples, are for controlled development use only. 

- Change the password immediately after the first login
- Never keep default credentials in staging, shared, or public environments
- Use strong authentication for any exposed deployment

## Documentation

### User guides

- [Getting Started](docs/user/GETTING-STARTED.md)
- [Connecting to Claw](docs/user/CONNECTING-TO-CLAW.md)
- [Using CtrlClaw](docs/user/USING-CTRLCLAW.md)
- [Troubleshooting](docs/user/TROUBLESHOOTING.md)

### Technical and operations docs

- [Staging Deploy Procedures](docs/STAGING-DEPLOY-2426a3c.md)
- [P4.2 Final Report](docs/P4.2-FINAL-REPORT.md)
- [WS Protection Policy](docs/P4.2-WS-POLICY.md)
- [Blocking Runbook](docs/P4.2-BLOCKING-RUNBOOK.md)

## Project status

CtrlClaw is currently validated for staging, with HTTP and WebSocket protection in place and user-facing chat flows ready for controlled environments.

### Known limitations

- **Onboarding:** Manual setup required. Guided installation or one-command bootstrap is planned but not yet available.
- **Authentication:** Password change on first login is not enforced automatically. Users must change default credentials manually.

---

*CtrlClaw - Web Interface for AI Operations*
