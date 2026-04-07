"use client";

import { useRouter } from "next/navigation";
import { ConversationSearch } from "@/features/memory/components/ConversationSearch";
import { useRequireAuth, useAuthInit } from "@/hooks/use-auth";

export default function SearchPage() {
  useAuthInit();
  const { isHydrated, isLoading } = useRequireAuth();
  const router = useRouter();

  const handleSelectConversation = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  if (!isHydrated || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Search Conversations</h1>
        <p className="text-gray-500 mt-1">
          Find and resume previous conversations by keywords, tags, or date.
        </p>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6">
          <ConversationSearch 
            onSelectConversation={handleSelectConversation}
          />
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-400 text-center">
        Search is local and operational. Semantic search coming in future versions.
      </div>
    </div>
  );
}
