"use client";

import { AgentList } from "@/features/agents/components/AgentList";
import { AgentStatus } from "@/features/agents/components/AgentStatus";
import { useSelectedAgent } from "@/features/agents/stores/agents-store";

export default function AgentsPage() {
  const selectedAgent = useSelectedAgent();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <AgentList />
      </div>

      <div className="lg:col-span-2">
        {selectedAgent ? (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">{selectedAgent.name}</h2>
                <AgentStatus status={selectedAgent.status} />
              </div>
            </div>

            {selectedAgent.description && (
              <p className="text-gray-600 mb-4">{selectedAgent.description}</p>
            )}

            {selectedAgent.capabilities.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium mb-2">Capabilities</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedAgent.configuration && (
              <div className="mb-4">
                <h3 className="font-medium mb-2">Configuration</h3>
                <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                  {JSON.stringify(selectedAgent.configuration, null, 2)}
                </pre>
              </div>
            )}

            {selectedAgent.stats && (
              <div>
                <h3 className="font-medium mb-2">Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-500">Messages</p>
                    <p className="text-lg font-semibold">
                      {selectedAgent.stats.messagesProcessed}
                    </p>
                  </div>
                  {selectedAgent.stats.lastActive && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-500">Last Active</p>
                      <p className="text-sm">
                        {new Date(selectedAgent.stats.lastActive).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
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
            <p className="text-lg">Select an agent to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
