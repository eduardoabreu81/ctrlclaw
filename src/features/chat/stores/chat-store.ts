/**
 * Chat Store - CtrlClaw
 * 
 * Estado das conversas e mensagens.
 * 
 * ⚠️ IMPORTANTE: Mensagens ficam apenas em memória (Zustand).
 * NUNCA persistimos mensagens em localStorage/sessionStorage.
 * Recarregar página = perder histórico (conforme arquitetura).
 * 
 * Fase 6 - Estabilização:
 * - Deduplicação de mensagens (evita duplicatas)
 * - Separação entre addMessage (novo) e setMessages (histórico)
 * - lastActivity só atualiza em mensagens novas, não histórico
 */

import { create } from "zustand";
import { Message, Conversation } from "@/types/entities";

interface ChatState {
  // Estado
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoadingHistory: boolean;
  loadedHistoryIds: Set<string>; // Conversas com histórico já carregado
  
  // Ações
  addMessage: (message: Message) => void;
  setMessages: (conversationId: string, messages: Message[]) => void; // Para histórico
  setActiveConversation: (id: string | null) => void;
  createConversation: (agentId?: string) => string;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  updateMessageStatus: (
    messageId: string, 
    status: Message["status"]
  ) => void;
  setLoadingHistory: (loading: boolean) => void;
  markHistoryLoaded: (conversationId: string) => void;
  isHistoryLoaded: (conversationId: string) => boolean;
  clearConversations: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Estado inicial
  conversations: [],
  activeConversationId: null,
  isLoadingHistory: false,
  loadedHistoryIds: new Set(),

  // ============================================
  // Ações
  // ============================================

  /**
   * Adiciona uma mensagem nova (não de histórico).
   * Atualiza lastActivity e evita duplicatas.
   */
  addMessage: (message: Message) => {
    set(state => {
      const conversations = [...state.conversations];
      const conversationIndex = conversations.findIndex(
        c => c.id === message.conversationId
      );

      if (conversationIndex >= 0) {
        const conversation = conversations[conversationIndex];
        
        // Verificar duplicata por ID
        if (conversation.messages.some(m => m.id === message.id)) {
          console.log('[ChatStore] Message already exists, skipping:', message.id);
          return { conversations }; // Sem mudanças
        }

        // Adicionar mensagem à conversa existente
        conversations[conversationIndex] = {
          ...conversation,
          messages: [...conversation.messages, message],
          lastActivity: new Date().toISOString(), // Só atualiza em mensagens novas
          unreadCount: state.activeConversationId === message.conversationId 
            ? 0 
            : (conversation.unreadCount || 0) + 1,
        };
      } else {
        // Criar nova conversa se não existe
        conversations.push({
          id: message.conversationId,
          title: "Nova conversa",
          messages: [message],
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          unreadCount: 0,
          status: "active",
        });
      }

      return { conversations };
    });
  },

  /**
   * Define mensagens de histórico (não atualiza lastActivity).
   * Usado quando carrega histórico do backend.
   * Sobrescreve mensagens existentes (evita duplicatas).
   */
  setMessages: (conversationId: string, messages: Message[]) => {
    set(state => {
      const conversations = [...state.conversations];
      const conversationIndex = conversations.findIndex(
        c => c.id === conversationId
      );

      if (conversationIndex >= 0) {
        const existing = conversations[conversationIndex];
        
        // Merge: manter mensagens locais mais recentes que não estão no histórico
        // (ex: mensagem enviada enquanto carregava histórico)
        const existingIds = new Set(messages.map(m => m.id));
        const localMessages = existing.messages.filter(m => 
          !existingIds.has(m.id) && m.sender === 'user' // Manter só mensagens do usuário pendentes
        );

        conversations[conversationIndex] = {
          ...existing,
          messages: [...messages, ...localMessages],
          // NÃO atualiza lastActivity - mantém do backend
        };
      } else {
        // Criar conversa com histórico
        if (messages.length > 0) {
          const firstMsg = messages[0];
          conversations.push({
            id: conversationId,
            title: firstMsg.senderName || "Conversa",
            messages: messages,
            createdAt: messages[0]?.timestamp || new Date().toISOString(),
            lastActivity: messages[messages.length - 1]?.timestamp || new Date().toISOString(),
            unreadCount: 0,
            status: "active",
          });
        }
      }

      return { conversations };
    });
  },

  setActiveConversation: (id: string | null) => 
    set(state => { 
      // Limpar unreadCount quando seleciona conversa
      if (id) {
        const conversations = state.conversations.map(c => 
          c.id === id ? { ...c, unreadCount: 0 } : c
        );
        return { activeConversationId: id, conversations };
      }
      return { activeConversationId: id };
    }),

  createConversation: (agentId?: string): string => {
    const id = crypto.randomUUID();
    
    const conversation: Conversation = {
      id,
      title: agentId ? `Conversa com ${agentId}` : "Nova conversa",
      agentId,
      messages: [],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      unreadCount: 0,
      status: "active",
    };

    set(state => ({
      conversations: [...state.conversations, conversation],
      activeConversationId: id,
    }));

    return id;
  },

  addConversation: (conversation: Conversation) => {
    set(state => {
      // Evitar duplicatas
      if (state.conversations.some(c => c.id === conversation.id)) {
        return { conversations: state.conversations };
      }
      return { conversations: [...state.conversations, conversation] };
    });
  },

  updateConversation: (conversationId: string, updates: Partial<Conversation>) => {
    set(state => ({
      conversations: state.conversations.map(c => 
        c.id === conversationId ? { ...c, ...updates } : c
      ),
    }));
  },

  updateMessageStatus: (messageId: string, status: Message["status"]) => {
    set(state => {
      const conversations = state.conversations.map(conv => ({
        ...conv,
        messages: conv.messages.map(msg =>
          msg.id === messageId ? { ...msg, status } : msg
        ),
      }));

      return { conversations };
    });
  },

  setLoadingHistory: (loading: boolean) => 
    set({ isLoadingHistory: loading }),

  markHistoryLoaded: (conversationId: string) =>
    set(state => ({
      loadedHistoryIds: new Set([...state.loadedHistoryIds, conversationId]),
    })),

  isHistoryLoaded: (conversationId: string) => {
    return get().loadedHistoryIds.has(conversationId);
  },

  clearConversations: () => 
    set({ 
      conversations: [], 
      activeConversationId: null,
      loadedHistoryIds: new Set(),
    }),
}));

// ============================================
// Selectores
// ============================================

export function useActiveConversation(): Conversation | null {
  const conversations = useChatStore(state => state.conversations);
  const activeId = useChatStore(state => state.activeConversationId);
  
  return conversations.find(c => c.id === activeId) || null;
}

export function useConversations(): Conversation[] {
  return useChatStore(state => state.conversations);
}

export function useIsHistoryLoaded(conversationId: string): boolean {
  return useChatStore(state => state.loadedHistoryIds.has(conversationId));
}
