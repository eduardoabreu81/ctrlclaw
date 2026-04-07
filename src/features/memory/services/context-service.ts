/**
 * Context Service - CtrlClaw
 * 
 * Serviço de montagem e gerenciamento de contexto para agentes.
 * 
 * Responsabilidades:
 * - Montar contexto a partir de resumo + mensagens recentes
 * - Respeitar limites de tamanho
 * - Truncamento previsível
 * - Fornecer estatísticas do contexto
 * 
 * Fase 7: Memória, Contexto e Agentes
 */

import { Message } from '@/types/entities';
import { getMemoryService } from './memory-service';

// ============================================
// Limites de Contexto (Explícitos)
// ============================================

export const CONTEXT_LIMITS = {
  MAX_RECENT_MESSAGES: 10,           // Max mensagens recentes verbatim
  MAX_SUMMARY_CHARS: 500,            // Max caracteres do resumo
  TOTAL_CONTEXT_MAX_CHARS: 3000,     // Max total de contexto
  ESTIMATED_CHARS_PER_TOKEN: 4,      // Estimativa conservadora
} as const;

// ============================================
// Interfaces
// ============================================

export interface AssembledContext {
  summary: string;
  recentMessages: Message[];
  wasTruncated: boolean;
  totalChars: number;
  stats: ContextStats;
  formattedContext: string;          // Contexto formatado para envio ao agente
}

export interface ContextStats {
  summaryChars: number;
  messageCount: number;
  totalMessagesAvailable: number;
  estimatedTokens: number;
  isWithinLimits: boolean;
}

// ============================================
// Context Service
// ============================================

class ContextService {
  private memoryService = getMemoryService();

  /**
   * Monta o contexto completo para uma conversa
   * Segue algoritmo: Resumo + Mensagens Recentes (com limites)
   */
  async assembleContext(
    conversationId: string,
    allMessages: Message[]
  ): Promise<AssembledContext | null> {
    // 1. Buscar resumo do IndexedDB
    const summaryRecord = await this.memoryService.getSummary(conversationId);
    const summary = summaryRecord?.summaryText || '';

    // 2. Selecionar mensagens recentes
    const recentSelection = this.selectRecentMessages(allMessages);

    // 3. Montar contexto com limites
    const assembled = this.buildContextWithLimits(
      summary,
      recentSelection,
      allMessages.length
    );

    return assembled;
  }

  /**
   * Seleciona mensagens recentes para inclusão
   */
  private selectRecentMessages(allMessages: Message[]): Message[] {
    if (allMessages.length <= CONTEXT_LIMITS.MAX_RECENT_MESSAGES) {
      // Conversa curta: incluir tudo
      return [...allMessages];
    }

    // Conversa longa: últimas N mensagens
    return allMessages.slice(-CONTEXT_LIMITS.MAX_RECENT_MESSAGES);
  }

  /**
   * Constrói contexto respeitando limites de tamanho
   */
  private buildContextWithLimits(
    summary: string,
    candidateMessages: Message[],
    totalMessagesAvailable: number
  ): AssembledContext {
    // 1. Truncar resumo se necessário
    const truncatedSummary = this.truncateSummary(summary);
    let usedChars = truncatedSummary.length;

    // 2. Selecionar mensagens que cabem no limite
    const includedMessages: Message[] = [];
    let wasTruncated = false;

    for (const message of candidateMessages) {
      const msgLength = message.content.length;
      
      // Verificar se cabe no limite total
      if (usedChars + msgLength > CONTEXT_LIMITS.TOTAL_CONTEXT_MAX_CHARS) {
        wasTruncated = true;
        break;
      }

      includedMessages.push(message);
      usedChars += msgLength;
    }

    // 3. Ordenar mensagens cronologicamente
    const orderedMessages = [...includedMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 4. Calcular estatísticas
    const stats: ContextStats = {
      summaryChars: truncatedSummary.length,
      messageCount: orderedMessages.length,
      totalMessagesAvailable,
      estimatedTokens: Math.ceil(usedChars / CONTEXT_LIMITS.ESTIMATED_CHARS_PER_TOKEN),
      isWithinLimits: usedChars <= CONTEXT_LIMITS.TOTAL_CONTEXT_MAX_CHARS,
    };

    // 5. Formatar contexto para envio
    const formattedContext = this.formatContextForAgent(
      truncatedSummary,
      orderedMessages
    );

    return {
      summary: truncatedSummary,
      recentMessages: orderedMessages,
      wasTruncated: wasTruncated || candidateMessages.length > includedMessages.length,
      totalChars: usedChars,
      stats,
      formattedContext,
    };
  }

  /**
   * Trunca resumo respeitando limite
   */
  private truncateSummary(summary: string): string {
    if (summary.length <= CONTEXT_LIMITS.MAX_SUMMARY_CHARS) {
      return summary;
    }

    // Truncar em palavra completa
    const truncated = summary.substring(0, CONTEXT_LIMITS.MAX_SUMMARY_CHARS);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > CONTEXT_LIMITS.MAX_SUMMARY_CHARS * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Formata contexto para envio ao agente
   */
  private formatContextForAgent(
    summary: string,
    messages: Message[]
  ): string {
    const parts: string[] = [];

    // Adicionar resumo se existir
    if (summary) {
      parts.push('[CONTEXT SUMMARY]');
      parts.push(summary);
      parts.push('');
    }

    // Adicionar mensagens recentes
    if (messages.length > 0) {
      parts.push('[RECENT MESSAGES]');
      
      for (const msg of messages) {
        const sender = msg.senderName || msg.sender;
        const time = new Date(msg.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        parts.push(`${sender} (${time}): ${msg.content}`);
      }
      
      parts.push('');
    }

    parts.push('[CURRENT MESSAGE]');

    return parts.join('\n');
  }

  /**
   * Calcula contexto simples (sem persistência)
   * Útil para conversas novas que ainda não foram indexadas
   */
  calculateSimpleContext(messages: Message[]): AssembledContext {
    // Sem resumo para conversas não indexadas
    const recentSelection = this.selectRecentMessages(messages);
    
    return this.buildContextWithLimits(
      '', // Sem resumo
      recentSelection,
      messages.length
    );
  }

  /**
   * Verifica se contexto precisa ser atualizado
   * (mensagens novas desde última montagem)
   */
  async shouldUpdateContext(
    conversationId: string,
    currentMessageCount: number
  ): Promise<boolean> {
    const meta = await this.memoryService.getConversationMeta(conversationId);
    
    if (!meta) {
      return true; // Nunca foi indexado
    }

    // Se aumentou o número de mensagens, atualizar
    return currentMessageCount > meta.messageCount;
  }

  /**
   * Limpa contexto (para funcionalidade "Limpar Contexto" da UI)
   */
  clearContext(): AssembledContext {
    return {
      summary: '',
      recentMessages: [],
      wasTruncated: false,
      totalChars: 0,
      stats: {
        summaryChars: 0,
        messageCount: 0,
        totalMessagesAvailable: 0,
        estimatedTokens: 0,
        isWithinLimits: true,
      },
      formattedContext: '[NEW CONVERSATION - NO CONTEXT]\n\n[CURRENT MESSAGE]',
    };
  }
}

// Singleton
let contextServiceInstance: ContextService | null = null;

export function getContextService(): ContextService {
  if (!contextServiceInstance) {
    contextServiceInstance = new ContextService();
  }
  return contextServiceInstance;
}

export function resetContextService(): void {
  contextServiceInstance = null;
}

export { ContextService };
