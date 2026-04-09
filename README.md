# CtrlClaw

**Secure web interface for the Claw ecosystem**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What is CtrlClaw?

CtrlClaw is a production-ready web frontend for Claw-like AI backends (NanoClaw, OpenClaw). It provides:

- **Secure remote access** to AI agents via web interface
- **Real-time chat** with WebSocket connectivity
- **Operational memory** - persist, search, and resume conversations
- **Multi-agent support** - interact with specialized AI agents
- **Enterprise-grade security** - CSP, CORS, session management
- **Easy deployment** - local, VPS, or secure tunnel scenarios

### Key Differentiators

- **Security-first**: No sensitive data in localStorage, session-based auth, strict CSP
- **Backend-agnostic**: Adapter pattern supports multiple Claw backends
- **Memory architecture**: Contextual conversation resumption, not isolated sessions
- **Production-ready**: Docker, SSL automation, environment-based configuration

---

## Objective

Replace terminal-based interaction with a secure, accessible web interface for:
- System administrators managing Claw deployments
- End users without terminal access
- Remote operation via HTTPS/WSS

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (Strict) |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui |
| State Management | Zustand |
| Forms | React Hook Form + Zod |
| WebSocket | Native WebSocket API |
| IndexedDB | Dexie.js (for local memory index) |
| Icons | Lucide React |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/eduardoabreu81/ctrlclaw.git
cd ctrlclaw

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start the mock backend (for development)
cd test-backend
npm install
node server.mjs

# In another terminal, start the frontend
cd ..
npm run dev
```

### Access

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Login: `admin` / `admin`

---

## Development with Mock Backend

The included mock backend simulates a NanoClaw API for local development:

```bash
# Terminal 1: Start mock backend
cd test-backend
node server.mjs

# Terminal 2: Start frontend
npm run dev
```

### Mock Backend Features

- Authentication (`/api/auth/login`)
- Conversations CRUD (`/api/conversations`)
- Messages (`/api/conversations/:id/messages`)
- WebSocket with message events
- In-memory persistence (resets on restart)

---

## Project Setup

### Automatic Setup

```bash
# Run the setup wizard
npm run setup

# Or manually configure .env.local
```

### Manual Configuration

Edit `.env.local`:

```env
# For local development
NEXT_PUBLIC_DEPLOYMENT_SCENARIO=local
NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:3001

# For VPS deployment
NEXT_PUBLIC_DEPLOYMENT_SCENARIO=vps
NEXT_PUBLIC_BACKEND_HTTP_URL=https://api.yourdomain.com
NEXT_PUBLIC_BACKEND_WS_URL=wss://api.yourdomain.com
```

---

## Project Structure

```
ctrlclaw/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (app)/          # Authenticated routes
│   │   ├── (auth)/         # Auth routes (login)
│   │   └── api/            # API routes
│   ├── features/           # Domain features
│   │   ├── auth/          # Authentication
│   │   ├── chat/          # Chat functionality
│   │   ├── memory/        # Memory & context (Fase 7)
│   │   └── agents/        # Agent management
│   ├── components/        # Shared UI components
│   ├── lib/               # Core libraries
│   │   ├── indexeddb.ts   # IndexedDB setup
│   │   └── websocket.ts   # WebSocket manager
│   ├── hooks/             # React hooks
│   └── types/             # TypeScript types
├── test-backend/          # Mock backend for development
├── docs/                  # Documentation (see P4.2-RELATORIO-FINAL.md for validation)
├── scripts/               # Utility scripts
└── public/                # Static assets
```

---

## Current Status

🚀 **STAGING APPROVED** - All protection layers validated and ready for deploy.

### Validation Summary

| Layer | Component | Status |
|-------|-----------|--------|
| HTTP | Baseline (p95 < 500ms) | ✅ Validated |
| HTTP | Rate Limit (57% 429s) | ✅ Validated |
| HTTP | Circuit Breaker (1013 w/ Retry-After) | ✅ Validated |
| WebSocket | Baseline (100% success) | ✅ Validated |
| WebSocket | Protection (10 acc, 5 blocked 1013) | ✅ Validated |
| Resilience | Redis Fallback | ✅ Validated |

See `docs/P4.2-FINAL-REPORT.md` for detailed validation evidence.

### ✅ Completed Phases

| Phase | Status | Description |
|-------|--------|-------------|
| Fase 1 | ✅ | Foundation - Next.js, TypeScript, Tailwind, shadcn |
| Fase 2 | ✅ | Backend Adapter Pattern |
| Fase 3 | ✅ | Auth, WebSocket, State Management |
| Fase 4 | ✅ | Main Layout, UI Components |
| Fase 5 | ✅ | Smart Setup, Discovery Engine |
| Fase 6 | ✅ | Functional Chat, Stabilization |
| Fase 7 | ✅ | Memory, Context, Agents |
| P4.1 | ✅ | HTTP Load Testing - Baseline, Rate Limit, Circuit Breaker |
| P4.2 | ✅ | WebSocket Protection - Identity-based Rate Limiting |

### Implemented Features

- ✅ Authentication with session persistence
- ✅ WebSocket with auto-reconnect
- ✅ Real-time chat with message deduplication
- ✅ Conversation history (lazy load)
- ✅ Toast notifications, loading states, retry logic
- ✅ IndexedDB for operational memory
- ✅ Context assembly with limits
- ✅ Search by keywords and tags
- ✅ Context injection into agent messages

### Protection & Resilience (P4.1 / P4.2)

- ✅ **HTTP Rate Limiting** - 100 req/min per IP/user, 429 with Retry-After
- ✅ **Circuit Breaker** - CLOSED→OPEN→HALF_OPEN transitions, 503 with Retry-After
- ✅ **WebSocket Rate Limiting** - 10 connections / 50 messages per 60s per identity
- ✅ **Redis Fallback** - Memory fallback when Redis unavailable
- ✅ **Load Testing** - k6 scenarios for HTTP and WebSocket validation

---

## Known Limitations (v1)

### By Design

| Limitation | Reason |
|------------|--------|
| Messages in memory only | Security - never persist sensitive data to storage |
| Reload = lose history | Backend is source of truth |
| No client-side AI | Browser can't run LLMs efficiently |

### Current (Will Improve)

| Limitation | Status |
|------------|--------|
| Mock summarizer (extractive) | Waiting for backend LLM integration |
| No semantic search | Requires embeddings (Fase 8+) |
| No file uploads | Future feature |
| Single-workspace | Multi-tenant requires backend support |

---

## Roadmap

### Fase 7 (Current) - Memory & Context
- [x] IndexedDB for metadata and summaries
- [x] Context assembly with limits
- [x] Search by keywords and tags
- [x] ContextPanel UI
- [ ] Context injection to agents

### Fase 8 - Semantic Search
- [ ] Vector embeddings
- [ ] Semantic conversation search
- [ ] Similarity-based retrieval

### Fase 9 - Global Memory
- [ ] Cross-conversation insights
- [ ] User preference learning
- [ ] Long-term context

### Fase 10 - Workflows
- [ ] Multi-agent collaboration
- [ ] Automated workflows
- [ ] Scheduled tasks

---

## Security Considerations

- **No sensitive data in localStorage/sessionStorage** (except session token)
- **Strict CSP headers** configurable per environment
- **Session-based authentication** with idle timeout
- **No client-side secrets** ever committed
- **IndexedDB limited to metadata only** (no message content)

---

## Contributing

This is currently a personal project. Contributions will be considered after v1 stability.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Built for the [Claw ecosystem](https://github.com/eduardoabreu81/claw)
- UI components by [shadcn/ui](https://ui.shadcn.com/)
- Icons by [Lucide](https://lucide.dev/)

---

*CtrlClaw - Secure Web Interface for AI Operations*
