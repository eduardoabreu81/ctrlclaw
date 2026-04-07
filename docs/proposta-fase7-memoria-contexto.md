# Proposta: Fase 7 - Memória, Contexto e Agentes

**Data:** 2026-04-07  
**Status:** ✅ Aprovada (versão revisada)

---

## Ajustes Obrigatórios Incorporados

### 1. IndexedDB - O que VAI e o que NÃO VAI

#### ✅ O que VAI para IndexedDB (Seguro)

| Tabela | Campos | Limite |
|--------|--------|--------|
| `ConversationMeta` | id, title, tags[], notes, agentId, lastActivity, messageCount, createdAt | tags: max 10, notes: max 500 chars |
| `ConversationSummary` | conversationId, summaryText, chunkCount, lastUpdated, version | summary: max 500 chars |
| `SearchKeywords` | conversationId, keywords[], extractedAt | keywords: max 20 |
| `IndexState` | id, version, lastSync, conversationCount | - |

#### ❌ O que NÃO VAI para IndexedDB (Sensível ou Pesado)

| Item | Motivo | Alternativa |
|------|--------|-----------|
| **Mensagens completas** | Conteúdo sensível, potencialmente grande | Buscar do backend sob demanda |
| **searchText irrestrito** | Exposição de conteúdo completo | Keywords limitadas (max 20) |
| **Chunks de mensagens** | Volume grande, redundante com backend | Resumo apenas |
| **Raw conversation content** | Não é índice operacional | Backend |
| **Dados de telemetria** | Privacidade | Não coletar |

**Limite de segurança:** IndexedDB armazena apenas "índice operacional", nunca "conteúdo da conversa".

---

### 2. Context Window - Limites Explícitos

#### Algoritmo de Montagem de Contexto (COM LIMITES)

```typescript
const CONTEXT_LIMITS = {
  MAX_RECENT_MESSAGES: 10,        // Max mensagens recentes verbatim
  MAX_RECENT_TOKENS: 2000,        // Limite aproximado de tokens recentes
  MAX_SUMMARY_CHARS: 500,         // Tamanho máximo do resumo
  TOTAL_CONTEXT_MAX_CHARS: 3000,  // Limite total de contexto
};
```

#### Comportamento Documentado

| Cenário | Comportamento |
|---------|---------------|
| Conversa < 10 msgs | Tudo verbatim, sem resumo |
| Conversa 10-50 msgs | Resumo + últimas 10 msgs |
| Conversa > 50 msgs | Resumo (500chars) + últimas 10 msgs truncadas se necessário |
| Limite excedido | Truncamento previsível, indicador visível |

---

### 3. Auto-Context - Visível e Controlável

#### Interface de Controle de Contexto

A UI mostra:
- Badge de status: Active (verde), Truncated (amarelo), Loading (azul)
- Stats: "X de Y mensagens", "~Z tokens", "A/B chars"
- Progress bar de uso
- Resumo expansível
- Lista das últimas 5 mensagens (com "+N more")
- Botões: Reload Context, Clear Context

---

### 4. Busca Local - Escopo Explícito

#### O que é IMPLEMENTADO nesta fase

| Tipo | Descrição |
|------|-----------|
| **Keywords** | Busca em título + keywords indexadas |
| **Tags** | Filtro por tags definidas pelo usuário |
| **Filtros temporais** | Por período (últimos 7/30/90 dias) |
| **Filtro de agente** | Por agente específico |
| **Recência** | Ordenação por lastActivity |

#### O que NÃO é IMPLEMENTADO (documentado para fases futuras)

| Tipo | Motivo | Fase Futura |
|------|--------|-------------|
| **Busca semântica** | Requer embeddings | Fase 8+ |
| **Busca por similaridade** | Requer vector DB | Fase 8+ |
| **Busca em conteúdo completo** | Sensível, volumoso | Fora de escopo |
| **Auto-sugestão inteligente** | Requer NLP | Fase 9+ |

---

## Implementação

### IndexedDB Schema

```typescript
// ✅ PERMITIDO: Metadados operacionais
interface ConversationMeta {
  id: string;
  title: string;
  tags: string[];           // Max 10 tags
  notes: string;            // Max 500 chars
  agentId: string | null;
  lastActivity: string;
  messageCount: number;
  createdAt: string;
  isArchived: boolean;
}

// ✅ PERMITIDO: Resumo abstrato
interface ConversationSummary {
  conversationId: string;
  summaryText: string;      // Max 500 chars (truncado)
  chunkCount: number;
  lastUpdated: string;
  version: number;
}

// ✅ PERMITIDO: Keywords limitadas
interface SearchKeywords {
  conversationId: string;
  keywords: string[];       // Max 20 palavras-chave
  extractedAt: string;
}
```

### Geração de Resumo

**MockSummarizer (Fase 7):**
- Conversas ≤ 5 msgs: Concatena primeiras frases
- Conversas > 5 msgs: Estrutura "Started with... Recent:..."
- Limite: 500 chars com truncamento em palavra completa

### Contexto Formatado para Agente

```
[CONTEXT SUMMARY]
{resumo da conversa}

[RECENT MESSAGES]
{sender} ({time}): {content}
...

[CURRENT MESSAGE]
```

---

## Limites da Fase

| Limite | Valor | Razão |
|--------|-------|-------|
| Keywords por conversa | 20 | Evitar indexação massiva |
| Resumo | 500 chars | Limite de storage |
| Contexto total | 3000 chars | Limite de tokens estimado |
| Mensagens recentes | 10 | Balanceamento recência/custo |
| Conversas indexadas | 1000 | Performance IndexedDB |

---

## Checklist de Entrega Fase 7

- [x] IndexedDB schema com limites de segurança
- [x] MemoryService (CRUD + indexação)
- [x] ContextService (montagem com limites)
- [x] MockSummarizer (extrativo)
- [x] Validação de limites (keywords, resumo, notas)
- [x] ContextPanel component
- [x] ConversationSearch component
- [ ] Integração com ChatContainer (pendente)
- [ ] Auto-indexação de conversas (pendente)

---

*Proposta Fase 7: Memória, Contexto e Agentes - Versão Aprovada*
