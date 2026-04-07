/**
 * Chat Service Hook - CtrlClaw
 * 
 * Hook para integração com chat-service.
 * Faz a ponte entre o chat-service (API) e o chat-store (estado local).
 * 
 * Fase 6 - Estabilização:
 * - Evita carregar histórico duplicado
 * - Gerencia loadedHistoryIds
 * - Cleanup adequado ao desmontar
 */

import { useEffect, useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chat-store';
import { getChatService } from '../services/chat-service';
import { useAuth } from '@/hooks/use-auth';

export function useChatService() {
  const { isAuthenticated } = useAuth();
  const store = useChatStore();
  const isLoadingRef = useRef(false); // Prevenir race conditions

  // Load conversations from backend on mount (once)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isLoadingRef.current) return; // Evitar chamadas duplicadas

    const loadConversations = async () => {
      isLoadingRef.current = true;
      try {
        const service = getChatService();
        const conversations = await service.listConversations();
        
        // Adicionar ao store (evitando duplicatas - lógica está no store)
        conversations.forEach(conv => {
          store.addConversation(conv);
        });
        
        console.log('[useChatService] Loaded', conversations.length, 'conversations');
      } catch (error) {
        console.error('[useChatService] Failed to load conversations:', error);
      } finally {
        isLoadingRef.current = false;
      }
    };

    loadConversations();
  }, [isAuthenticated]);

  // Create conversation via backend
  const createConversation = useCallback(async (agentId?: string) => {
    try {
      const service = getChatService();
      const conversation = await service.createConversation(agentId);
      
      // Marcar como ativa
      store.setActiveConversation(conversation.id);
      
      // Marcar histórico como "carregado" (nova conversa = vazia)
      store.markHistoryLoaded(conversation.id);
      
      return conversation;
    } catch (error) {
      console.error('[useChatService] Failed to create conversation:', error);
      throw error;
    }
  }, [store]);

  // Load history for a conversation (com proteção contra duplicatas)
  const loadHistory = useCallback(async (conversationId: string) => {
    // Verificar se já carregou
    if (store.isHistoryLoaded(conversationId)) {
      console.log('[useChatService] History already loaded for:', conversationId);
      return;
    }
    
    try {
      const service = getChatService();
      await service.loadHistory(conversationId);
    } catch (error) {
      console.error('[useChatService] Failed to load history:', error);
      throw error;
    }
  }, [store]);

  // Send message via backend
  const sendMessage = useCallback(async (content: string, conversationId?: string) => {
    try {
      const service = getChatService();
      await service.sendMessage(content, conversationId);
    } catch (error) {
      console.error('[useChatService] Failed to send message:', error);
      throw error;
    }
  }, []);

  // Set active conversation com validação
  const setActiveConversation = useCallback((id: string | null) => {
    store.setActiveConversation(id);
  }, [store]);

  return {
    // Actions
    createConversation,
    loadHistory,
    sendMessage,
    setActiveConversation,
    
    // State
    conversations: store.conversations,
    activeConversationId: store.activeConversationId,
    isLoadingHistory: store.isLoadingHistory,
    isHistoryLoaded: store.isHistoryLoaded,
  };
}
