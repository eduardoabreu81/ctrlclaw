# Getting Started with CtrlClaw

## What is CtrlClaw?

CtrlClaw is a web interface for the Claw ecosystem. It is built to make agent interaction feel closer to a modern chat application and less like a terminal workflow.

## What you need before you start

Before using CtrlClaw, make sure you have:

- Node.js installed
- The project dependencies installed
- A working Claw-compatible backend or agent environment
- The required environment variables configured
- The WebSocket server ready to run

## What runs in CtrlClaw

CtrlClaw has two main parts:

- **The web app**, which provides the user interface
- **The WebSocket and backend connection layer**, which makes real-time communication and agent responses work

The web app is what you see.
The backend and WebSocket layer are what make the interface useful.

## First-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start the WebSocket server

```bash
node scripts/start-ws-server.js
```

### 3. Start the web application

```bash
npm start
```

### 4. Open the app

Open the browser and access the app using the configured address.

## Quick validation

You know CtrlClaw is working when:

- The health endpoint returns OK
- The web app loads successfully
- The WebSocket server accepts a connection
- You can create a conversation
- You can send and receive a message

## Common beginner mistakes

- Starting the web app without starting the WebSocket server
- Missing environment variables
- Using the wrong backend endpoint
- Assuming the interface is enough without the Claw environment running
- Ignoring server logs when the UI cannot connect
