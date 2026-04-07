"use client";

import { useRequireAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { LogoutButton } from "@/features/auth/components/LogoutButton";
import { IdleWarning } from "@/features/auth/components/IdleWarning";
import { useCurrentUser } from "@/features/auth/stores/auth-store";
import Link from "next/link";
import { useState } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useRequireAuth();
  const { status, latency, reconnectAttempt } = useWebSocket();
  useIdleTimeout();
  const user = useCurrentUser();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <IdleWarning />

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } bg-gray-900 text-white transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <span className="font-bold text-lg">CtrlClaw</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        <nav className="flex-1 py-4">
          <Link
            href="/chat"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {sidebarOpen && <span>Chat</span>}
          </Link>

          <Link
            href="/agents"
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {sidebarOpen && <span>Agents</span>}
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-800">
          {sidebarOpen && user && (
            <div className="mb-3 text-sm">
              <p className="font-medium">{user.username}</p>
              <p className="text-gray-400 text-xs">
                {user.permissions.includes("admin") ? "Admin" : "User"}
              </p>
            </div>
          )}
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">CtrlClaw</h1>
          <ConnectionStatus
            status={status}
            latency={latency}
            reconnectAttempt={reconnectAttempt}
          />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
