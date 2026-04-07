"use client";

import { useState, useCallback, useEffect } from "react";
import { ConversationMeta } from "../services/memory-service";
import { useMemory } from "../hooks/use-memory";

interface ConversationSearchProps {
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
}

export function ConversationSearch({ onSelectConversation, currentConversationId }: ConversationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConversationMeta[]>([]);
  const [recentConversations, setRecentConversations] = useState<ConversationMeta[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const { search, searchByTag, listRecent, isLoading } = useMemory();

  // Load recent conversations on mount
  useEffect(() => {
    listRecent(20).then(setRecentConversations);
  }, [listRecent]);

  // Search when query changes
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim() || selectedTags.length > 0) {
        setIsSearching(true);
        
        let searchResults: ConversationMeta[] = [];
        
        if (query.trim()) {
          searchResults = await search(query);
        } else {
          searchResults = await listRecent(50);
        }
        
        // Filter by tags if selected
        if (selectedTags.length > 0) {
          searchResults = searchResults.filter(conv =>
            selectedTags.some(tag => conv.tags.includes(tag))
          );
        }
        
        setResults(searchResults);
        setIsSearching(false);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedTags, search, listRecent]);

  // Collect all unique tags from results
  const allTags = Array.from(
    new Set(recentConversations.flatMap(c => c.tags))
  ).slice(0, 20);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  const displayConversations = query.trim() || selectedTags.length > 0 ? results : recentConversations;

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations..."
          className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <svg 
          className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {isSearching && (
          <div className="absolute right-3 top-2.5">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {displayConversations.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">
              {query.trim() || selectedTags.length > 0
                ? 'No conversations found'
                : 'No recent conversations'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              {query.trim() || selectedTags.length > 0 ? 'Search results' : 'Recent conversations'}
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {displayConversations.map(conv => (
                <ConversationResultItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === currentConversationId}
                  onClick={() => onSelectConversation(conv.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 text-center">
        Search by keywords and tags. Semantic search coming in future versions.
      </p>
    </div>
  );
}

interface ConversationResultItemProps {
  conversation: ConversationMeta;
  isActive: boolean;
  onClick: () => void;
}

function ConversationResultItem({ conversation, isActive, onClick }: ConversationResultItemProps) {
  const timeAgo = formatTimeAgo(conversation.lastActivity);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isActive
          ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
          : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className={`font-medium truncate ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>
          {conversation.title}
        </h4>
        <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo}</span>
      </div>
      
      {conversation.notes && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{conversation.notes}</p>
      )}
      
      <div className="flex items-center gap-2 mt-2">
        {conversation.tags.slice(0, 3).map((tag: string) => (
          <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
            #{tag}
          </span>
        ))}
        {conversation.tags.length > 3 && (
          <span className="text-xs text-gray-400">+{conversation.tags.length - 3}</span>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {conversation.messageCount} msgs
        </span>
      </div>
    </button>
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
