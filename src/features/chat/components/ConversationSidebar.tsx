"use client";

import { useChatService } from "../hooks/use-chat-service";
import { useRouter, usePathname } from "next/navigation";
import { Conversation } from "@/types/entities";

interface ConversationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ConversationSidebar({ isOpen, onToggle }: ConversationSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { conversations, activeConversationId, setActiveConversation, createConversation } = useChatService();

  // Sort by lastActivity (newest first)
  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );

  const handleNewConversation = async () => {
    try {
      const conv = await createConversation();
      // Navigate to new conversation
      router.push(`/chat/${conv.id}`);
    } catch (error) {
      console.error("[ConversationSidebar] Failed to create conversation:", error);
    }
  };

  const handleSelectConversation = (convId: string) => {
    setActiveConversation(convId);
    router.push(`/chat/${convId}`);
  };

  return (
    <div
      className={`${
        isOpen ? "w-72" : "w-0 overflow-hidden"
      } bg-gray-50 border-r transition-all duration-300 flex flex-col`}
    >
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Conversations</h3>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        </div>
        <button
          onClick={handleNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Conversation
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {sortedConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Create one to get started</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {sortedConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId || pathname === `/chat/${conv.id}`}
                onClick={() => handleSelectConversation(conv.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const lastMessage = conversation.messages?.[conversation.messages.length - 1];
  const timeAgo = formatTimeAgo(conversation.lastActivity);

  return (
    <li
      onClick={onClick}
      className={`p-4 cursor-pointer hover:bg-gray-100 transition-colors ${
        isActive ? "bg-blue-50 border-l-4 border-blue-600" : "border-l-4 border-transparent"
      }`}
    >
      <div className="flex items-start justify-between">
        <h4 className={`font-medium truncate ${isActive ? "text-blue-900" : "text-gray-900"}`}>
          {conversation.title}
        </h4>
        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{timeAgo}</span>
      </div>
      <p className="text-sm text-gray-500 truncate mt-1">
        {lastMessage ? lastMessage.content : "No messages yet"}
      </p>
      {conversation.unreadCount > 0 && (
        <span className="inline-flex items-center justify-center px-2 py-0.5 mt-2 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          {conversation.unreadCount} new
        </span>
      )}
    </li>
  );
}

function formatTimeAgo(date: string): string {
  try {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  } catch {
    return "";
  }
}
