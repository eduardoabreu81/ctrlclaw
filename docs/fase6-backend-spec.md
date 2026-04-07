# Backend Spec - Fase 6: Chat Funcional

**Status:** Mock implementado como referência da fase  
**Nota:** Estes contratos são especificação da fase, não API definitiva do produto.  
**Data:** 2026-04-07  

---

## Visão Geral

Este documento define os contratos implementados no backend mock para a **Fase 6: Chat Funcional**.

**Importante:** O backend real (NanoClaw) pode implementar endpoints diferentes. O adapter deverá fazer o mapeamento necessário.

---

## 1. ENDPOINTS IMPLEMENTADOS NO MOCK

### 1.1 Auth (Pré-existentes)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login com username/password |
| GET | `/api/auth/me` | Validar sessão atual |
| GET | `/api/agents` | Listar agentes disponíveis |

### 1.2 Chat (Novos - Fase 6)

#### Criar Conversa
```http
POST /api/conversations
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Nome da conversa",
  "agentId": "agent-1"  // opcional
}

Response 200:
{
  "conversation": {
    "id": "conv-abc123",
    "title": "Nome da conversa",
    "agentId": "agent-1",
    "createdAt": "2026-04-07T12:00:00Z",
    "lastActivity": "2026-04-07T12:00:00Z"
  }
}
```

#### Listar Conversas
```http
GET /api/conversations
Authorization: Bearer {token}

Response 200:
{
  "conversations": [
    {
      "id": "conv-abc123",
      "title": "Nome da conversa",
      "agentId": "agent-1",
      "createdAt": "2026-04-07T12:00:00Z",
      "lastActivity": "2026-04-07T12:30:00Z"
    }
  ]
}
```

#### Carregar Histórico
```http
GET /api/conversations/:id/messages
Authorization: Bearer {token}

Response 200:
{
  "messages": [
    {
      "id": "msg-001",
      "conversationId": "conv-abc123",
      "sender": "user",
      "senderName": "admin",
      "content": "Olá!",
      "timestamp": "2026-04-07T12:00:00Z",
      "status": "delivered",
      "type": "text"
    },
    {
      "id": "msg-002",
      "conversationId": "conv-abc123",
      "sender": "agent",
      "senderName": "Claw",
      "content": "Recebi: \"Olá!\"",
      "timestamp": "2026-04-07T12:00:01Z",
      "status": "delivered",
      "type": "text"
    }
  ],
  "hasMore": false
}
```

#### Enviar Mensagem
```http
POST /api/conversations/:id/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Mensagem do usuário"
}

Response 200:
{
  "message": {
    "id": "msg-003",
    "conversationId": "conv-abc123",
    "sender": "user",
    "senderName": "admin",
    "content": "Mensagem do usuário",
    "timestamp": "2026-04-07T12:05:00Z",
    "status": "sent",
    "type": "text"
  },
  "accepted": true
}
```

**Nota:** Após envio, o mock simula resposta do agente via WebSocket em 1-2s.

---

## 2. WEBSOCKET

### 2.1 Evento Mínimo Obrigatório (Fase 6)

#### Receber Mensagem do Agente
```typescript
// Server → Client
{
  "type": "message",
  "data": {
    "id": "msg-004",
    "conversationId": "conv-abc123",
    "sender": "agent",
    "senderName": "Claw",
    "content": "Resposta do agente",
    "timestamp": "2026-04-07T12:05:02Z",
    "status": "delivered",
    "type": "text"
  }
}
```

### 2.2 Eventos de Controle (Pré-existentes)

| Evento | Direção | Descrição |
|--------|---------|-----------|
| `auth_required` | S→C | Solicita autenticação |
| `auth_success` | S→C | Autenticação confirmada |
| `auth_failed` | S→C | Autenticação falhou |
| `ping` | C→S | Keep-alive cliente |
| `pong` | S→C | Resposta keep-alive |
| `connection_status` | S→C | Status da conexão |

### 2.3 Comportamento no Mock

1. Cliente conecta → recebe `auth_required`
2. Cliente autentica → recebe `auth_success`
3. Mensagens HTTP são processadas e respondidas
4. Respostas do agente são enviadas via WS `message` event

---

## 3. PERSISTÊNCIA NO MOCK

### 3.1 Armazenamento

**Tipo:** Memória volátil (Map/Array)  
**Escopo:** Persistente enquanto servidor rodar  
**Reset:** Reiniciar o servidor limpa os dados

### 3.2 Estruturas

```typescript
// Conversation
{
  id: string;
  title: string;
  agentId: string | null;
  createdAt: ISOString;
  lastActivity: ISOString;
  createdBy: string;
}

// Message
{
  id: string;
  conversationId: string;
  sender: 'user' | 'agent';
  senderName: string;
  content: string;
  timestamp: ISOString;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  type: 'text' | 'error';
}
```

---

## 4. DEPENDÊNCIAS DO BACKEND REAL

### 4.1 O que Foi Implementado no Mock

- ✅ Endpoints HTTP de chat
- ✅ Evento WebSocket `message`
- ✅ Persistência em memória
- ✅ Resposta automática do agente
- ✅ Ordenação por lastActivity

### 4.2 O que Depende de Confirmação no Backend Real

| Feature | Mock | Backend Real | Status |
|---------|------|--------------|--------|
| Endpoints HTTP | `/api/conversations/*` | ❓ Confirmar | Pode ser diferente |
| Evento `message` | Implementado | ❓ Confirmar | Pode ter nome diferente |
| Autenticação WS | Token simples | ❓ Confirmar | Pode usar outro método |
| Persistência | Memória | ❓ Banco real | Deve persistir entre restarts |
| Escalabilidade | Single-user | ❓ Confirmar | Deve suportar múltiplos usuários |

**Decisão:** Se backend real não tiver chat, mock continua como fallback.

---

## 5. ADAPTER: MAPEAMENTO FUTURO

### 5.1 Exemplo de Mapeamento

Se NanoClaw tiver endpoints diferentes:

```typescript
// Mock: POST /api/conversations
// Real:  POST /v1/chat/threads

class NanoClawAdapter {
  async createConversation(data) {
    const response = await this.post('/v1/chat/threads', {
      name: data.title,           // mapeamento de campo
      assistant_id: data.agentId  // nome diferente
    });
    
    return {
      id: response.thread_id,           // campo diferente
      title: response.name,
      agentId: response.assistant_id,
      // ...
    };
  }
}
```

### 5.2 Interface Abstrata (Preparada)

```typescript
interface ChatAdapter {
  createConversation(data: CreateConversationData): Promise<Conversation>;
  listConversations(): Promise<Conversation[]>;
  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, content: string): Promise<Message>;
}
```

---

## 6. DECISÕES DOCUMENTADAS

### Decisão 1: Resposta do Agente via WS
**Contexto:** Mensagem HTTP envia, resposta vem via WS.  
**Decisão:** HTTP retorna imediatamente com `accepted: true`, resposta do agente chega via WS `message` event.  
**Motivo:** UX mais responsiva, compatível com padrões de chat realtime.

### Decisão 2: Simulação de Delay
**Contexto:** Mock precisa simular tempo de processamento do agente.  
**Decisão:** Delay de 1-2s aleatório antes de enviar resposta via WS.  
**Motivo:** Simular realismo sem complicar.

### Decisão 3: Persistência em Memória
**Contexto:** Onde armazenar dados no mock?  
**Decisão:** Map/Array em memória, volátil.  
**Motivo:** Suficiente para validar fluxo da fase, sem overhead de banco.

### Decisão 4: Status da Mensagem
**Contexto:** Quais status implementar?  
**Decisão:** `sent` (HTTP retorna) → `delivered` (WS confirma).  
**Fora de escopo:** `read` receipts, `failed` com retry automático.

---

## 7. CHECKLIST DA FASE 6

### Etapa 1: Backend Mock ✅ CONCLUÍDA
- [x] Endpoint POST /api/conversations
- [x] Endpoint GET /api/conversations
- [x] Endpoint GET /api/conversations/:id/messages
- [x] Endpoint POST /api/conversations/:id/messages
- [x] Evento WebSocket `message`
- [x] Persistência em memória
- [x] Resposta automática do agente
- [x] Documentação de spec

### Etapa 2: Frontend Service & Store ✅ CONCLUÍDA
- [x] `chat-service.ts` implementado (HTTP API)
- [x] `useChatService` hook (integração service-store)
- [x] `ChatContainer` atualizado (usa service real)
- [x] Fluxo ponta a ponta:
  - [x] Criar conversa → POST /api/conversations
  - [x] Enviar mensagem → POST /api/conversations/:id/messages
  - [x] Receber resposta → WS event `message`
  - [x] Carregar histórico → GET /api/conversations/:id/messages

### Etapa 3: Sidebar de Conversas ✅ CONCLUÍDA
- [x] `ConversationSidebar` component
- [x] Lista de conversas ordenada por lastActivity
- [x] Botão "New Conversation"
- [x] Seleção de conversa ativa (navegação via URL)
- [x] Preview da última mensagem
- [x] Suporte a `/chat/:conversationId` com reload

### Etapa 4: Estabilização Funcional ✅ CONCLUÍDA
- [x] **Deduplicação de mensagens**: `addMessage` verifica duplicatas por ID
- [x] **Separação histórico vs novo**: `setMessages` (histórico) vs `addMessage` (novo)
- [x] **lastActivity correto**: Só atualiza em mensagens novas, não histórico
- [x] **Histórico carrega uma vez**: `isHistoryLoaded` + `markHistoryLoaded`
- [x] **WS deduplicação**: `processedMessageIds` evita mensagens duplicadas
- [x] **Race condition protection**: Refs em hooks para evitar chamadas duplicadas
- [x] **Troca rápida de conversa**: Estado isolado por conversa
- [x] **URL params funcional**: `/chat/:id` funciona com reload

### Etapa 5: UX Polish (PENDENTE)
- [ ] Toast notifications para erros
- [ ] Loading states mais granular
- [ ] Retry automático em falhas de rede

---

## 8. INTEGRAÇÃO REAL vs MOCK

### 8.1 Validado com Mock ✅

| Feature | Mock | Status |
|---------|------|--------|
| Criar conversa | POST /api/conversations | ✅ Funcional |
| Listar conversas | GET /api/conversations | ✅ Funcional |
| Enviar mensagem | POST /api/.../messages | ✅ Funcional |
| Receber resposta | WS `message` event | ✅ Funcional |
| Carregar histórico | GET /api/.../messages | ✅ Funcional |
| Ordenação | lastActivity desc | ✅ Funcional |

### 8.2 Divergências Documentadas

| Aspecto | Mock | Backend Real (Esperado) | Ação |
|---------|------|------------------------|------|
| Persistência | Memória volátil | Banco de dados | Adapter transparente |
| Resposta do agente | Echo imediato | Processamento real | UX: mostrar "typing" |
| Autenticação WS | Token simples | Confirmar com NanoClaw | Adapter ajustará |
| Paginação | Não implementado | Provavelmente terá | Implementar quando necessário |
| Rate limiting | Não aplicado | Provável | Adicionar retry no service |

### 8.3 Próximos Passos p/ Integração Real

1. **Confirmar endpoints NanoClaw:** Verificar se URLs e campos de payload são compatíveis
2. **Testar autenticação real:** Validar se WS auth funciona igual ao mock
3. **Implementar retry:** Adicionar lógica de retry no chat-service para erros de rede
4. **Paginação:** Implementar quando backend real suportar

---

## 9. DECISÕES DE IMPLEMENTAÇÃO

### Decisão 1: Separação service-store
**Contexto:** Como estruturar a camada de dados?  
**Decisão:** `chat-service` faz HTTP calls, `chat-store` mantém estado local, `useChatService` faz a ponte.  
**Motivo:** Separação de concerns - service é stateless, store é sincrono, hook é reativo.

### Decisão 2: Histórico lazy-load
**Contexto:** Quando carregar mensagens?  
**Decisão:** Carregar na primeira vez que a conversa é selecionada, não no startup.  
**Motivo:** Performance - evita carregar histórico de todas as conversas de uma vez.

### Decisão 3: Sem paginação inicial
**Contexto:** Histórico pode ser grande.  
**Decisão:** Implementar sem paginação primeiro, adicionar depois se necessário.  
**Motivo:** Foco na funcionalidade básica primeiro (diretriz da fase).

### Decisão 4: Deduplicação por ID
**Contexto:** Como evitar mensagens duplicadas?  
**Decisão:** Verificar `message.id` antes de adicionar (tanto no store quanto no WS).  
**Motivo:** Backend pode enviar mensagens duplicadas em certos cenários (reconnect, retry).

### Decisão 5: Separação addMessage vs setMessages
**Contexto:** Mensagens de histórico vs mensagens novas.  
**Decisão:** `setMessages` para histórico (não atualiza lastActivity), `addMessage` para novas.  
**Motivo:** lastActivity deve refletir atividade real, não carregamento de dados antigos.

---

## 10. LIMITAÇÕES CONHECIDAS

### 10.1 Limitações do Mock

| Limitação | Impacto | Mitigação |
|-----------|---------|-----------|
| Memória volátil | Dados perdidos ao reiniciar backend | Aceitável para desenvolvimento |
| Resposta imediata | Não testa cenários de "typing"/delay real | UX já preparada para estados futuros |
| Sem paginação | Histórico grande carrega tudo de uma vez | Implementar paginação quando necessário |
| Sem rate limiting | Não testa throttling | Implementar retry quando necessário |

### 10.2 Limitações do Frontend (Atuais)

| Limitação | Impacto | Planejado |
|-----------|---------|-----------|
| Sem retry automático | Falhas de rede quebram fluxo | Etapa 5: UX Polish |
| Sem toast de erro | Usuário não vê erros | Etapa 5: UX Polish |
| Sem paginação | Performance com histórico grande | Futuro: quando backend suportar |
| Mensagens em memória | Perde tudo ao recarregar | Por design (arquitetura) |

---

## 11. ARQUITETURA ATUAL (Fase 6 - Estabilização)

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │ /chat/:id       │────│ Conversation │────│   Chat      │ │
│  │ (reload func.)  │    │   Sidebar    │    │   Container │ │
│  └─────────────────┘    └──────────────┘    └──────┬──────┘ │
│                                                    │        │
│                         ┌──────────────────────────┘        │
│                         │                                   │
│  ┌──────────────────────▼──────┐    ┌─────────────────────┐ │
│  │      useChatService         │────│    chat-store       │ │
│  │  (bridge service-store)     │    │  • deduplication    │ │
│  └──────────────┬──────────────┘    │  • isHistoryLoaded  │ │
│                 │                   │  • setMessages      │ │
│  ┌──────────────▼──────────────┐    └─────────────────────┘ │
│  │       chat-service          │                            │
│  │  • HTTP API calls           │    ┌─────────────────────┐ │
│  │  • WS deduplication         │────│   WebSocketManager  │ │
│  │  • processedMessageIds      │    │  (message events)   │ │
│  └──────────────┬──────────────┘    └─────────────────────┘ │
│                 │                                           │
└─────────────────┼───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND MOCK                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  POST /api/  │    │  GET /api/   │    │  POST /api/  │  │
│  │ conversations│    │ conversations│    │ .../messages │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│                                                  │          │
│                              ┌───────────────────┘          │
│                              │                              │
│  ┌───────────────────────────▼──────────────┐               │
│  │         WebSocket Server                  │               │
│  │    (event 'message' → response)          │               │
│  └───────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

**Status:** ✅ Etapas 1-4 CONCLUÍDAS - Chat funcional e estável!

---

*Spec do backend mock - Fase 6*
