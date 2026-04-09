# Connecting CtrlClaw to the Claw Environment

## Overview

CtrlClaw is the web layer. It does not replace the Claw environment. It connects to it.

To work correctly, CtrlClaw needs both the interface layer and the backend or agent side to be available at the same time.

## What needs to be running

At minimum, these parts must be available:

- The CtrlClaw web app
- The CtrlClaw WebSocket server
- The Claw-compatible backend or agent environment

## Connection flow

1. The user opens the web app
2. The app connects to the WebSocket server for real-time communication
3. The app sends requests to the configured backend
4. The backend processes agent interactions
5. Responses return to the UI

## Minimum setup

### Start the WebSocket server

```bash
node scripts/start-ws-server.js
```

### Start the web application

```bash
npm start
```

## How to verify that the connection is working

Check the following:

- The health endpoint responds correctly
- The WebSocket server accepts a test connection
- The app loads without connection errors
- A conversation can be created
- A message can be sent and received

## What to check if the connection fails

Review these items:

- Backend address
- Environment variables
- WebSocket port
- WebSocket server logs
- Backend availability
- Rate limiting or temporary protection messages

## Typical symptoms

### The app opens but cannot connect

The UI is running, but the backend or WebSocket server is not reachable.

### Messages do not arrive

The connection may be partially working, but the agent or backend side is not responding.

### Real-time updates do not appear

The WebSocket server may be down or blocked.
