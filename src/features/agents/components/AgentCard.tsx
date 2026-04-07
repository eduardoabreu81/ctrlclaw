"use client";

import { Agent } from "@/types/entities";

interface AgentCardProps {
  agent: Agent;
  isSelected?: boolean;
  onClick?: () => void;
}

const statusColors: Record<Agent["status"], string> = {
  idle: "bg-green-500",
  busy: "bg-yellow-500",
  offline: "bg-gray-400",
  error: "bg-red-500",
};

export function AgentCard({ agent, isSelected, onClick }: AgentCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${statusColors[agent.status]}`}
            />
            <h3 className="font-medium">{agent.name}</h3>
          </div>
          
          {agent.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {agent.description}
            </p>
          )}
          
          {agent.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {agent.capabilities.slice(0, 3).map((cap) => (
                <span
                  key={cap}
                  className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600"
                >
                  {cap}
                </span>
              ))}
              {agent.capabilities.length > 3 && (
                <span className="text-xs px-2 py-0.5 text-gray-400">
                  +{agent.capabilities.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
        
        {agent.stats && (
          <div className="text-right text-xs text-gray-400">
            <p>{agent.stats.messagesProcessed} msgs</p>
          </div>
        )}
      </div>
    </div>
  );
}
