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

## Quick start

### Requirements

- Node.js installed
- Project dependencies installed
- A working Claw-compatible backend or agent environment
- Environment variables configured
- WebSocket server available for real-time features

### Start the WebSocket server

```bash
node scripts/start-ws-server.js
```

### Start the web application

```bash
npm start
```

### Validate the setup

Check that:

- The health endpoint returns OK
- The web app opens in the browser
- The WebSocket server accepts connections
- You can create a conversation and send a message

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

---

*CtrlClaw - Web Interface for AI Operations*
