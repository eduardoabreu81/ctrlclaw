"use client";

import { Message } from "@/types/entities";

interface MessageBubbleProps {
  message: Message;
  isLatest?: boolean;
}

export function MessageBubble({ message, isLatest }: MessageBubbleProps) {
  const isUser = message.isFromMe;

  const getStatusIcon = () => {
    switch (message.status) {
      case "pending":
        return (
          <span className="text-xs opacity-50" title="Sending...">
            <svg className="w-3 h-3 inline animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </span>
        );
      case "sent":
        return <span className="text-xs opacity-75" title="Sent">✓</span>;
      case "delivered":
        return <span className="text-xs opacity-75" title="Delivered">✓✓</span>;
      case "failed":
        return <span className="text-xs text-red-300" title="Failed">✗</span>;
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} ${isLatest ? "animate-fadeIn" : ""}`}
    >
      <div
        className={`max-w-[70%] px-4 py-2 rounded-lg shadow-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900 border border-gray-200"
        } ${isLatest ? "ring-2 ring-blue-200 ring-opacity-50" : ""}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium ${isUser ? "text-blue-100" : "text-gray-600"}`}>
            {message.senderName}
          </span>
          <span className={`text-xs ${isUser ? "text-blue-200" : "text-gray-400"}`}>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        
        <p className="text-sm leading-relaxed">{message.content}</p>
        
        {isUser && (
          <div className="flex justify-end mt-1">
            {getStatusIcon()}
          </div>
        )}
      </div>
    </div>
  );
}
