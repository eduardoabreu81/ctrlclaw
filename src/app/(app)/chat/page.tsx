"use client";

import { useState } from "react";
import { ChatContainer } from "@/features/chat/components/ChatContainer";
import { ConversationSidebar } from "@/features/chat/components/ConversationSidebar";
import { useRequireAuth, useAuthInit } from "@/hooks/use-auth";

export default function ChatPage() {
  // Garantir hidratação e proteger rota
  useAuthInit();
  const { isHydrated, isLoading } = useRequireAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Mostrar loading enquanto hidrata ou verifica auth
  if (!isHydrated || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex">
      {/* Conversation Sidebar */}
      <ConversationSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Toggle button when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute left-4 top-24 z-10 p-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50"
          title="Open sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0">
        <ChatContainer />
      </div>
    </div>
  );
}
