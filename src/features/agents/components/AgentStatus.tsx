"use client";

import { Agent } from "@/types/entities";

interface AgentStatusProps {
  status: Agent["status"];
  showLabel?: boolean;
}

const config: Record<Agent["status"], { color: string; label: string }> = {
  idle: { color: "bg-green-500", label: "Idle" },
  busy: { color: "bg-yellow-500", label: "Busy" },
  offline: { color: "bg-gray-400", label: "Offline" },
  error: { color: "bg-red-500", label: "Error" },
};

export function AgentStatus({ status, showLabel = true }: AgentStatusProps) {
  const { color, label } = config[status];

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      {showLabel && <span className="text-sm text-gray-600">{label}</span>}
    </div>
  );
}
