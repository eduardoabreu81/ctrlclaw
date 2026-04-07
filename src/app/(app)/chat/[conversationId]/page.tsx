"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChatContainer } from "@/features/chat/components/ChatContainer";
import { ConversationSidebar } from "@/features/chat/components/ConversationSidebar";
import { useRequireAuth, useAuthInit } from "@/hooks/use-auth";
import { useChatStore } from "@/features/chat/stores/chat-store";
import { useChatService } from "@/features/chat/hooks/use-chat-service";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  
  useAuthInit();
  const { isHydrated, isLoading } = useRequireAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const { setActiveConversation, loadHistory } = useChatService();
  const store = useChatStore();
  
  // Set active conversation from URL
  useEffect(() => {
    if (!isHydrated || isLoading) return;
    if (!conversationId) return;
    
    // Set as active
    setActiveConversation(conversationId);
    
    // Load history if not loaded
    const isLoaded = store.isHistoryLoaded(conversationId);
    if (!isLoaded) {
      loadHistory(conversationId).catch(console.error);
    }
  }, [conversationId, isHydrated, isLoading, setActiveConversation, loadHistory, store]);

  // Redirect if conversation not found after loading
  useEffect(() => {
    if (!isHydrated || isLoading) return;
    if (!conversationId) return;
    
    // Wait a bit for conversations to load, then check
    const timer = setTimeout(() => {
      const conversation = store.conversations.find(c => c.id === conversationId);
      if (!conversation && store.loadedHistoryIds.size > 0) {
        // Conversation not found, redirect to main chat
        console.log('[ConversationPage] Conversation not found:', conversationId);
        router.push('/chat');
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [conversationId, store.conversations, store.loadedHistoryIds, isHydrated, isLoading, router]);

  if (!isHydrated || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex">
      <ConversationSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute left-4 top-24 z-10 p-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <div className="flex-1 min-w-0">
        <ChatContainer />
      </div>
    </div>
  );
}
