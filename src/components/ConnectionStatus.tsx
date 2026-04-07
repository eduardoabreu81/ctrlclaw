"use client";

import { ConnectionStatus as Status } from "@/lib/websocket";

interface ConnectionStatusProps {
  status: Status;
  latency?: number | null;
  reconnectAttempt?: number;
}

const statusConfig: Record<Status, { color: string; label: string; animate?: boolean }> = {
  disconnected: { color: "bg-gray-400", label: "Offline" },
  connecting: { color: "bg-yellow-400", label: "Connecting...", animate: true },
  authenticating: { color: "bg-blue-400", label: "Authenticating...", animate: true },
  online: { color: "bg-green-500", label: "Connected" },
  reconnecting: { color: "bg-orange-400", label: "Reconnecting", animate: true },
  error: { color: "bg-red-500", label: "Error" },
};

export function ConnectionStatus({
  status,
  latency,
  reconnectAttempt,
}: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="relative">
        <div
          className={`w-2.5 h-2.5 rounded-full ${config.color} ${
            config.animate ? "animate-pulse" : ""
          }`}
        />
        {status === "reconnecting" && reconnectAttempt && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          </span>
        )}
      </div>

      <span className="text-gray-600">
        {config.label}
        {status === "reconnecting" && reconnectAttempt && (
          <span className="ml-1 text-xs">({reconnectAttempt}/10)</span>
        )}
      </span>

      {latency && status === "online" && (
        <span className="text-xs text-gray-400">({latency}ms)</span>
      )}
    </div>
  );
}
