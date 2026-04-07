"use client";

import { useState } from "react";
import { AssembledContext, CONTEXT_LIMITS } from "../services/context-service";

interface ContextPanelProps {
  context: AssembledContext | null;
  onReload: () => void;
  onClear: () => void;
  isLoading?: boolean;
}

export function ContextPanel({ context, onReload, onClear, isLoading }: ContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!context) {
    return (
      <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          No context loaded
        </div>
      </div>
    );
  }

  const { stats, wasTruncated, summary } = context;

  // Determinar estado do contexto
  const getStatusBadge = () => {
    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </span>
      );
    }

    if (wasTruncated) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700" title="Context was truncated to fit limits">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Truncated
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Active
      </span>
    );
  };

  const usagePercentage = Math.round((context.totalChars / CONTEXT_LIMITS.TOTAL_CONTEXT_MAX_CHARS) * 100);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-blue-100/50 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-blue-900">Context Loaded</span>
            {getStatusBadge()}
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            {isExpanded ? 'Hide' : 'Show'}
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Summary (always visible) */}
      <div className="px-3 py-2 text-xs text-blue-700">
        <div className="flex items-center gap-4">
          <span>{stats.messageCount} of {stats.totalMessagesAvailable} messages</span>
          <span>~{stats.estimatedTokens} tokens</span>
          <span className={usagePercentage > 80 ? 'text-orange-600 font-medium' : ''}>
            {context.totalChars}/{CONTEXT_LIMITS.TOTAL_CONTEXT_MAX_CHARS} chars
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-blue-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${usagePercentage > 80 ? 'bg-orange-400' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 py-2 border-t border-blue-200 space-y-3">
          {/* Summary */}
          {summary && (
            <div>
              <h4 className="text-xs font-medium text-blue-800 mb-1">Summary ({stats.summaryChars} chars)</h4>
              <p className="text-xs text-blue-700 bg-white/50 rounded p-2 leading-relaxed">
                {summary}
              </p>
            </div>
          )}

          {/* Recent Messages */}
          {context.recentMessages.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-blue-800 mb-1">
                Recent Messages ({context.recentMessages.length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {context.recentMessages.slice(-5).map((msg, idx) => (
                  <div key={msg.id} className="text-xs text-blue-600 bg-white/30 rounded px-2 py-1 truncate">
                    <span className="font-medium">{msg.senderName || msg.sender}:</span>{' '}
                    {msg.content.substring(0, 60)}{msg.content.length > 60 ? '...' : ''}
                  </div>
                ))}
                {context.recentMessages.length > 5 && (
                  <div className="text-xs text-blue-500 text-center">
                    ... and {context.recentMessages.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-blue-200">
            <button
              onClick={onReload}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reload
            </button>
            <button
              onClick={onClear}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Context
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
