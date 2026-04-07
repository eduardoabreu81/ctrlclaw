"use client";

import { useChatStore, useActiveConversation, useIsHistoryLoaded } from "../stores/chat-store";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAgentsStore } from "@/features/agents/stores/agents-store";
import { useChatService } from "../hooks/use-chat-service";
import { useToast } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast";
import { ContextPanel } from "@/features/memory/components/ContextPanel";
import { useMemory } from "@/features/memory/hooks/use-memory";
import { getContextService, AssembledContext } from "@/features/memory/services/context-service";

export function ChatContainer() {
  const conversation = useActiveConversation();
  const { user } = useAuth();
  const { isOnline } = useWebSocket();
  const { selectedAgentId } = useAgentsStore();
  const { isLoadingHistory, sendMessage, createConversation, loadHistory } = useChatService();
  const isHistoryLoaded = useIsHistoryLoaded(conversation?.id || '');
  const isCreatingRef = useRef(false);
  const { toasts, removeToast, error, success } = useToast();
  const { indexConversation, updateIndex, assembleContext } = useMemory();
  
  // Estados de loading granular
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [assembledContext, setAssembledContext] = useState<AssembledContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  // Create conversation if none exists
  useEffect(() => {
    const store = useChatStore.getState();
    if (!conversation && store.conversations.length === 0 && isOnline && !isCreatingRef.current) {
      isCreatingRef.current = true;
      createConversation(selectedAgentId || undefined)
        .then(async (conv) => { 
          isCreatingRef.current = false;
          success("New conversation created");
          // Auto-index new conversation
          if (conv) {
            await indexConversation(conv, []);
          }
        })
        .catch((err) => { 
          console.error('[ChatContainer] Failed to create conversation:', err);
          error("Failed to create conversation. Please try again.");
          isCreatingRef.current = false; 
        });
    }
  }, [conversation, isOnline, selectedAgentId, createConversation, error, success, indexConversation]);

  // Load history and assemble context when conversation changes
  useEffect(() => {
    if (conversation?.id && !isHistoryLoaded && !isLoadingHistory) {
      loadHistory(conversation.id)
        .then(async () => {
          // After loading history, assemble context
          await loadAndAssembleContext();
        })
        .catch((err) => {
          console.error('[ChatContainer] Failed to load history:', err);
          error("Failed to load conversation history");
        });
    }
  }, [conversation?.id, isHistoryLoaded, isLoadingHistory, loadHistory, error]);

  // Re-assemble context when messages change
  useEffect(() => {
    if (conversation?.id && conversation.messages.length > 0) {
      const timeout = setTimeout(() => {
        loadAndAssembleContext();
      }, 500); // Debounce
      return () => clearTimeout(timeout);
    }
  }, [conversation?.messages.length]);

  const loadAndAssembleContext = useCallback(async () => {
    if (!conversation) return;
    
    setIsLoadingContext(true);
    try {
      // Update index with current messages
      await updateIndex(conversation.id, conversation.messages);
      
      // Assemble context
      const context = await assembleContext(conversation.id, conversation.messages);
      setAssembledContext(context);
    } catch (err) {
      console.error('[ChatContainer] Failed to assemble context:', err);
    } finally {
      setIsLoadingContext(false);
    }
  }, [conversation, updateIndex, assembleContext]);

  const handleReloadContext = async () => {
    await loadAndAssembleContext();
    success("Context reloaded");
  };

  const handleClearContext = () => {
    const contextService = getContextService();
    const emptyContext = contextService.clearContext();
    setAssembledContext(emptyContext);
    success("Context cleared");
  };

  const handleSendMessage = async (content: string) => {
    if (!conversation || !user) return;

    setIsSending(true);
    setSendError(null);

    try {
      await sendMessage(content, conversation.id);
      
      // After sending, update index
      await updateIndex(conversation.id, conversation.messages);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      setSendError(message);
      error(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = () => {
    setSendError(null);
  };

  if (!conversation) {
    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-lg font-medium">No conversation selected</p>
            <p className="text-sm">Create a new conversation to start chatting</p>
          </div>
          <button
            onClick={() => createConversation(selectedAgentId || undefined)}
            disabled={!isOnline}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            New Conversation
          </button>
        </div>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full bg-white rounded-lg border">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{conversation.title}</h2>
            {selectedAgentId && (
              <p className="text-sm text-gray-500">Chat with agent</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="text-xs text-orange-500 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Offline
              </span>
            )}
            {isLoadingHistory && (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                Loading history...
              </div>
            )}
          </div>
        </div>

        {/* Context Panel */}
        <div className="px-4 py-2 border-b bg-gray-50/50">
          <ContextPanel 
            context={assembledContext}
            onReload={handleReloadContext}
            onClear={handleClearContext}
            isLoading={isLoadingContext}
          />
        </div>

        {/* Messages */}
        <MessageList messages={conversation.messages} isLoading={isLoadingHistory} />

        {/* Error Banner */}
        {sendError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center justify-between">
            <span className="text-sm text-red-600">{sendError}</span>
            <button
              onClick={handleRetry}
              className="text-sm text-red-700 hover:text-red-800 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <MessageInput 
            onSend={handleSendMessage} 
            disabled={!isOnline || isSending} 
            isSending={isSending}
          />
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
