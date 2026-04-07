/**
 * Memory Hook - CtrlClaw
 * 
 * Hook React para integração com MemoryService.
 * 
 * Fase 7: Memória, Contexto e Agentes
 */

import { useEffect, useState, useCallback } from 'react';
import { getMemoryService, ConversationMeta } from '../services/memory-service';
import { getContextService, AssembledContext } from '../services/context-service';
import { Conversation, Message } from '@/types/entities';

export interface UseMemoryReturn {
  // State
  isLoading: boolean;
  error: string | null;
  
  // Metadata operations
  getMeta: (conversationId: string) => Promise<ConversationMeta | undefined>;
  updateMeta: (conversationId: string, updates: Partial<Pick<ConversationMeta, 'title' | 'tags' | 'notes'>>) => Promise<void>;
  
  // Indexing
  indexConversation: (conversation: Conversation, messages: Message[]) => Promise<void>;
  updateIndex: (conversationId: string, messages: Message[]) => Promise<void>;
  
  // Context
  assembleContext: (conversationId: string, messages: Message[]) => Promise<AssembledContext | null>;
  
  // Search
  search: (query: string) => Promise<ConversationMeta[]>;
  searchByTag: (tag: string) => Promise<ConversationMeta[]>;
  listRecent: (limit?: number) => Promise<ConversationMeta[]>;
}

export function useMemory(): UseMemoryReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const memoryService = getMemoryService();
  const contextService = getContextService();

  const handleError = (err: unknown, operation: string) => {
    const message = err instanceof Error ? err.message : `Failed to ${operation}`;
    console.error(`[useMemory] ${operation} failed:`, err);
    setError(message);
    throw err;
  };

  // Metadata operations
  const getMeta = useCallback(async (conversationId: string) => {
    try {
      return await memoryService.getConversationMeta(conversationId);
    } catch (err) {
      handleError(err, 'getMeta');
      return undefined;
    }
  }, [memoryService]);

  const updateMeta = useCallback(async (
    conversationId: string,
    updates: Partial<Pick<ConversationMeta, 'title' | 'tags' | 'notes'>>
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await memoryService.updateConversationMeta(conversationId, updates);
    } catch (err) {
      handleError(err, 'updateMeta');
    } finally {
      setIsLoading(false);
    }
  }, [memoryService]);

  // Indexing
  const indexConversation = useCallback(async (
    conversation: Conversation,
    messages: Message[]
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await memoryService.indexConversation(conversation, messages);
    } catch (err) {
      handleError(err, 'indexConversation');
    } finally {
      setIsLoading(false);
    }
  }, [memoryService]);

  const updateIndex = useCallback(async (
    conversationId: string,
    messages: Message[]
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await memoryService.updateConversationIndex(conversationId, messages);
    } catch (err) {
      handleError(err, 'updateIndex');
    } finally {
      setIsLoading(false);
    }
  }, [memoryService]);

  // Context
  const assembleContext = useCallback(async (
    conversationId: string,
    messages: Message[]
  ): Promise<AssembledContext | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const context = await contextService.assembleContext(conversationId, messages);
      return context;
    } catch (err) {
      handleError(err, 'assembleContext');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [contextService]);

  // Search
  const search = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await memoryService.searchConversations(query);
      return results;
    } catch (err) {
      handleError(err, 'search');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [memoryService]);

  const searchByTag = useCallback(async (tag: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await memoryService.searchByTag(tag);
      return results;
    } catch (err) {
      handleError(err, 'searchByTag');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [memoryService]);

  const listRecent = useCallback(async (limit?: number) => {
    try {
      return await memoryService.listRecentConversations(limit);
    } catch (err) {
      handleError(err, 'listRecent');
      return [];
    }
  }, [memoryService]);

  return {
    isLoading,
    error,
    getMeta,
    updateMeta,
    indexConversation,
    updateIndex,
    assembleContext,
    search,
    searchByTag,
    listRecent,
  };
}
