/**
 * Agents Store - CtrlClaw
 * 
 * Estado dos agentes.
 */

import { create } from "zustand";
import { Agent } from "@/types/entities";

interface AgentsState {
  // Estado
  agents: Agent[];
  selectedAgentId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Ações
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agent: Agent) => void;
  selectAgent: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  // Estado inicial
  agents: [],
  selectedAgentId: null,
  isLoading: false,
  error: null,

  // ============================================
  // Ações
  // ============================================

  setAgents: (agents: Agent[]) => 
    set({ agents, isLoading: false, error: null }),

  updateAgent: (agent: Agent) => 
    set(state => ({
      agents: state.agents.map(a => 
        a.id === agent.id ? agent : a
      ),
    })),

  selectAgent: (id: string | null) => 
    set({ selectedAgentId: id }),

  setLoading: (loading: boolean) => 
    set({ isLoading: loading }),

  setError: (error: string | null) => 
    set({ error, isLoading: false }),

  clear: () => 
    set({ agents: [], selectedAgentId: null, isLoading: false, error: null }),
}));

// ============================================
// Selectores
// ============================================

export function useAgents(): Agent[] {
  return useAgentsStore(state => state.agents);
}

export function useSelectedAgent(): Agent | null {
  const agents = useAgentsStore(state => state.agents);
  const selectedId = useAgentsStore(state => state.selectedAgentId);
  
  return agents.find(a => a.id === selectedId) || null;
}

export function useAgentsLoading(): boolean {
  return useAgentsStore(state => state.isLoading);
}
