"use client";

import { useEffect } from "react";
import { useAgentsStore, useAgents, useSelectedAgent } from "../stores/agents-store";
import { useAuth } from "@/hooks/use-auth";
import { AgentCard } from "./AgentCard";
import { getBackendAdapter } from "@/lib/backend-factory";

export function AgentList() {
  const agents = useAgents();
  const selectedAgent = useSelectedAgent();
  const { setAgents, setLoading, setError, selectAgent } = useAgentsStore();
  const { token } = useAuth();

  useEffect(() => {
    const loadAgents = async () => {
      if (!token) return;
      
      setLoading(true);
      try {
        const adapter = await getBackendAdapter();
        const data = await adapter.listAgents(token);
        setAgents(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to load agents");
      }
    };

    loadAgents();
  }, [token, setAgents, setLoading, setError]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Agents</h2>
        <span className="text-sm text-gray-500">{agents.length} total</span>
      </div>

      <div className="space-y-2">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isSelected={selectedAgent?.id === agent.id}
            onClick={() => selectAgent(agent.id)}
          />
        ))}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p>No agents available</p>
        </div>
      )}
    </div>
  );
}
