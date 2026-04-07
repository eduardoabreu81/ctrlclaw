/**
 * Chat Service - CtrlClaw
 * 
 * Implementa IChatService usando backend adapter.
 * Responsável por:
 * - Criar/gerenciar conversas via HTTP API
 * - Enviar mensagens via HTTP
 * - Receber mensagens via WebSocket
 * - Retry automático em falhas de rede
 * 
 * Fase 6: Chat Funcional - Estabilização + UX Polish
 * - Deduplicação de mensagens
 * - Histórico só carrega uma vez por conversa
 * - Retry com exponential backoff
 */

import { IChatService } from '@/lib/services/interfaces';
import { Conversation, Message } from '@/types/entities';
import { getBackendAdapter } from '@/lib/backend-factory';
import { getWebSocketManager } from '@/lib/websocket';
import { useChatStore } from '../stores/chat-store';
import { getAuthService } from '@/features/auth/services/auth-service';

// Configuração de retry
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1s
  maxDelay: 5000,  // 5s
};

// Tipos para respostas da API
interface CreateConversationResponse {
  conversation: Conversation;
}

interface ListConversationsResponse {
  conversations: Conversation[];
}

interface GetMessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

interface SendMessageResponse {
  message: Message;
  accepted: boolean;
}

class ChatService implements IChatService {
  private backendUrl: string | null = null;
  private wsUnsubscribe: (() => void) | null = null;
  private processedMessageIds: Set<string> = new Set();

  constructor() {
    this.setupWebSocketListener();
  }

  // ============================================
  // Retry Utility
  // ============================================

  private async fetchWithRetry(
    url: string, 
    options: RequestInit, 
    operationName: string
  ): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // Se for erro 5xx, tenta novamente
        if (response.status >= 500 && attempt < RETRY_CONFIG.maxRetries - 1) {
          const delay = Math.min(
            RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelay
          );
          console.log(`[ChatService] ${operationName} failed with ${response.status}, retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Erro de rede, tenta novamente
        if (attempt < RETRY_CONFIG.maxRetries - 1) {
          const delay = Math.min(
            RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelay
          );
          console.log(`[ChatService] ${operationName} network error, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError || new Error(`${operationName} failed after ${RETRY_CONFIG.maxRetries} attempts`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // HTTP API Methods
  // ============================================

  async createConversation(agentId?: string): Promise<Conversation> {
    const url = await this.getBackendUrl();
    const token = getAuthService().getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await this.fetchWithRetry(
      `${url}/api/conversations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: agentId ? `Chat with ${agentId}` : 'New conversation',
          agentId: agentId || null,
        }),
      },
      'createConversation'
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create conversation: ${error}`);
    }

    const data: CreateConversationResponse = await response.json();
    
    const store = useChatStore.getState();
    if (!store.conversations.some(c => c.id === data.conversation.id)) {
      store.addConversation(data.conversation);
    }
    
    return data.conversation;
  }

  async listConversations(): Promise<Conversation[]> {
    const url = await this.getBackendUrl();
    const token = getAuthService().getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await this.fetchWithRetry(
      `${url}/api/conversations`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      },
      'listConversations'
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list conversations: ${error}`);
    }

    const data: ListConversationsResponse = await response.json();
    return data.conversations;
  }

  async loadHistory(conversationId: string): Promise<void> {
    const store = useChatStore.getState();
    if (store.isHistoryLoaded(conversationId)) {
      console.log('[ChatService] History already loaded for:', conversationId);
      return;
    }

    const url = await this.getBackendUrl();
    const token = getAuthService().getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    store.setLoadingHistory(true);

    try {
      const response = await this.fetchWithRetry(
        `${url}/api/conversations/${conversationId}/messages`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        'loadHistory'
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to load history: ${error}`);
      }

      const data: GetMessagesResponse = await response.json();
      
      store.setMessages(conversationId, data.messages);
      store.markHistoryLoaded(conversationId);
      
      console.log('[ChatService] History loaded:', data.messages.length, 'messages');
    } finally {
      store.setLoadingHistory(false);
    }
  }

  async sendMessage(
    content: string,
    conversationId?: string
  ): Promise<void> {
    const url = await this.getBackendUrl();
    const token = getAuthService().getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const targetConversationId =
      conversationId || useChatStore.getState().activeConversationId;

    if (!targetConversationId) {
      throw new Error('No active conversation');
    }

    const response = await this.fetchWithRetry(
      `${url}/api/conversations/${targetConversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      },
      'sendMessage'
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send message: ${error}`);
    }

    const data: SendMessageResponse = await response.json();
    
    useChatStore.getState().addMessage(data.message);
  }

  async archiveConversation(conversationId: string): Promise<void> {
    console.log('[ChatService] Archive not implemented yet:', conversationId);
  }

  // ============================================
  // Local State Methods
  // ============================================

  getActiveConversation(): Conversation | null {
    return useChatStore.getState().conversations.find(
      c => c.id === useChatStore.getState().activeConversationId
    ) || null;
  }

  setActiveConversation(conversationId: string | null): void {
    useChatStore.getState().setActiveConversation(conversationId);
  }

  // ============================================
  // WebSocket Integration
  // ============================================

  private setupWebSocketListener(): void {
    const wsService = getWebSocketManager();
    
    this.wsUnsubscribe = wsService.onMessage((msg) => {
      if (msg.type === 'message' && msg.data) {
        const messageData = msg.data as Message;
        
        if (this.processedMessageIds.has(messageData.id)) {
          console.log('[ChatService] Duplicate WS message, skipping:', messageData.id);
          return;
        }
        this.processedMessageIds.add(messageData.id);
        
        if (this.processedMessageIds.size > 1000) {
          const iterator = this.processedMessageIds.values();
          for (let i = 0; i < 500; i++) {
            const value = iterator.next().value;
            if (value) this.processedMessageIds.delete(value);
          }
        }
        
        useChatStore.getState().addMessage(messageData);
        
        console.log('[ChatService] Received message via WS:', messageData.id);
      }
    });
  }

  // ============================================
  // Helpers
  // ============================================

  private async getBackendUrl(): Promise<string> {
    if (this.backendUrl) {
      return this.backendUrl;
    }

    const adapter = await getBackendAdapter();
    this.backendUrl = adapter.getHttpUrl();
    return this.backendUrl;
  }

  cleanup(): void {
    if (this.wsUnsubscribe) {
      this.wsUnsubscribe();
      this.wsUnsubscribe = null;
    }
    this.processedMessageIds.clear();
  }
}

// Singleton
let chatServiceInstance: ChatService | null = null;

export function getChatService(): ChatService {
  if (!chatServiceInstance) {
    chatServiceInstance = new ChatService();
  }
  return chatServiceInstance;
}

export function resetChatService(): void {
  if (chatServiceInstance) {
    chatServiceInstance.cleanup();
    chatServiceInstance = null;
  }
}

export { ChatService };
