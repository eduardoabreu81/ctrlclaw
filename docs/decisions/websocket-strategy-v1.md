# ADR: WebSocket Strategy V1

> **Status:** ✅ DECISÃO FECHADA  
> **Data:** 2026-04-07  
> **Decisores:** Time CtrlClaw

---

## Resumo Executivo

| Aspecto | Decisão |
|---------|---------|
| **Auth Method** | message-based |
| **Max Reconnection Attempts** | 10 |
| **Base Delay** | 1 segundo |
| **Max Delay** | 30 segundos |
| **Heartbeat Interval** | 30 segundos |
| **Heartbeat Timeout** | 10 segundos |
| **Topics Padrão** | messages, agents, system |

---

## Decisão

### Parâmetros Definidos

| Parâmetro | Valor | Nota |
|-----------|-------|------|
| **Auth Method** | message-based | Envia token via mensagem após connect |
| **Max Reconnection Attempts** | 10 | Após exceder, requer ação manual |
| **Base Delay** | 1s | Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s... |
| **Max Delay** | 30s | Cap no backoff |
| **Heartbeat Interval** | 30s | Ping a cada 30s |
| **Heartbeat Timeout** | 10s | Timeout para receber pong |
| **Topics** | messages, agents, system | Subscrição padrão após auth |

### Cálculo de Delays (Exemplo)

| Tentativa | Delay Base | Com Jitter (30%) |
|-----------|------------|------------------|
| 1 | 1s | 1.0s - 1.3s |
| 2 | 2s | 2.0s - 2.6s |
| 3 | 4s | 4.0s - 5.2s |
| 4 | 8s | 8.0s - 10.4s |
| 5 | 16s | 16.0s - 20.8s |
| 6+ | 30s | 30.0s - 39.0s |

---

## Regras Obrigatórias

### 1. ❌ NUNCA Usar Query Param para Token

**Proibido:**
```
wss://claw.exemplo.com/?token=abc123  # NUNCA fazer isso
```

**Obrigatório:**
```typescript
// 1. Conectar sem token
ws = new WebSocket('wss://claw.exemplo.com/?v=1');

// 2. Aguardar auth_required
// 3. Enviar token via mensagem
ws.send(JSON.stringify({
  type: 'authenticate',
  token: token,  // Do sessionStorage (ADR 1, 2)
  id: crypto.randomUUID()
}));
```

**Razão:** Query params são logados em servidores proxies, histórico, etc.

### 2. ❌ Falha de Autenticação NÃO Entra em Loop

**Cenário:** Recebe `auth_failed` do servidor

**Comportamento Correto:**
```
auth_failed recebido
       ↓
  Desconectar WS
       ↓
  Limpar token inválido
       ↓
  Redirecionar /login
       ↓
  NÃO tentar reconectar automaticamente
```

**Proibido:** Tentar reconectar com mesmo token após `auth_failed`.

### 3. ✅ Reconexão Automática - Apenas Falha de Conexão

**Reconecta automaticamente:**
- Connection timeout
- Network error
- Server disconnect
- Heartbeat timeout

**NÃO reconecta automaticamente:**
- `auth_failed`
- `AUTH_EXPIRED_TOKEN`
- `AUTH_INVALID_TOKEN`
- Logout explícito
- `disconnect()` chamado pelo código

```typescript
// Pseudocódigo
if (error.code === 'AUTH_INVALID_TOKEN' || error.code === 'AUTH_EXPIRED_TOKEN') {
  // NÃO reconectar
  logout();
  redirect('/login');
} else {
  // Reconectar com backoff
  scheduleReconnect();
}
```

### 4. ✅ Envio Durante Reconnect - Explícito e Controlado

**Estados de Envio:**

| Estado | Comportamento | UX |
|--------|---------------|-----|
| `online` | Envia normalmente | Input habilitado |
| `connecting` | ⭐ Enfileira mensagens | Input desabilitado, spinner |
| `authenticating` | ⭐ Enfileira mensagens | "Autenticando..." |
| `reconnecting` | ⭐ Enfileira mensagens | "Reconectando..." |
| `disconnected` | ❌ Não envia, erro | "Offline - clique para reconectar" |

**Regra:** Mensagens enviadas durante reconexão são enfileiradas e enviadas quando voltar a `online`.

```typescript
interface QueuedMessage {
  message: WSClientMessage;
  timestamp: number;
  maxRetries: number;
}

// Durante reconnect, adiciona à fila
if (status !== 'online') {
  messageQueue.push({ message, timestamp: Date.now(), maxRetries: 3 });
  return;
}

// Ao voltar online, flush da fila
onStatusChange('online', () => {
  flushMessageQueue();
});
```

**Limite da fila:** Máximo 100 mensagens. Se exceder, mensagens mais antigas são descartadas com warning.

---

## Protocolo de Handshake

```
┌─────────────┐
│  WS Connect │──▶ wss://claw.exemplo.com/?v=1
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ ← auth_required │ { type: "auth_required", protocol: "1" }
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ → authenticate  │ { type: "authenticate", token: "...", id: "uuid" }
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│success │ │  failed  │
└───┬────┘ └────┬─────┘
    │           │
    ▼           ▼
┌──────────┐  ┌──────────────┐
│ subscribe│  │ NO reconnect │
│ messages │  │ Redirect     │
│ agents   │  │ /login       │
│ system   │  │              │
└────┬─────┘  └──────────────┘
     │
     ▼
┌────────┐
│ ONLINE │◀── Heartbeat (30s)
└────────┘
```

---

## Estados de Conexão (UI)

| Estado | Ícone | Cor | Texto | Ações Permitidas |
|--------|-------|-----|-------|------------------|
| `disconnected` | ● | Cinza | "Offline" | Reconnect manual, ver histórico |
| `connecting` | ⟳ | Amarelo | "Conectando..." | Nenhuma (input disabled) |
| `authenticating` | ● | Azul | "Autenticando..." | Nenhuma |
| `online` | ● | Verde | "Conectado" | Todas |
| `reconnecting` | ⟳ | Laranja | "Reconectando (3/10)..." | Ver histórico, cancelar reconnect |

---

## Mensagens (TypeScript)

### Client → Server

```typescript
type WSClientMessage =
  | { type: 'authenticate'; token: string; id: string }
  | { type: 'subscribe'; topics: WSTopic[]; id: string }
  | { type: 'unsubscribe'; topics: WSTopic[]; id: string }
  | { type: 'ping'; timestamp: number }
  | { type: 'chat_message'; content: string; conversationId?: string; id: string }
  | { type: 'ack'; messageId: string };

type WSTopic = 'messages' | 'agents' | 'system';
```

### Server → Client

```typescript
type WSServerMessage =
  | { type: 'auth_required'; protocol: string }
  | { type: 'auth_success'; session: { username: string; expiresAt: string }; correlationId?: string }
  | { type: 'auth_failed'; reason: string; code: WSErrorCode; correlationId?: string }
  | { type: 'subscribed'; topics: WSTopic[]; correlationId?: string }
  | { type: 'message'; data: Message; id: string }
  | { type: 'agent_update'; data: Agent }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; code: WSErrorCode; message: string; correlationId?: string };
```

---

## Implementação

### Interface do Serviço

```typescript
// src/lib/services/interfaces.ts (já definido)
interface IWebSocketService {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: WSClientMessage): void;
  onMessage(handler: (message: WSServerMessage) => void): () => void;
  onConnectionChange(handler: (status: ConnectionStatus) => void): () => void;
  getConnectionStatus(): ConnectionStatus;
  isReady(): boolean;
  reconnect(): Promise<void>;
  subscribe(topics: WSTopic[]): void;
  unsubscribe(topics: WSTopic[]): void;
}

type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'authenticating' 
  | 'online' 
  | 'reconnecting' 
  | 'error';
```

### Configuração

```typescript
// src/lib/websocket.ts
const WS_CONFIG = {
  reconnect: {
    maxAttempts: 10,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.3,
  },
  heartbeat: {
    intervalMs: 30000,
    timeoutMs: 10000,
  },
  messageQueue: {
    maxSize: 100,
    maxAgeMs: 5 * 60 * 1000, // 5 minutos
  },
};
```

---

## Trade-offs

| Aspecto | Impacto | Mitigação |
|---------|---------|-----------|
| **Message-based auth** | Token em memória JS (XSS risk) | CSP strict, TLS, short TTL |
| **10 tentativas** | Pode demorar ~5min para desistir | UX mostra progresso, permite cancelar |
| **30s heartbeat** | Overhead mínimo | Detecta falhas em tempo razoável |
| **Fila de mensagens** | Memória usada durante reconnect | Limite de 100 msgs, timeout 5min |

---

## Impacto na V1

| Aspecto | Avaliação |
|---------|-----------|
| UX | ⭐⭐⭐⭐⭐ Reconexão automática, status claro, fila de mensagens |
| Segurança | ⭐⭐⭐ TLS, token em memória (trade-off documentado) |
| Resiliência | ⭐⭐⭐⭐⭐ Reconexão inteligente, heartbeat, sem loops |
| Complexidade | ⭐⭐⭐⭐ Gerenciamento de estado, fila, heartbeat |

---

## Impacto Futuro

Quando migrarmos para cookie-based auth (v2):
- Auth method pode simplificar (cookie automático)
- Protocolo handshake pode ser otimizado
- Estados permanecem os mesmos
- Fila de mensagens continua necessária

---

## Checklist de Implementação

- [x] Decisão registrada neste ADR
- [x] Parâmetros definidos
- [x] Regras obrigatórias documentadas
- [ ] Implementar WebSocketManager
- [ ] Implementar reconnection logic
- [ ] Implementar heartbeat
- [ ] Implementar message queue
- [ ] Implementar estado 'authenticating'
- [ ] Criar hook useWebSocket
- [ ] Componente ConnectionStatus
- [ ] Testar cenários: reconnect, auth_failed, queue flush

---

## Registro de Decisão

| Data | Evento | Resultado |
|------|--------|-----------|
| 2026-04-07 | Decisão arquitetural | Aprovados todos os parâmetros |
| 2026-04-07 | Regras definidas | Sem query param, sem loops, queue explícita |

---

**Status:** ✅ DECISÃO FECHADA

**Próximo passo:** Revisar ADR 4 (Deployment Strategy)
