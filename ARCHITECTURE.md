# CtrlClaw Architecture Specification

> **Version:** 1.1.0  
> **Status:** Review  
> **Date:** 2026-04-05

---

## 1. Executive Summary

CtrlClaw é um frontend web enterprise para o ecossistema OpenClaw/NanoClaw, projetado para uso remoto seguro e deployment em produção.

**Princípios Não-Negociáveis:**
1. Segurança é requisito de primeira classe desde a v1
2. Cenário padrão: backend remoto acessível via HTTPS/WSS
3. Deployment seguro é parte integrante do produto
4. Frontend desacoplado do dashboard nativo do backend
5. V1 enxuta mas sólida - fundação robusta sobre features excessivas

**Convenções deste Documento:**
- ✅ **DECISÃO DEFINITIVA** - Arquitetura final, não muda sem RFC
- ⚠️ **TRADE-OFF V1** - Solução temporária, documentada com limitações
- ❓ **PENDENTE** - Requer decisão antes de implementação

---

## 2. Contexto do Produto

### 2.1 O que é
- Interface web para backends Claw-like
- Substitui terminal para operações cotidianas
- Produto standalone, não um "skin" do dashboard nativo

### 2.2 Quem usa
- Administradores de sistemas Claw
- Usuários finais sem acesso ao terminal
- Operação remota via web

### 2.3 Onde roda
- Backend: VPS, servidor dedicado, infraestrutura própria
- Frontend: Next.js build (SSR/SSG híbrido)
- Conexão: Internet pública via HTTPS/WSS

---

## 3. Decisões de Arquitetura Críticas

### 3.1 Token Storage: Análise Completa de Trade-offs

#### Opção A: Bearer Token em Memória (Zustand Store)

**Implementação:**
```typescript
// Token existe apenas em runtime
const useAuthStore = create(() => ({
  token: null as string | null, // Lost on reload
}));
```

**Prós:**
- Zero persistência em disco
- Imune a XSS extraindo de localStorage
- Simples de implementar
- Não requer mudanças no backend

**Contras:**
- Usuário perde sessão ao recarregar página
- Múltiplas abas não compartilham sessão
- UX degradada (login frequente)
- WebSocket precisa re-autenticar a cada reconnect

**Security Score:** 7/10 (bom contra XSS, ruim para session hijacking via memory dump)
**UX Score:** 4/10 (frustração com perda de sessão)

---

#### Opção B: httpOnly Secure Cookie

**Implementação:**
```http
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400
```

**Prós:**
- JavaScript não pode acessar (mitiga XSS)
- Navegador gerencia automaticamente
- Funciona em múltiplas abas
- Persiste reloads de página
- Padrão da indústria para web apps

**Contras:**
- Requer backend configurar cookie ou proxy intermediário
- CSRF protection necessária para mutações HTTP
- WebSocket não envia cookies automaticamente (precisa de workaround)
- Mais complexo de implementar cross-domain

**Security Score:** 9/10
**UX Score:** 9/10

---

#### Opção C: Estratégia de Refresh Token

**Implementação:**
```typescript
// Access token: curto (15min), memory
// Refresh token: longo (7d), httpOnly cookie

interface TokenPair {
  accessToken: string;  // JWT ou opaque, 15min
  refreshToken: string; // httpOnly cookie, 7d
}
```

**Prós:**
- Access token curto limita janela de ataque
- Refresh token rotacionável (invalidação remota)
- Melhor balance security/UX
- Padrão OAuth 2.0 / moderno

**Contras:**
- Requer backend suportar refresh tokens
- Complexidade adicional (token rotation, blacklist)
- Mais requisições HTTP (refresh automático)

**Security Score:** 9.5/10
**UX Score:** 9/10

---

#### Opção D: Híbrida V1 (Implementação Proposta)

**⚠️ TRADE-OFF V1**

```typescript
// Estratégia: Memory + sessionStorage (opcional)

enum StorageMode {
  MEMORY_ONLY = 'memory',      // Padrão, mais seguro
  SESSION_STORAGE = 'session', // Sob demanda, UX melhor
}

interface AuthConfig {
  mode: StorageMode;
  token: string | null;
}
```

**Regra:**
1. Default: Memory-only (token perdido no reload)
2. Opção usuário: "Manter sessão nesta aba" → sessionStorage
3. NUNCA localStorage (persiste além da sessão do browser)
4. Backend constraint: NanoClaw atual retorna token no body, não cookie

**Limitações Documentadas:**
- Perda de sessão em reload (modo padrão)
- Múltiplas abas requerem re-login
- WebSocket auth via mensagem (não cookie)

**Migration Path V2:**
1. Implementar proxy/API route que seta httpOnly cookie
2. Token nunca toca JavaScript
3. WebSocket usa cookie via query param temporário

**Justificativa V1:** Backend atual limita implementação (não suporta cookies). Opção híbrida oferece UX aceitável (sessionStorage opt-in) sem comprometer segurança default.

**Security Score:** 6/10 default, 5/10 com sessionStorage opt-in
**UX Score:** 4/10 default, 7/10 com sessionStorage

---

### 3.2 SSR vs Static Export

**✅ DECISÃO DEFINITIVA: Next.js Build Normal (SSR/SSG Híbrido)**

**Justificativa:**
- Middleware de autenticação no edge
- Runtime config (variáveis de ambido dinâmicas)
- Headers de segurança configuráveis
- API routes para proxy seguro se necessário
- Flexibilidade para futuras features server-side

**NÃO Static Export porque:**
- Limita middleware (redirecionamento auth fica mais frágil)
- Impede API routes (necessários para proxy/cors handling)
- Headers de segurança fixos no build
- Menos flexível para deployment scenarios avançados

---

### 3.3 Backend Compatibility

**✅ DECISÃO DEFINITIVA: Arquitetura com Adapter Pattern**

**Camada de Abstração:**
```typescript
// interfaces/backend-adapter.ts

interface ClawBackendAdapter {
  // Auth
  login(credentials: LoginCredentials): Promise<AuthResult>;
  logout(token: string): Promise<void>;
  validateSession(token: string): Promise<User>;
  
  // Agents
  listAgents(token: string): Promise<Agent[]>;
  getAgent(token: string, id: string): Promise<Agent>;
  
  // WebSocket
  getWebSocketUrl(token: string): string;
  createWebSocketConnection(config: WSConfig): WebSocketConnection;
}

// Implementações concretas
class NanoClawAdapter implements ClawBackendAdapter { ... }
class OpenClawAdapter implements ClawBackendAdapter { ... }
class MockClawAdapter implements ClawBackendAdapter { ... } // Para tests
```

**Factory Pattern:**
```typescript
// lib/backend-factory.ts
export function createBackendAdapter(
  type: 'nanoclaw' | 'openclaw' | 'mock'
): ClawBackendAdapter {
  switch (type) {
    case 'nanoclaw': return new NanoClawAdapter();
    case 'openclaw': return new OpenClawAdapter();
    case 'mock': return new MockClawAdapter();
  }
}
```

**Configuração:**
```bash
# .env.local
BACKEND_ADAPTER=nanoclaw  # ou openclaw, mock
NEXT_PUBLIC_BACKEND_TYPE=nanoclaw  # Para UI saber capabilities
```

**Benefícios:**
- Troca de backend sem mudar UI
- Testes com mock adapter
- Suporte gradual a múltiplos backends
- Contrato formalizado (interface TypeScript)

---

### 3.4 Message Persistence

**✅ DECISÃO DEFINITIVA: Nenhuma Persistência Local de Conteúdo Sensível**

**Proibido na v1:**
- ❌ localStorage para mensagens
- ❌ localStorage para histórico de chat
- ❌ localStorage para tokens de autenticação
- ❌ IndexedDB para dados de conversação

**Permitido (não-sensível):**
- ✅ sessionStorage: preferências de UI (tema, sidebar collapsed)
- ✅ sessionStorage: última conversa ativa (ID apenas, não conteúdo)
- ✅ localStorage: aceitação de termos, dismiss de banners

**Arquitetura de Persistência:**
```typescript
// Apenas metadados em sessionStorage
interface SessionCache {
  ui: {
    sidebarCollapsed: boolean;
    theme: 'light' | 'dark';
    activeConversationId: string | null;  // Só o ID!
  };
}

// Mensagens: memória apenas (Zustand store)
// Recarregar página = recarregar do backend via WS/API
```

**Justificativa de Segurança:**
- localStorage é plaintext, acessível a qualquer JavaScript (XSS)
- Mensagens de chat podem conter dados sensíveis
- Ambiente compartilhado (computador público) = vazamento
- Compliance (GDPR, LGPD): persistência local = storage não controlado

**UX Trade-off Aceito:**
- Recarregar página = recarregar histórico do backend
- Indicador de loading durante fetch inicial
- Offline mode: mensagem de "conexão necessária"

**Futuro (v2+):**
- IndexedDB com criptografia (chave derivada de sessão)
- E2E encryption opcional
- Sync backend → local (opt-in com consentimento)

---

## 4. Contratos Backend

### 4.1 Base URL & Environment
```bash
# Backend remoto (produção)
CLAW_API_URL=https://claw.exemplo.com
CLAW_WS_URL=wss://claw.exemplo.com
BACKEND_ADAPTER=nanoclaw

# Segurança
SESSION_TTL_MINUTES=30
TOKEN_REFRESH_ENABLED=false  # v1: NanoClaw não suporta
```

### 4.2 Autenticação HTTP

#### POST /api/auth/login
**⚠️ TRADE-OFF V1:** Backend retorna token no body (não cookie). Limitação conhecida.

**Request:**
```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json
X-Requested-With: XMLHttpRequest

{
  "username": "string",
  "password": "string"
}
```

**Response 200:**
```json
{
  "token": "a1b2c3d4e5f6...",
  "username": "admin",
  "expiresIn": 86400
}
```

**Response 401:**
```json
{
  "error": "Invalid username or password",
  "code": "AUTH_INVALID_CREDENTIALS"
}
```

**Response 429 (Rate Limit):**
```json
{
  "error": "Too many attempts",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900
}
```

#### GET /api/auth/me

**Request:**
```http
GET /api/auth/me HTTP/1.1
Authorization: Bearer <token>
X-Requested-With: XMLHttpRequest
```

**Response 200:**
```json
{
  "username": "admin",
  "permissions": ["read", "write", "admin"]
}
```

**Response 401:**
```json
{
  "error": "Unauthorized",
  "code": "AUTH_INVALID_TOKEN"
}
```

#### POST /api/auth/logout

**Request:**
```http
POST /api/auth/logout HTTP/1.1
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "ok": true
}
```

### 4.3 WebSocket Protocol

**✅ DECISÃO DEFINITIVA:** Protocolo formalizado, versionado.

#### Connection URL
```
wss://claw.exemplo.com/?v=1
```

#### Handshake Flow
```
Client → Server: HTTP Upgrade
Server → Client: { type: "auth_required", protocol: "1" }
Client → Server: { type: "authenticate", token: "...", id: "uuid-v4" }
Server → Client: { type: "auth_success", session: {...} }
                  or { type: "auth_failed", reason: "..." }
Client → Server: { type: "subscribe", topics: [...] }
Server → Client: { type: "subscribed", topics: [...] }
[...normal operation...]
```

#### Message Types

**Client → Server:**
```typescript
type WSClientMessage =
  | { 
      type: 'authenticate'; 
      token: string; 
      id: string;  // UUID para correlation
    }
  | { 
      type: 'subscribe'; 
      topics: WSTopic[];
      id: string;
    }
  | { 
      type: 'unsubscribe'; 
      topics: WSTopic[];
      id: string;
    }
  | { 
      type: 'ping'; 
      timestamp: number;
    }
  | { 
      type: 'chat_message'; 
      content: string; 
      conversationId?: string;
      id: string;
    }
  | {
      type: 'ack';
      messageId: string;
    };
```

**Server → Client:**
```typescript
type WSServerMessage =
  | { type: 'auth_required'; protocol: string }
  | { 
      type: 'auth_success'; 
      session: { username: string; expiresAt: string };
      correlationId?: string;
    }
  | { 
      type: 'auth_failed'; 
      reason: string; 
      code: string;
      correlationId?: string;
    }
  | { 
      type: 'subscribed'; 
      topics: WSTopic[];
      correlationId?: string;
    }
  | { 
      type: 'message'; 
      data: Message;
      id: string;
    }
  | { 
      type: 'agent_update'; 
      data: Agent;
    }
  | { 
      type: 'agent_list'; 
      data: Agent[];
    }
  | { 
      type: 'connection_status'; 
      status: 'healthy' | 'degraded' | 'overloaded';
      latency?: number;
    }
  | { 
      type: 'error'; 
      code: string; 
      message: string;
      correlationId?: string;
    }
  | { 
      type: 'pong'; 
      timestamp: number;
    };

type WSTopic = 'messages' | 'agents' | 'system' | 'tasks';
```

#### Error Codes
```typescript
enum WSErrorCode {
  // Auth
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED_TOKEN = 'AUTH_EXPIRED_TOKEN',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  
  // Rate Limit
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Validation
  INVALID_MESSAGE_FORMAT = 'INVALID_MESSAGE_FORMAT',
  UNKNOWN_TOPIC = 'UNKNOWN_TOPIC',
  
  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}
```

### 4.4 API REST Adicional

#### GET /api/agents

**Request:**
```http
GET /api/agents HTTP/1.1
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "agents": [
    {
      "id": "agent-001",
      "name": "Research Assistant",
      "description": "Agent for web research",
      "status": "idle",
      "capabilities": ["search", "summarize"],
      "createdAt": "2026-04-05T10:00:00Z",
      "lastActivity": "2026-04-05T14:30:00Z"
    }
  ],
  "total": 5
}
```

#### GET /api/agents/:id

**Request:**
```http
GET /api/agents/agent-001 HTTP/1.1
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "id": "agent-001",
  "name": "Research Assistant",
  "description": "Agent for web research",
  "status": "idle",
  "capabilities": ["search", "summarize"],
  "configuration": {
    "model": "gpt-4",
    "temperature": 0.7
  },
  "createdAt": "2026-04-05T10:00:00Z",
  "stats": {
    "messagesProcessed": 1523,
    "lastActive": "2026-04-05T14:30:00Z"
  }
}
```

---

## 5. Entidades de Domínio

### 5.1 User
```typescript
interface User {
  username: string;
  permissions: Permission[];
}

type Permission = 'read' | 'write' | 'admin';
```

### 5.2 AuthSession
```typescript
interface AuthSession {
  token: string;
  user: User;
  expiresAt: string; // ISO 8601
  obtainedAt: string;
}
```

### 5.3 Agent
```typescript
interface Agent {
  id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  capabilities: string[];
  configuration?: AgentConfiguration;
  createdAt: string;
  lastActivity?: string;
  stats?: AgentStats;
}

type AgentStatus = 'idle' | 'busy' | 'offline' | 'error';

interface AgentConfiguration {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  [key: string]: unknown;
}

interface AgentStats {
  messagesProcessed: number;
  lastActive?: string;
}
```

### 5.4 Message
```typescript
interface Message {
  id: string;
  conversationId: string;
  sender: string;        // agent ID ou "user"
  senderName: string;    // display name
  content: string;
  timestamp: string;
  isFromMe: boolean;
  type: MessageType;
  metadata?: MessageMetadata;
  status: MessageStatus;
}

type MessageType = 'text' | 'system' | 'error' | 'command';
type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

interface MessageMetadata {
  agentId?: string;
  command?: string;
  executionTime?: number;
  tokensUsed?: number;
}
```

### 5.5 Conversation
```typescript
interface Conversation {
  id: string;
  title: string;
  agentId?: string;      // undefined = chat principal
  messages: Message[];
  createdAt: string;
  lastActivity: string;
  unreadCount: number;
  status: ConversationStatus;
}

type ConversationStatus = 'active' | 'archived' | 'error';
```

### 5.6 Runtime State
```typescript
interface RuntimeState {
  connection: ConnectionState;
  session: SessionState;
  execution: ExecutionState;
}

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastPingAt?: string;
  latencyMs?: number;
  reconnectAttempt: number;
  serverStatus?: 'healthy' | 'degraded' | 'overloaded';
}

interface SessionState {
  isAuthenticated: boolean;
  user?: User;
  expiresAt?: string;
  lastActivityAt: string;
  storageMode: 'memory' | 'session';
}

interface ExecutionState {
  status: 'idle' | 'processing' | 'waiting' | 'error';
  currentAgent?: string;
  currentConversation?: string;
  startTime?: string;
  lastError?: {
    code: string;
    message: string;
    timestamp: string;
  };
}
```

---

## 6. Backend Adapter

### 6.1 Interface do Adapter
```typescript
// types/backend-adapter.ts

interface ClawBackendAdapter {
  readonly type: string;
  readonly version: string;
  readonly capabilities: BackendCapability[];

  // Auth
  login(credentials: LoginCredentials): Promise<AuthResult>;
  logout(token: string): Promise<void>;
  validateSession(token: string): Promise<User>;
  refreshToken?(token: string): Promise<AuthResult>; // Optional

  // Agents
  listAgents(token: string): Promise<Agent[]>;
  getAgent(token: string, id: string): Promise<Agent>;
  createAgent?(token: string, config: CreateAgentConfig): Promise<Agent>; // v2
  updateAgent?(token: string, id: string, config: Partial<AgentConfiguration>): Promise<Agent>; // v2

  // WebSocket
  getWebSocketUrl(token: string): string;
  getWebSocketConfig(token: string): WebSocketConfig;
  
  // Capabilities check
  supports(feature: BackendCapability): boolean;
}

type BackendCapability = 
  | 'oauth_login'
  | 'refresh_token'
  | 'agent_creation'
  | 'agent_deletion'
  | 'flow_orchestration'
  | 'multi_workspace';

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthResult {
  token: string;
  user: User;
  expiresIn: number;
}

interface WebSocketConfig {
  url: string;
  protocols: string[];
  authMethod: 'message' | 'query_param' | 'header';
}
```

### 6.2 Implementação NanoClaw
```typescript
// adapters/nanoclaw-adapter.ts

export class NanoClawAdapter implements ClawBackendAdapter {
  readonly type = 'nanoclaw';
  readonly version = '1.0';
  readonly capabilities: BackendCapability[] = [];

  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.CLAW_API_URL!;
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new AuthError(error.code, error.error);
    }

    const data = await response.json();
    return {
      token: data.token,
      user: { username: data.username, permissions: ['read', 'write', 'admin'] },
      expiresIn: data.expiresIn || 86400,
    };
  }

  async logout(token: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }

  async validateSession(token: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new AuthError('AUTH_INVALID_TOKEN', 'Session invalid');
    }

    const data = await response.json();
    return {
      username: data.username,
      permissions: data.permissions || ['read', 'write'],
    };
  }

  async listAgents(token: string): Promise<Agent[]> {
    const response = await fetch(`${this.baseUrl}/api/agents`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new BackendError('AGENTS_FETCH_FAILED', 'Failed to fetch agents');
    }

    const data = await response.json();
    return data.agents.map(this.mapAgent);
  }

  async getAgent(token: string, id: string): Promise<Agent> {
    const response = await fetch(`${this.baseUrl}/api/agents/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new BackendError('AGENT_NOT_FOUND', `Agent ${id} not found`);
    }

    const data = await response.json();
    return this.mapAgent(data);
  }

  getWebSocketUrl(token: string): string {
    const wsUrl = process.env.CLAW_WS_URL!;
    // NanoClaw usa auth via mensagem, não query param
    return `${wsUrl}?v=1`;
  }

  getWebSocketConfig(token: string): WebSocketConfig {
    return {
      url: this.getWebSocketUrl(token),
      protocols: [],
      authMethod: 'message',
    };
  }

  supports(feature: BackendCapability): boolean {
    return this.capabilities.includes(feature);
  }

  private mapAgent(data: any): Agent {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status,
      capabilities: data.capabilities || [],
      configuration: data.configuration,
      createdAt: data.createdAt,
      lastActivity: data.lastActivity,
      stats: data.stats,
    };
  }
}
```

### 6.3 Factory e Configuração
```typescript
// lib/backend-factory.ts

import { NanoClawAdapter } from '@/adapters/nanoclaw-adapter';
import { OpenClawAdapter } from '@/adapters/openclaw-adapter';
import { MockClawAdapter } from '@/adapters/mock-adapter';

export type BackendType = 'nanoclaw' | 'openclaw' | 'mock';

export function createBackendAdapter(type?: BackendType): ClawBackendAdapter {
  const adapterType = type || (process.env.BACKEND_ADAPTER as BackendType) || 'nanoclaw';

  switch (adapterType) {
    case 'nanoclaw':
      return new NanoClawAdapter();
    case 'openclaw':
      return new OpenClawAdapter();
    case 'mock':
      return new MockClawAdapter();
    default:
      throw new Error(`Unknown backend adapter: ${adapterType}`);
  }
}

// Singleton para reutilização
let adapterInstance: ClawBackendAdapter | null = null;

export function getBackendAdapter(): ClawBackendAdapter {
  if (!adapterInstance) {
    adapterInstance = createBackendAdapter();
  }
  return adapterInstance;
}

export function resetBackendAdapter(): void {
  adapterInstance = null;
}
```

---

## 7. Fluxos de Autenticação e Sessão

### 7.1 Login Completo
```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER SUBMITS CREDENTIALS                                     │
│                                                                 │
│ LoginForm → React Hook Form + Zod validation                    │
│                                                                 │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│ │  Usuário   │───▶│  LoginForm  │───▶│ auth-service.login  │  │
│ └─────────────┘    └─────────────┘    └──────────┬──────────┘  │
└──────────────────────────────────────────────────┼─────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. BACKEND AUTHENTICATION                                       │
│                                                                 │
│ POST /api/auth/login                                            │
│                                                                 │
│ ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│ │  NanoClawAdapter    │───▶│  https://claw.exemplo.com       │ │
│ │  .login()           │    │  /api/auth/login                │ │
│ └─────────────────────┘    └─────────────────────────────────┘ │
│           │                                                    │
│           ▼                                                    │
│    ┌──────────────┐                                            │
│    │ AuthResult   │                                            │
│    │ {token, user}│                                            │
│    └──────┬───────┘                                            │
└───────────┼────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SESSION STORAGE (Decision Point)                             │
│                                                                 │
│ IF user selected "Remember this session":                       │
│    → Store in sessionStorage (this tab only)                    │
│ ELSE:                                                           │
│    → Store in memory only (Zustand)                            │
│                                                                 │
│ ⚠️ TRADE-OFF V1: No httpOnly cookie support                     │
│    Backend limitation, migration path documented                │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. INITIALIZE RUNTIME                                           │
│                                                                 │
│ ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│ │ auth-store  │───▶│ runtime-store│───▶│ WebSocket connect   │  │
│ │ (token set) │    │ (session OK) │    │ (WSS handshake)     │  │
│ └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                                                 │               │
│                                                 ▼               │
│    ┌─────────────────────────────────────────────────────────┐ │
│    │ 5. REDIRECT TO APP                                       │ │
│    │                                                          │ │
│    │ Middleware validates:                                    │ │
│    │ - Token exists                                           │ │
│    │ - Not expired                                            │ │
│    │ - /me validation (optional, background)                  │ │
│    │                                                          │ │
│    │ → /chat                                                  │ │
│    └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Session Validation Flow
```
┌─────────────────────────────────────────────────────────────────┐
│ MIDDLEWARE EXECUTION (Every Route Change)                       │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ CHECK 1: Token Exists?                                          │
│                                                                 │
│ Memory: authStore.token ?? sessionStorage.getItem('token')     │
│                                                                 │
│ NO  → Redirect /login                                           │
│ YES → Continue                                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ CHECK 2: Token Expired? (Client-side)                           │
│                                                                 │
│ Compare expiresAt with Date.now()                               │
│                                                                 │
│ YES → Clear token, Redirect /login                              │
│ NO  → Continue                                                  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ CHECK 3: Session Valid? (Server validation - background)        │
│                                                                 │
│ Debounced call to GET /api/auth/me                              │
│                                                                 │
│ 401 → Clear token, Toast error, Redirect /login                 │
│ 200 → Update user data, Continue                                │
│ Timeout → Continue (fail open, retry next navigation)           │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   ALLOW     │
                    │   ACCESS    │
                    └─────────────┘
```

### 7.3 Idle Timeout Management
```typescript
// hooks/use-idle-timeout.ts

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

export function useIdleTimeout() {
  const logout = useAuthStore((s) => s.logout);
  const showWarning = useRuntimeStore((s) => s.showIdleWarning);
  
  useEffect(() => {
    let idleTimer: NodeJS.Timeout;
    let warningTimer: NodeJS.Timeout;
    
    const resetTimer = () => {
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      
      // Warning at 25min
      warningTimer = setTimeout(() => {
        showWarning(5 * 60); // 5 min remaining
      }, IDLE_TIMEOUT_MS - 5 * 60 * 1000);
      
      // Logout at 30min
      idleTimer = setTimeout(() => {
        logout({ reason: 'idle_timeout' });
      }, IDLE_TIMEOUT_MS);
    };
    
    // Track user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => document.addEventListener(e, resetTimer));
    
    resetTimer();
    
    return () => {
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [logout, showWarning]);
}
```

### 7.4 Logout Flow
```
User clicks Logout
        │
        ▼
┌─────────────────┐
│ 1. UI Feedback  │ → Show "Logging out..." spinner
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. WS Disconnect│ → Close WebSocket gracefully
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. API Call     │ → POST /api/auth/logout
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Clear State  │ → authStore.clear()
│                 │ → sessionStorage.removeItem('token')
│                 │ → runtimeStore.reset()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. Redirect     │ → /login?loggedOut=true
└─────────────────┘
```

---

## 8. Fluxo WebSocket

### 8.1 Connection Lifecycle
```
┌─────────────────────────────────────────────────────────────────┐
│ STATE: disconnected                                             │
│                                                                 │
│ Trigger: User login OR App initialization with existing token   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ connect()
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ STATE: connecting                                               │
│                                                                 │
│ Action: new WebSocket(url)                                      │
│ Timeout: 10s → fail                                             │
│                                                                 │
│ UI: Yellow spinner "Connecting..."                              │
└─────────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ onopen   │    │ onerror  │    │ timeout  │
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         ▼               └───────┬───────┘
┌─────────────────┐              │
│ STATE: connected│              │
│                 │              ▼
│ Wait for        │    ┌─────────────────┐
│ auth_required   │    │ STATE: error    │
└────────┬────────┘    │                 │
         │            │ Retry?          │
         │            │ Yes → reconnect │
         │            │ No  → notify    │
         ▼            └─────────────────┘
┌─────────────────┐
│ ← auth_required │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ → authenticate  │ {type: 'authenticate', token}
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ← auth_success  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ → subscribe     │ {type: 'subscribe', topics}
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STATE: online                                                   │
│                                                                 │
│ Actions:                                                        │
│ - Start heartbeat (ping 30s)                                    │
│ - Reset reconnect counter                                       │
│ - Enable message sending                                        │
│                                                                 │
│ UI: Green dot "Connected"                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Reconnection Strategy
```typescript
// lib/websocket.ts

interface ReconnectConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;  // 0-1, adds randomness
}

const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 10,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
};

function calculateReconnectDelay(
  attempt: number,
  config: ReconnectConfig
): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s, 30s...
  const exponentialDelay = Math.min(
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs
  );
  
  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * config.jitterFactor * Math.random();
  
  return exponentialDelay + jitter;
}

// Reconnection flow
async function reconnect(attempt: number): Promise<void> {
  if (attempt >= config.maxAttempts) {
    updateState({ 
      status: 'disconnected', 
      lastError: 'Max reconnection attempts exceeded' 
    });
    return;
  }
  
  updateState({ 
    status: 'reconnecting', 
    reconnectAttempt: attempt + 1 
  });
  
  const delay = calculateReconnectDelay(attempt, config);
  await sleep(delay);
  
  try {
    await connect();
    // Success: reset counter
    updateState({ reconnectAttempt: 0 });
  } catch (error) {
    await reconnect(attempt + 1);
  }
}
```

### 8.3 Heartbeat Mechanism
```typescript
// Heartbeat every 30s to detect stale connections

const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000;

class WebSocketManager {
  private heartbeatTimer?: NodeJS.Timeout;
  private pongReceived = false;
  
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        return;
      }
      
      // Send ping
      this.pongReceived = false;
      this.send({ type: 'ping', timestamp: Date.now() });
      
      // Wait for pong
      setTimeout(() => {
        if (!this.pongReceived) {
          // Connection stale, force reconnect
          this.handleStaleConnection();
        }
      }, HEARTBEAT_TIMEOUT);
      
    }, HEARTBEAT_INTERVAL);
  }
  
  private handlePong() {
    this.pongReceived = true;
    // Update latency metric
    const latency = Date.now() - this.lastPingTime;
    runtimeStore.setLatency(latency);
  }
  
  private handleStaleConnection() {
    this.disconnect();
    this.reconnect(0);
  }
}
```

### 8.4 Message Handling
```typescript
// types/websocket.ts

interface MessageHandlers {
  onAuthRequired: () => void;
  onAuthSuccess: (data: Extract<WSServerMessage, {type: 'auth_success'}>) => void;
  onAuthFailed: (data: Extract<WSServerMessage, {type: 'auth_failed'}>) => void;
  onMessage: (data: Extract<WSServerMessage, {type: 'message'}>) => void;
  onAgentUpdate: (data: Extract<WSServerMessage, {type: 'agent_update'}>) => void;
  onAgentList: (data: Extract<WSServerMessage, {type: 'agent_list'}>) => void;
  onError: (data: Extract<WSServerMessage, {type: 'error'}>) => void;
  onConnectionStatus: (data: Extract<WSServerMessage, {type: 'connection_status'}>) => void;
  onPong: () => void;
}

// Router pattern
class WebSocketRouter {
  private handlers: MessageHandlers;
  
  route(message: WSServerMessage) {
    switch (message.type) {
      case 'auth_required':
        return this.handlers.onAuthRequired();
      case 'auth_success':
        return this.handlers.onAuthSuccess(message);
      case 'auth_failed':
        return this.handlers.onAuthFailed(message);
      case 'message':
        return this.handlers.onMessage(message);
      case 'agent_update':
        return this.handlers.onAgentUpdate(message);
      case 'agent_list':
        return this.handlers.onAgentList(message);
      case 'error':
        return this.handlers.onError(message);
      case 'connection_status':
        return this.handlers.onConnectionStatus(message);
      case 'pong':
        return this.handlers.onPong();
      default:
        console.warn('Unknown message type:', (message as any).type);
    }
  }
}
```

---

## 9. Arquitetura de Código

### 9.1 Estrutura de Diretórios
```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Grupo: rotas públicas
│   │   ├── login/page.tsx
│   │   └── layout.tsx            # Minimal, sem sidebar
│   ├── (app)/                    # Grupo: rotas protegidas
│   │   ├── chat/page.tsx         # Chat principal
│   │   ├── agents/page.tsx       # Lista de agentes
│   │   ├── agents/[id]/page.tsx  # Chat com agente
│   │   ├── layout.tsx            # Com sidebar + header
│   │   └── page.tsx              # Redirect → /chat
│   ├── layout.tsx                # Root layout
│   └── globals.css
├── features/                     # Domínios organizados
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── LogoutButton.tsx
│   │   │   └── IdleWarning.tsx
│   │   ├── services/
│   │   │   └── auth-service.ts
│   │   ├── stores/
│   │   │   └── auth-store.ts
│   │   └── types.ts
│   ├── chat/
│   │   ├── components/
│   │   │   ├── ChatContainer.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── MessageBubble.tsx
│   │   ├── services/
│   │   │   └── chat-service.ts
│   │   ├── stores/
│   │   │   └── chat-store.ts
│   │   └── types.ts
│   └── agents/
│       ├── components/
│       │   ├── AgentList.tsx
│       │   ├── AgentCard.tsx
│       │   └── AgentStatus.tsx
│       ├── services/
│       │   └── agents-service.ts
│       ├── stores/
│       │   └── agents-store.ts
│       └── types.ts
├── adapters/                     # Backend adapters
│   ├── nanoclaw-adapter.ts
│   ├── openclaw-adapter.ts
│   └── mock-adapter.ts
├── components/ui/                # shadcn/ui (gerado)
├── lib/                          # Core utilities
│   ├── api.ts                    # HTTP client base
│   ├── websocket.ts              # WS manager
│   ├── security.ts               # Security utilities
│   ├── backend-factory.ts        # Adapter factory
│   └── utils.ts                  # General utilities
├── stores/                       # Global stores
│   └── runtime-store.ts
├── types/                        # Global types
│   ├── index.ts
│   ├── entities.ts
│   ├── websocket.ts
│   └── backend-adapter.ts
├── hooks/                        # Custom hooks
│   ├── use-auth.ts
│   ├── use-websocket.ts
│   ├── use-runtime.ts
│   └── use-idle-timeout.ts
└── middleware.ts                 # Route protection
```

### 9.2 Stack Tecnológica

| Camada | Tecnologia | Versão | Justificativa |
|--------|-----------|--------|---------------|
| Framework | Next.js | 15.x | ✅ SSR/SSG híbrido, middleware, API routes |
| Linguagem | TypeScript | 5.x | Strict mode, path aliases |
| Runtime | Node.js | 20.x | LTS |
| Styling | Tailwind CSS | 4.x | Utility-first |
| UI | shadcn/ui + Radix | latest | Acessível, themeable |
| Estado | Zustand | 5.x | Leve, TypeScript-native |
| Forms | React Hook Form | 7.x | Performance, validação |
| Schema | Zod | 3.x | Type-safe validation |
| Icons | Lucide React | latest | Consistente |
| Toast | Sonner | latest | UX moderna |
| HTTP | Native fetch | - | Leve, interceptors custom |
| WS | Native WebSocket | - | Controle total |
| Testes | Vitest + RTL | - | Unit + integration |

---

## 10. Segurança

### 10.1 Headers Obrigatórios
```typescript
// next.config.js

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js precisa
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self'",
      "connect-src 'self' wss: https:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### 10.2 Content Security Policy

**⚠️ TRADE-OFF V1:** `unsafe-eval` e `unsafe-inline` necessários para Next.js.
**Mitigação:** Subresource Integrity (SRI) nos scripts, nonce para inline.

### 10.3 Input Validation
```typescript
// Toda entrada validada com Zod

const LoginSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(100),
});

const ChatMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
});

// Sanitização de output
import DOMPurify from 'dompurify';

function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
```

### 10.4 Rate Limiting
```typescript
// lib/rate-limiter.ts (client-side coordination)

interface RateLimitState {
  attempts: number;
  windowStart: number;
  blockedUntil?: number;
}

const RATE_LIMIT = {
  login: { attempts: 5, windowMs: 15 * 60 * 1000 },
  wsMessage: { attempts: 100, windowMs: 60 * 1000 },
};

export function checkRateLimit(
  action: keyof typeof RATE_LIMIT,
  state: RateLimitState
): { allowed: boolean; retryAfter?: number } {
  const config = RATE_LIMIT[action];
  const now = Date.now();
  
  // Reset window
  if (now - state.windowStart > config.windowMs) {
    return { allowed: true };
  }
  
  // Check block
  if (state.blockedUntil && now < state.blockedUntil) {
    return { allowed: false, retryAfter: state.blockedUntil - now };
  }
  
  // Check attempts
  if (state.attempts >= config.attempts) {
    const blockedUntil = now + config.windowMs;
    return { allowed: false, retryAfter: config.windowMs };
  }
  
  return { allowed: true };
}
```

---

## 11. Deployment

### 11.1 Cenários Suportados

#### Cenário A: VPS Própria (Recomendado)
```
Internet ──▶ Nginx (HTTPS/WSS) ──┬──▶ Next.js (localhost:3000)
                                 └──▶ Backend (localhost:3001)
```

**✅ DECISÃO DEFINITIVA:** Documentação principal para VPS própria.

#### Cenário B: Separado (Frontend Vercel + Backend VPS)
```
Vercel (Next.js) ──CORS──▶ Backend VPS
```

**Configuração extra:** CORS headers, credentials handling.

#### Cenário C: Docker Compose (Desenvolvimento)
```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    environment:
      - CLAW_API_URL=http://backend:3001
    ports:
      - "3000:3000"
  
  backend:
    image: nanoclaw:latest
    ports:
      - "3001:3001"
  
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### 11.2 Setup Script
```bash
#!/bin/bash
# scripts/setup.sh

set -e

echo "🔧 CtrlClaw Setup"
echo "================="

# 1. Check requirements
command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose required"; exit 1; }

# 2. Collect configuration
read -p "Domain (e.g., claw.exemplo.com): " DOMAIN
read -p "Email for SSL: " EMAIL
read -p "Backend URL: " BACKEND_URL

# 3. Generate configs
mkdir -p ./deploy
cat > ./deploy/.env <<EOF
CLAW_API_URL=$BACKEND_URL
CLAW_WS_URL=${BACKEND_URL/http/ws}
BACKEND_ADAPTER=nanoclaw
DOMAIN=$DOMAIN
EOF

# 4. SSL certificate (Let's Encrypt)
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    certbot certonly --standalone -d $DOMAIN --agree-tos -m $EMAIL
fi

# 5. Validate
./scripts/validate-security.sh

echo "✅ Setup complete!"
echo "   URL: https://$DOMAIN"
```

### 11.3 Checklist de Segurança
```bash
#!/bin/bash
# scripts/validate-security.sh

echo "🔒 Security Validation"

# Check HTTPS
if ! curl -sSf "https://$DOMAIN" >/dev/null 2>&1; then
    echo "❌ HTTPS not working"
    exit 1
fi

# Check HSTS
curl -sI "https://$DOMAIN" | grep -q "Strict-Transport-Security" || {
    echo "❌ HSTS header missing"
    exit 1
}

# Check WSS
if ! timeout 5 bash -c "</dev/tcp/$DOMAIN/443" 2>/dev/null; then
    echo "❌ WebSocket port not accessible"
    exit 1
fi

# Check security headers
HEADERS=$(curl -sI "https://$DOMAIN")
for header in "X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection"; do
    echo "$HEADERS" | grep -q "$header" || echo "⚠️ $header missing"
done

echo "✅ Security checks passed"
```

---

## 12. Estados do Runtime

### 12.1 Connection State Machine
```
                    ┌─────────────┐
         ┌─────────│ disconnected│◀────────┐
         │         └──────┬──────┘         │
         │                │ connect()      │ close()
    close()               ▼                │
         │         ┌─────────────┐         │
         │    ┌───│ connecting  │         │
         │    │    └──────┬──────┘         │
         │    │           │ success        │
         │ timeout/       ▼                │
         │ error    ┌─────────────┐         │
         │         │  connected  │─────────┘
         │         └──────┬──────┘
         │                │ auth
         │                ▼
         │         ┌─────────────┐
         │    ┌───│   online    │
         │    │    └─────────────┘
         │    │
         └──reconnect
```

### 12.2 UI Indicators
| Estado | Ícone | Cor | Texto |
|--------|-------|-----|-------|
| `disconnected` | ● | cinza | "Offline" |
| `connecting` | ⟳ | amarelo | "Connecting..." |
| `connected` | ● | azul | "Authenticating..." |
| `online` | ● | verde | "Connected" |
| `reconnecting` | ⟳ | laranja | "Reconnecting (3/10)..." |
| `error` | ⚠ | vermelho | "Connection error" |

### 12.3 Execution States
| Estado | Indicador | Ação |
|--------|-----------|------|
| `idle` | - | Normal |
| `processing` | Pulse no avatar | Aguardar resposta |
| `waiting` | Spinner | Input bloqueado |
| `error` | Toast vermelho | Retry/Cancel |

---

## 13. Roadmap de Implementação

### ✅ Fase 0: Setup do Projeto (Concluída)
- [x] Setup Next.js + TypeScript strict
- [x] Configurar Tailwind + shadcn/ui
- [x] Implementar middleware de segurança
- [x] Configurar CSP e headers
- [x] Criar estrutura de pastas

### ✅ Fase 1: Backend Adapter Pattern (Concluída)
- [x] Definir interface ClawBackendAdapter
- [x] Estrutura NanoClawAdapter
- [x] Estrutura MockAdapter
- [x] Factory e configuração

### ✅ Fase 2: Autenticação (Concluída)
- [x] Implementar auth-service
- [x] Tela de login com validação
- [x] Fluxo completo de auth
- [x] Persistência sessionStorage com rehydration
- [x] Route guards

### ✅ Fase 3: WebSocket Infrastructure (Concluída)
- [x] Implementar lib/websocket.ts
- [x] Criar use-websocket.ts hook
- [x] Protocolo formalizado (auth_required/auth_success)
- [x] Reconnection logic
- [x] Heartbeat
- [x] Indicadores de conexão

### ✅ Fase 4: Layout Principal (Concluída)
- [x] Layout principal (sidebar + chat)
- [x] Chat placeholder
- [x] Estados de loading/empty

### ✅ Fase 5: Smart Setup (Concluída)
- [x] Discovery engine (detecção automática backend)
- [x] Env-manager (geração .env.local)
- [x] Setup wizard (/setup page)
- [x] CLI script (scripts/setup.mjs)
- [x] Login persistence fix
- [x] CSP/CORS fixes

### ✅ Fase 6: Chat Funcional (Concluída - Estável)

#### Etapa 1: Backend Mock com Chat (✅ Concluída)
- [x] Endpoint POST /api/conversations (criar conversa)
- [x] Endpoint GET /api/conversations (listar conversas)
- [x] Endpoint GET /api/conversations/:id/messages (histórico)
- [x] Endpoint POST /api/conversations/:id/messages (enviar)
- [x] Evento WebSocket `message` (receber resposta agente)
- [x] Persistência em memória
- [x] Documentação de spec: `docs/fase6-backend-spec.md`

#### Etapa 2: Chat Service & Store (✅ Concluída)
- [x] chat-store.ts (Zustand - estado local)
- [x] chat-service.ts (HTTP calls para backend)
- [x] useChatService hook (integração service-store)
- [x] Integração com WebSocket events (receber mensagens)

#### Etapa 3: Sidebar de Conversas (✅ Concluída)
- [x] ChatContainer integrado com service real
- [x] MessageList com scroll
- [x] MessageInput com envio via API
- [x] Estados de loading/empty
- [x] Fluxo ponta a ponta validado

#### Etapa 4: Sidebar & URL (✅ Concluída)
- [x] ConversationSidebar component
- [x] Lista de conversas ordenada por lastActivity
- [x] Criar nova conversa
- [x] Selecionar conversa (navegação via URL)
- [x] Preview da última mensagem
- [x] Suporte a `/chat/:conversationId` com reload

#### Etapa 5: Estabilização Funcional (✅ Concluída - Validado)
- [x] Deduplicação de mensagens (ID-based)
- [x] `setMessages` vs `addMessage` separados
- [x] `isHistoryLoaded` (carrega histórico uma vez)
- [x] WS deduplicação (`processedMessageIds`)
- [x] Race condition protection (refs em hooks)
- [x] Troca rápida de conversa sem misturar estado
- [x] lastActivity atualizado corretamente
- [x] **Checkpoint validado** (`docs/fase6-checkpoint.md`)

#### Etapa 6: UX Polish ✅ CONCLUÍDA
- [x] Toast notifications (success, error, warning, info)
- [x] Loading states granulares (sending, loading history)
- [x] Retry automático com exponential backoff (3 tentativas)
- [x] Feedback visual de status (pending, sent, delivered, failed)
- [x] Animações (fadeIn para mensagens novas)
- [x] Estados vazios informativos
- [x] Offline indicator no header

### 🔄 Fase 7: Memória, Contexto e Agentes (Em Andamento)

**Objetivo:** Transformar de chat isolado para sistema com memória operacional útil.

**Escopo (Ajustado - Segurança Primeiro):**

#### 7.1 IndexedDB (Metadados Apenas) ✅ IMPLEMENTADO
- [x] `ConversationMeta`: id, title, tags[], notes, agentId, lastActivity
- [x] `ConversationSummary`: conversationId, summaryText (max 500chars)
- [x] `SearchKeywords`: conversationId, keywords[] (max 20)
- [x] `IndexState`: lastSync, version
- [x] **❌ NÃO armazena:** mensagens completas, searchText irrestrito
- [x] Limites de segurança: 20 keywords, 500 chars resumo, 1000 conversas

#### 7.2 Pipeline de Resumo ✅ IMPLEMENTADO
- [x] `MockSummarizer`: geração extrativa de resumos
- [x] Extração de keywords (frequência, stopwords)
- [x] Validação de limites
- [x] Indexação completa de conversas

#### 7.3 Context Window Management ✅ IMPLEMENTADO
- [x] Algoritmo sliding window com limites
- [x] MAX_RECENT_MESSAGES: 10
- [x] MAX_SUMMARY_CHARS: 500
- [x] TOTAL_CONTEXT_MAX_CHARS: 3000
- [x] Truncamento previsível e documentado
- [x] `ContextService`: montagem e formatação

#### 7.4 Auto-Context Visível e Controlável ✅ IMPLEMENTADO
- [x] `ContextPanel` component
- [x] Badge de status: Active, Truncated, Loading
- [x] Stats: mensagens, tokens, caracteres
- [x] Progress bar de uso
- [x] Resumo expansível
- [x] Lista de mensagens recentes
- [x] Botões: Reload, Clear Context

#### 7.5 Busca Local Operacional ✅ IMPLEMENTADO
- [x] `ConversationSearch` component
- [x] Busca por keywords (max 20 por conversa)
- [x] Filtros por tags
- [x] Ordenação por recência
- [x] **Documentado:** Busca operacional, NÃO semântica

#### 7.6 Integração com Agentes 🔄 PENDENTE
- [ ] Injeção de contexto resumido nas mensagens
- [ ] Integração com ChatContainer
- [ ] Auto-indexação de conversas

**Fora de escopo (Fases Futuras):**
- Embeddings locais (pesado) → Fase 8+
- Busca semântica real → Fase 8+
- Vector DB → Fase 8+
- Memória global do usuário → Fase 9+

### ⏳ Fase 8: Responsividade & Acessibilidade (Futura)
- [ ] Layout responsivo para mobile
- [ ] Acessibilidade (WCAG 2.1 AA)
- [ ] Keyboard navigation
- [ ] Screen reader support

### ⏳ Fase 9: Deployment & Produção (Futura)
- [ ] Docker Compose setup
- [ ] Scripts de instalação automatizados
- [ ] Nginx config otimizado
- [ ] SSL/Let's Encrypt automation
- [ ] Documentação de deployment
- [ ] Testes end-to-end

### ⏳ Fase 9: Deployment (Futura)
- [ ] Docker Compose setup
- [ ] Scripts de instalação
- [ ] Nginx config
- [ ] SSL automation
- [ ] Documentação
- [ ] Testes end-to-end

---

## 14. Decisões Definitivas vs Trade-offs

### ✅ DECISÕES DEFINITIVAS

| # | Decisão | Justificativa |
|---|---------|---------------|
| 1 | Next.js build normal (não static export) | SSR, middleware, API routes necessários |
| 2 | Arquitetura com Backend Adapter Pattern | Suporte a múltiplos backends desde o início |
| 3 | Nenhuma persistência local de conteúdo sensível | Segurança primeiro, mensagens apenas em memória |
| 4 | Protocolo WebSocket formalizado e versionado | Evolução controlada, backward compatibility |
| 5 | VPS própria como deployment primário | Controle total, segurança máxima |
| 6 | TypeScript strict mode | Type safety como requisito |
| 7 | Zustand para estado | Simplicidade, performance, TypeScript-native |
| 8 | React Hook Form + Zod | Validação type-safe, UX consistente |

### ⚠️ TRADE-OFFS V1 (Com migration path)

| # | Trade-off | Limitação | Migration V2 |
|---|-----------|-----------|--------------|
| 1 | Token storage: Memory/sessionStorage | Perda de sessão em reload | httpOnly cookie via proxy/API route |
| 2 | NanoClaw adapter como único implementado | Acoplamento temporário | Implementar OpenClaw adapter |
| 3 | CSP com unsafe-eval/inline | Necessário para Next.js | Nonce + SRI |
| 4 | Sem persistência offline | Requer conexão para histórico | IndexedDB criptografado (opt-in) |
| 5 | Sem refresh token | Sessão expira em 24h | Implementar refresh rotation |

### ❓ PENDENTES (Pré-implementação)

| # | Questão | Status |
|---|---------|--------|
| 1 | Backend realmente não suporta cookies? | Confirmar com documentação NanoClaw |
| 2 | Rate limiting implementado no backend? | Verificar headers 429 |
| 3 | CORS configurado para domínios específicos? | Definir whitelist |
| 4 | SSL certificate automation (Let's Encrypt)? | Confirmar processo |

---

## 15. Referências

- [OWASP Top 10 2025](https://owasp.org/Top10/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [WebSocket Security Best Practices](https://christian-schneider.net/CrossSiteWebSocketHijacking.html)

---

## 16. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-05 | Initial specification |
| 1.1.0 | 2026-04-05 | Review: token storage analysis, SSR decision, backend adapter, security decisions |

---

**Status:** Aguardando revisão final para aprovação.
