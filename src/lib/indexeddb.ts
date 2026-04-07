/**
 * IndexedDB Manager - CtrlClaw
 * 
 * Persistência operacional local para memória de conversas.
 * 
 * ⚠️ SEGURANÇA: Esta camada armazena APENAS metadados e resumos.
 * NUNCA armazena mensagens completas ou conteúdo sensível bruto.
 * 
 * Fase 7: Memória, Contexto e Agentes
 * 
 * Limites de segurança:
 * - Max 20 keywords por conversa
 * - Max 500 chars em resumos
 * - Max 1000 conversas indexadas
 * - Sem conteúdo bruto de mensagens
 */

import Dexie, { Table } from 'dexie';

// ============================================
// Interfaces (O que é PERMITIDO armazenar)
// ============================================

/**
 * Metadados da conversa - Informações operacionais
 * ✅ PERMITIDO: Títulos, tags, notas, metadados
 */
export interface ConversationMeta {
  id: string;                    // UUID da conversa
  title: string;                 // Título editável
  tags: string[];               // Max 10 tags
  notes: string;                // Notas do usuário (max 500chars)
  agentId: string | null;       // Agente associado
  lastActivity: string;         // ISO timestamp
  messageCount: number;         // Contador apenas (não as mensagens)
  createdAt: string;            // ISO timestamp
  isArchived: boolean;          // Flag de arquivo
}

/**
 * Resumo da conversa - Abstrato, não conteúdo bruto
 * ✅ PERMITIDO: Resumo textual limitado
 */
export interface ConversationSummary {
  conversationId: string;
  summaryText: string;          // Max 500 chars (truncado)
  chunkCount: number;           // Quantos chunks compõem o resumo
  lastUpdated: string;          // ISO timestamp
  version: number;              // Versão do resumo (para invalidação)
}

/**
 * Keywords para busca - Limitadas, extraídas
 * ✅ PERMITIDO: Max 20 palavras-chave por conversa
 */
export interface SearchKeywords {
  conversationId: string;
  keywords: string[];           // Max 20 palavras normalizadas
  extractedAt: string;          // ISO timestamp
}

/**
 * Estado do índice - Metadados técnicos
 * ✅ PERMITIDO: Informações de sincronização
 */
export interface IndexState {
  id: 'main';
  version: number;
  lastSync: string;             // ISO timestamp
  conversationCount: number;
}

// ============================================
// Configuração de Limites de Segurança
// ============================================

export const INDEXEDDB_LIMITS = {
  MAX_KEYWORDS_PER_CONVERSATION: 20,
  MAX_SUMMARY_CHARS: 500,
  MAX_NOTES_CHARS: 500,
  MAX_TAGS: 10,
  MAX_TAG_LENGTH: 30,
  MAX_CONVERSATIONS_INDEXED: 1000,
} as const;

// ============================================
// Database Class
// ============================================

export class CtrlClawDatabase extends Dexie {
  // Tabelas
  conversationMeta!: Table<ConversationMeta, string>;
  conversationSummary!: Table<ConversationSummary, string>;
  searchKeywords!: Table<SearchKeywords, string>;
  indexState!: Table<IndexState, string>;

  constructor() {
    super('ctrlclaw_db');

    this.version(1).stores({
      // Primary key é 'id' para ConversationMeta
      conversationMeta: 'id, agentId, lastActivity, isArchived',
      // Primary key é 'conversationId'
      conversationSummary: 'conversationId, lastUpdated',
      // Primary key é 'conversationId'
      searchKeywords: 'conversationId',
      // Primary key é 'id' (sempre 'main')
      indexState: 'id',
    });
  }
}

// Singleton instance
let dbInstance: CtrlClawDatabase | null = null;

export function getDatabase(): CtrlClawDatabase {
  if (!dbInstance) {
    dbInstance = new CtrlClawDatabase();
  }
  return dbInstance;
}

export function resetDatabase(): void {
  dbInstance = null;
}

// ============================================
// Validation Functions (Segurança)
// ============================================

export function validateKeywords(keywords: string[]): string[] {
  // Normalizar: lowercase, trim, remover duplicatas
  const normalized = keywords
    .map(k => k.toLowerCase().trim())
    .filter(k => k.length > 0)
    .filter((k, i, arr) => arr.indexOf(k) === i); // Remove duplicatas
  
  // Limitar a 20 keywords
  return normalized.slice(0, INDEXEDDB_LIMITS.MAX_KEYWORDS_PER_CONVERSATION);
}

export function validateSummary(summary: string): string {
  // Truncar a 500 chars
  if (summary.length <= INDEXEDDB_LIMITS.MAX_SUMMARY_CHARS) {
    return summary;
  }
  
  // Truncar em palavra completa
  const truncated = summary.substring(0, INDEXEDDB_LIMITS.MAX_SUMMARY_CHARS);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > INDEXEDDB_LIMITS.MAX_SUMMARY_CHARS * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

export function validateNotes(notes: string): string {
  if (notes.length <= INDEXEDDB_LIMITS.MAX_NOTES_CHARS) {
    return notes;
  }
  return notes.substring(0, INDEXEDDB_LIMITS.MAX_NOTES_CHARS - 3) + '...';
}

export function validateTags(tags: string[]): string[] {
  const normalized = tags
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0 && t.length <= INDEXEDDB_LIMITS.MAX_TAG_LENGTH)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, INDEXEDDB_LIMITS.MAX_TAGS);
  
  return normalized;
}

// ============================================
// Explicit Declaration of What is NOT Stored
// ============================================

/**
 * ❌ EXPLICITAMENTE NÃO ARMAZENADO NO IndexedDB:
 * 
 * 1. Message.content completo
 *    - Motivo: Conteúdo sensível, potencialmente grande
 *    - Alternativa: Buscar do backend sob demanda
 * 
 * 2. searchText irrestrito (conteúdo completo indexado)
 *    - Motivo: Exposição de dados sensíveis
 *    - Alternativa: Keywords limitadas (max 20)
 * 
 * 3. Chunks de mensagens
 *    - Motivo: Volume grande, redundante com backend
 *    - Alternativa: Resumo abstrato apenas
 * 
 * 4. Raw conversation content
 *    - Motivo: Não é índice operacional
 *    - Alternativa: Backend é source of truth
 * 
 * 5. Dados de telemetria/analytics
 *    - Motivo: Privacidade, fora de escopo
 *    - Alternativa: Não coletar
 */

export const EXPLICITLY_NOT_STORED = [
  'message.content',
  'message.fullText', 
  'searchText.unrestricted',
  'conversation.rawContent',
  'message.chunks',
  'telemetry.data',
  'analytics.events',
] as const;
