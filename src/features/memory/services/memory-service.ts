/**
 * Memory Service - CtrlClaw
 * 
 * Serviço de persistência operacional e gerenciamento de memória.
 * 
 * Responsabilidades:
 * - CRUD de metadados no IndexedDB
 * - Geração e armazenamento de resumos
 * - Extração de keywords
 * - Busca local operacional
 * 
 * Fase 7: Memória, Contexto e Agentes
 */

import {
  getDatabase,
  ConversationMeta,
  ConversationSummary,
  SearchKeywords,
  IndexState,
  validateKeywords,
  validateSummary,
  validateNotes,
  validateTags,
  INDEXEDDB_LIMITS,
} from '@/lib/indexeddb';
import { Message, Conversation } from '@/types/entities';

// ============================================
// Mock Summarizer (Simulação para Fase 7)
// ============================================

interface Summarizer {
  summarize(messages: Message[]): string;
  extractKeywords(messages: Message[]): string[];
}

class MockSummarizer implements Summarizer {
  /**
   * Gera resumo extrativo simples (primeiras frases das últimas msgs)
   */
  summarize(messages: Message[]): string {
    if (messages.length === 0) {
      return 'Empty conversation';
    }

    if (messages.length <= 5) {
      // Conversa curta: concatenar primeiras frases
      const content = messages
        .slice(0, 3)
        .map(m => m.content.split('.')[0])
        .join('. ');
      return content.substring(0, INDEXEDDB_LIMITS.MAX_SUMMARY_CHARS);
    }

    // Conversa longa: resumo estruturado
    const firstMessages = messages.slice(0, 2);
    const lastMessages = messages.slice(-3);
    
    const summary = [
      'Started with:',
      ...firstMessages.map(m => `- ${m.content.split('.')[0]}`),
      '...',
      'Recent:',
      ...lastMessages.map(m => `- ${m.content.split('.')[0]}`),
    ].join('. ');

    return validateSummary(summary);
  }

  /**
   * Extrai keywords simples (palavras mais frequentes, excluindo stopwords)
   */
  extractKeywords(messages: Message[]): string[] {
    const stopwords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can',
      'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between',
      'under', 'again', 'further', 'then', 'once', 'here', 'there',
      'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
      'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
      'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
      'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em',
      'para', 'com', 'por', 'no', 'na', 'se', 'que', 'e', 'mas',
    ]);

    // Extrair todas as palavras
    const allWords = messages
      .flatMap(m => m.content.toLowerCase().split(/\s+/))
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 3 && !stopwords.has(w));

    // Contar frequência
    const frequency = new Map<string, number>();
    allWords.forEach(word => {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    });

    // Ordenar por frequência e pegar top 20
    const sorted = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, INDEXEDDB_LIMITS.MAX_KEYWORDS_PER_CONVERSATION)
      .map(([word]) => word);

    return sorted;
  }
}

// Singleton
const summarizer = new MockSummarizer();

// ============================================
// Memory Service Class
// ============================================

class MemoryService {
  private db = getDatabase();

  // ============================================
  // Conversation Metadata CRUD
  // ============================================

  async saveConversationMeta(meta: ConversationMeta): Promise<void> {
    const validated: ConversationMeta = {
      ...meta,
      tags: validateTags(meta.tags),
      notes: validateNotes(meta.notes),
    };

    await this.db.conversationMeta.put(validated);
    await this.updateIndexState();
  }

  async getConversationMeta(conversationId: string): Promise<ConversationMeta | undefined> {
    return this.db.conversationMeta.get(conversationId);
  }

  async updateConversationMeta(
    conversationId: string,
    updates: Partial<Pick<ConversationMeta, 'title' | 'tags' | 'notes' | 'isArchived'>>
  ): Promise<void> {
    const existing = await this.getConversationMeta(conversationId);
    if (!existing) {
      throw new Error(`Conversation meta not found: ${conversationId}`);
    }

    const updated: ConversationMeta = {
      ...existing,
      ...updates,
      tags: updates.tags ? validateTags(updates.tags) : existing.tags,
      notes: updates.notes ? validateNotes(updates.notes) : existing.notes,
    };

    await this.db.conversationMeta.put(updated);
  }

  async deleteConversationMeta(conversationId: string): Promise<void> {
    await this.db.conversationMeta.delete(conversationId);
    await this.db.conversationSummary.delete(conversationId);
    await this.db.searchKeywords.delete(conversationId);
    await this.updateIndexState();
  }

  // ============================================
  // Summary Management
  // ============================================

  async generateAndSaveSummary(
    conversationId: string,
    messages: Message[]
  ): Promise<ConversationSummary> {
    // Gerar resumo
    const summaryText = summarizer.summarize(messages);
    
    // Calcular chunks (simplificado: 1 chunk a cada 20 mensagens)
    const chunkCount = Math.ceil(messages.length / 20);

    const summary: ConversationSummary = {
      conversationId,
      summaryText,
      chunkCount,
      lastUpdated: new Date().toISOString(),
      version: 1,
    };

    await this.db.conversationSummary.put(summary);
    return summary;
  }

  async getSummary(conversationId: string): Promise<ConversationSummary | undefined> {
    return this.db.conversationSummary.get(conversationId);
  }

  // ============================================
  // Keywords Management
  // ============================================

  async extractAndSaveKeywords(
    conversationId: string,
    messages: Message[]
  ): Promise<SearchKeywords> {
    const keywords = summarizer.extractKeywords(messages);

    const searchKeywords: SearchKeywords = {
      conversationId,
      keywords,
      extractedAt: new Date().toISOString(),
    };

    await this.db.searchKeywords.put(searchKeywords);
    return searchKeywords;
  }

  async getKeywords(conversationId: string): Promise<SearchKeywords | undefined> {
    return this.db.searchKeywords.get(conversationId);
  }

  // ============================================
  // Search Operations
  // ============================================

  /**
   * Busca operacional por keywords
   * NÃO é busca semântica - é busca por correspondência de palavras
   */
  async searchConversations(query: string): Promise<ConversationMeta[]> {
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      return this.listRecentConversations();
    }

    const queryWords = normalizedQuery.split(/\s+/);

    // Buscar em títulos
    const allMetas = await this.db.conversationMeta.toArray();
    
    const scored = allMetas.map(meta => {
      let score = 0;
      
      // Pontuação por título
      const titleLower = meta.title.toLowerCase();
      for (const word of queryWords) {
        if (titleLower.includes(word)) {
          score += 10; // Título tem peso maior
        }
      }

      return { meta, score };
    });

    // Buscar em keywords
    const allKeywords = await this.db.searchKeywords.toArray();
    
    for (const kw of allKeywords) {
      let kwScore = 0;
      for (const word of queryWords) {
        if (kw.keywords.some(k => k.includes(word))) {
          kwScore += 5;
        }
      }

      if (kwScore > 0) {
        const existing = scored.find(s => s.meta.id === kw.conversationId);
        if (existing) {
          existing.score += kwScore;
        }
      }
    }

    // Ordenar por score e depois por recência
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.meta.lastActivity).getTime() - new Date(a.meta.lastActivity).getTime();
      })
      .map(s => s.meta);
  }

  async searchByTag(tag: string): Promise<ConversationMeta[]> {
    const normalizedTag = tag.toLowerCase().trim();
    
    const allMetas = await this.db.conversationMeta.toArray();
    
    return allMetas
      .filter(meta => meta.tags.includes(normalizedTag))
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }

  async listRecentConversations(limit: number = 50): Promise<ConversationMeta[]> {
    return this.db.conversationMeta
      .orderBy('lastActivity')
      .reverse()
      .limit(limit)
      .toArray();
  }

  async listByAgent(agentId: string): Promise<ConversationMeta[]> {
    return this.db.conversationMeta
      .where('agentId')
      .equals(agentId)
      .sortBy('lastActivity');
  }

  // ============================================
  // Full Indexing Pipeline
  // ============================================

  async indexConversation(
    conversation: Conversation,
    messages: Message[]
  ): Promise<void> {
    // 1. Salvar metadados
    const meta: ConversationMeta = {
      id: conversation.id,
      title: conversation.title,
      tags: [], // Inicialmente vazio, usuário preenche
      notes: '',
      agentId: conversation.agentId || null,
      lastActivity: conversation.lastActivity,
      messageCount: messages.length,
      createdAt: conversation.createdAt,
      isArchived: false,
    };

    await this.saveConversationMeta(meta);

    // 2. Gerar e salvar resumo
    await this.generateAndSaveSummary(conversation.id, messages);

    // 3. Extrair e salvar keywords
    await this.extractAndSaveKeywords(conversation.id, messages);

    console.log('[MemoryService] Indexed conversation:', conversation.id);
  }

  async updateConversationIndex(
    conversationId: string,
    messages: Message[]
  ): Promise<void> {
    // Atualizar resumo e keywords
    await this.generateAndSaveSummary(conversationId, messages);
    await this.extractAndSaveKeywords(conversationId, messages);

    // Atualizar metadados
    const meta = await this.getConversationMeta(conversationId);
    if (meta) {
      meta.messageCount = messages.length;
      meta.lastActivity = new Date().toISOString();
      await this.saveConversationMeta(meta);
    }
  }

  // ============================================
  // Index State Management
  // ============================================

  private async updateIndexState(): Promise<void> {
    const count = await this.db.conversationMeta.count();
    
    const state: IndexState = {
      id: 'main',
      version: 1,
      lastSync: new Date().toISOString(),
      conversationCount: count,
    };

    await this.db.indexState.put(state);
  }

  async getIndexState(): Promise<IndexState | undefined> {
    return this.db.indexState.get('main');
  }

  // ============================================
  // Cleanup
  // ============================================

  async clearAllData(): Promise<void> {
    await this.db.conversationMeta.clear();
    await this.db.conversationSummary.clear();
    await this.db.searchKeywords.clear();
    await this.db.indexState.clear();
    console.log('[MemoryService] All IndexedDB data cleared');
  }

  async deleteOldConversations(olderThanDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const cutoffISO = cutoff.toISOString();

    const oldConversations = await this.db.conversationMeta
      .where('lastActivity')
      .below(cutoffISO)
      .toArray();

    for (const conv of oldConversations) {
      await this.deleteConversationMeta(conv.id);
    }

    return oldConversations.length;
  }
}

// Singleton
let memoryServiceInstance: MemoryService | null = null;

export function getMemoryService(): MemoryService {
  if (!memoryServiceInstance) {
    memoryServiceInstance = new MemoryService();
  }
  return memoryServiceInstance;
}

export function resetMemoryService(): void {
  memoryServiceInstance = null;
}

// Re-exportar tipos para conveniência
export type { ConversationMeta, ConversationSummary, SearchKeywords, IndexState } from '@/lib/indexeddb';

export { MemoryService };
