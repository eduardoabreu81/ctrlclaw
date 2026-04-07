/**
 * Runtime Store - CtrlClaw
 * 
 * Estado de runtime da aplicação.
 * - Conexão WebSocket
 * - Sessão
 * - Execução (idle, processing, etc)
 * - Idle timeout warning
 */

import { create } from "zustand";
import { ConnectionStatus } from "@/lib/websocket";

interface RuntimeState {
  // Conexão
  connectionStatus: ConnectionStatus;
  connectionLatency: number | null;
  reconnectAttempt: number;
  
  // Sessão
  isWarningVisible: boolean;
  timeRemaining: number | null;
  
  // Execução
  executionStatus: "idle" | "processing" | "waiting" | "error";
  currentAgent: string | null;
  currentConversation: string | null;
  
  // Ações
  setConnectionStatus: (status: ConnectionStatus) => void;
  setConnectionLatency: (latency: number | null) => void;
  setReconnectAttempt: (attempt: number) => void;
  showIdleWarning: (remainingSeconds: number) => void;
  hideIdleWarning: () => void;
  setExecutionStatus: (
    status: RuntimeState["executionStatus"],
    metadata?: { agent?: string; conversation?: string }
  ) => void;
  reset: () => void;
}

const initialState = {
  connectionStatus: "disconnected" as ConnectionStatus,
  connectionLatency: null,
  reconnectAttempt: 0,
  isWarningVisible: false,
  timeRemaining: null,
  executionStatus: "idle" as const,
  currentAgent: null,
  currentConversation: null,
};

export const useRuntimeStore = create<RuntimeState>((set) => ({
  ...initialState,

  setConnectionStatus: (status: ConnectionStatus) => 
    set({ connectionStatus: status }),

  setConnectionLatency: (latency: number | null) => 
    set({ connectionLatency: latency }),

  setReconnectAttempt: (attempt: number) => 
    set({ reconnectAttempt: attempt }),

  showIdleWarning: (remainingSeconds: number) => 
    set({ 
      isWarningVisible: true, 
      timeRemaining: remainingSeconds 
    }),

  hideIdleWarning: () => 
    set({ 
      isWarningVisible: false, 
      timeRemaining: null 
    }),

  setExecutionStatus: (
    status: RuntimeState["executionStatus"],
    metadata?: { agent?: string; conversation?: string }
  ) => set({
    executionStatus: status,
    currentAgent: metadata?.agent || null,
    currentConversation: metadata?.conversation || null,
  }),

  reset: () => set(initialState),
}));

// ============================================
// Selectores
// ============================================

export function useConnectionStatus(): ConnectionStatus {
  return useRuntimeStore(state => state.connectionStatus);
}

export function useIsOnline(): boolean {
  return useRuntimeStore(state => state.connectionStatus === "online");
}

export function useConnectionLatency(): number | null {
  return useRuntimeStore(state => state.connectionLatency);
}

export function useExecutionStatus(): RuntimeState["executionStatus"] {
  return useRuntimeStore(state => state.executionStatus);
}
