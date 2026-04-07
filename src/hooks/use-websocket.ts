/**
 * useWebSocket Hook - CtrlClaw
 * 
 * Hook wrapper do WebSocketManager.
 * Integra com auth store para reconexão automática.
 */

import { useEffect, useCallback } from "react";
import { getWebSocketManager, ConnectionStatus } from "@/lib/websocket";
import { useRuntimeStore } from "@/stores/runtime-store";
import { useAuthToken } from "@/features/auth/stores/auth-store";
import { getBackendAdapter } from "@/lib/backend-factory";
import { WSServerMessage } from "@/types/websocket";

export function useWebSocket() {
  const token = useAuthToken();
  const status = useRuntimeStore(state => state.connectionStatus);
  const latency = useRuntimeStore(state => state.connectionLatency);
  const reconnectAttempt = useRuntimeStore(state => state.reconnectAttempt);
  
  const wsManager = getWebSocketManager();
  
  // Conectar quando tiver token
  useEffect(() => {
    if (!token) return;
    
    const connect = async () => {
      try {
        const adapter = await getBackendAdapter();
        const wsUrl = adapter.getWebSocketUrl(token);
        
        await wsManager.connect(wsUrl, token);
      } catch (error) {
        console.error("[useWebSocket] Falha ao conectar:", error);
      }
    };
    
    connect();
    
    return () => {
      wsManager.disconnect();
    };
  }, [token, wsManager]);
  
  // Sincronizar estado do manager com store
  useEffect(() => {
    const unsubscribeStatus = wsManager.onConnectionChange((newStatus) => {
      useRuntimeStore.getState().setConnectionStatus(newStatus);
    });
    
    const unsubscribeError = wsManager.onError((error) => {
      console.error("[useWebSocket] Erro:", error);
    });
    
    return () => {
      unsubscribeStatus();
      unsubscribeError();
    };
  }, [wsManager]);
  
  return {
    status,
    latency,
    reconnectAttempt,
    isOnline: status === "online",
    isConnecting: status === "connecting" || status === "authenticating",
    isReconnecting: status === "reconnecting",
  };
}

/**
 * Hook para escutar mensagens WebSocket
 */
export function useWebSocketMessage(
  handler: (message: WSServerMessage) => void
) {
  const wsManager = getWebSocketManager();
  
  useEffect(() => {
    return wsManager.onMessage(handler);
  }, [wsManager, handler]);
}

/**
 * Hook para enviar mensagens
 */
export function useWebSocketSend() {
  const wsManager = getWebSocketManager();
  const status = useRuntimeStore(state => state.connectionStatus);
  
  const send = useCallback(
    (message: Parameters<typeof wsManager.send>[0]) => {
      if (status !== "online") {
        console.warn("[useWebSocket] Tentativa de enviar sem conexão");
        return false;
      }
      
      try {
        wsManager.send(message);
        return true;
      } catch (error) {
        console.error("[useWebSocket] Erro ao enviar:", error);
        return false;
      }
    },
    [wsManager, status]
  );
  
  return send;
}
