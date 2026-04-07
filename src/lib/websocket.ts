/**
 * WebSocket Manager - CtrlClaw
 * 
 * Gerenciamento completo de conexão WebSocket.
 * Implementa decisões do ADR 3:
 * - Message-based auth
 * - 10 tentativas de reconexão
 * - Exponential backoff (1s base, 30s max)
 * - Heartbeat 30s/10s
 * - Fila de mensagens durante reconnect
 * 
 * Responsabilidades:
 * - Connection lifecycle
 * - Reconnection com backoff
 * - Heartbeat (ping/pong)
 * - Message routing
 * - Estado da conexão
 * - Fila de mensagens
 */

import {
  WSClientMessage,
  WSServerMessage,
  WSConnectionOptions,
  DEFAULT_RECONNECT_CONFIG,
  DEFAULT_WS_OPTIONS,
  isWSServerMessage,
  isAuthSuccessMessage,
  isAuthFailedMessage,
  isErrorMessage,
  isPongMessage,
} from "@/types/websocket";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "online"
  | "reconnecting"
  | "error";

interface QueuedMessage {
  message: WSClientMessage;
  timestamp: number;
  retries: number;
}

interface WebSocketState {
  status: ConnectionStatus;
  reconnectAttempt: number;
  lastError?: string;
  latencyMs?: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private state: WebSocketState = {
    status: "disconnected",
    reconnectAttempt: 0,
  };
  
  private options: WSConnectionOptions;
  private messageQueue: QueuedMessage[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;
  
  private messageHandlers: Set<(message: WSServerMessage) => void> = new Set();
  private statusHandlers: Set<(status: ConnectionStatus) => void> = new Set();
  private errorHandlers: Set<(error: { code: string; message: string }) => void> = new Set();
  
  private url: string = "";
  private token: string = "";
  private isManualDisconnect: boolean = false;

  constructor(options: Partial<WSConnectionOptions> = {}) {
    this.options = {
      ...DEFAULT_WS_OPTIONS,
      ...options,
    };
  }

  // ============================================
  // Conexão
  // ============================================

  async connect(url: string, token: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.url = url;
    this.token = token;
    this.isManualDisconnect = false;
    
    this.updateState({ status: "connecting" });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 10000);

      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          clearTimeout(timeout);
          // Aguardar auth_required do servidor
        };
        
        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
        
        this.ws.onclose = () => {
          this.handleClose();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data, resolve, reject);
        };
        
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, "Manual disconnect");
      this.ws = null;
    }
    
    this.updateState({ status: "disconnected", reconnectAttempt: 0 });
  }

  // ============================================
  // Autenticação
  // ============================================

  private handleMessage(
    data: string,
    resolve?: () => void,
    reject?: (error: Error) => void
  ): void {
    try {
      const parsed = JSON.parse(data);
      
      if (!isWSServerMessage(parsed)) {
        console.warn("[WebSocket] Mensagem inválida recebida:", data);
        return;
      }

      // Roteamento de mensagens
      switch (parsed.type) {
        case "auth_required":
          this.handleAuthRequired();
          break;
          
        case "auth_success":
          this.handleAuthSuccess(parsed, resolve);
          break;
          
        case "auth_failed":
          this.handleAuthFailed(parsed, reject);
          break;
          
        case "pong":
          this.handlePong();
          break;
          
        case "error":
          this.handleErrorMessage(parsed);
          break;
          
        default:
          // Broadcast para handlers
          this.messageHandlers.forEach(handler => {
            try {
              handler(parsed);
            } catch (e) {
              console.error("[WebSocket] Erro no handler:", e);
            }
          });
      }
      
    } catch (error) {
      console.error("[WebSocket] Erro ao parse mensagem:", error);
    }
  }

  private handleAuthRequired(): void {
    this.updateState({ status: "authenticating" });
    
    // Enviar token via mensagem (ADR 3)
    this.send({
      type: "authenticate",
      token: this.token,
      id: crypto.randomUUID(),
    });
  }

  private handleAuthSuccess(
    message: Extract<WSServerMessage, { type: "auth_success" }>,
    resolve?: () => void
  ): void {
    this.updateState({ 
      status: "online", 
      reconnectAttempt: 0,
      lastError: undefined,
    });
    
    this.startHeartbeat();
    this.flushMessageQueue();
    
    resolve?.();
  }

  private handleAuthFailed(
    message: Extract<WSServerMessage, { type: "auth_failed" }>,
    reject?: (error: Error) => void
  ): void {
    // ❌ NÃO reconectar em auth_failed (ADR 3)
    this.updateState({ 
      status: "error", 
      lastError: `${message.code}: ${message.reason}`,
    });
    
    this.clearTimers();
    this.ws?.close();
    
    // Notificar erro
    this.errorHandlers.forEach(handler => {
      handler({ code: message.code, message: message.reason });
    });
    
    reject?.(new Error(`Auth failed: ${message.reason}`));
  }

  // ============================================
  // Reconexão
  // ============================================

  private handleClose(): void {
    this.clearTimers();
    
    if (this.isManualDisconnect) {
      this.updateState({ status: "disconnected" });
      return;
    }
    
    // Verificar se deve reconectar
    if (this.state.reconnectAttempt >= this.options.reconnectConfig.maxAttempts) {
      this.updateState({ 
        status: "error", 
        lastError: "Max reconnection attempts exceeded",
      });
      return;
    }
    
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const attempt = this.state.reconnectAttempt;
    const delay = this.calculateReconnectDelay(attempt);
    
    this.updateState({ 
      status: "reconnecting", 
      reconnectAttempt: attempt + 1,
    });
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.url, this.token).catch(() => {
        // Erro será tratado em handleClose
      });
    }, delay);
  }

  private calculateReconnectDelay(attempt: number): number {
    const config = this.options.reconnectConfig;
    
    // Exponential backoff
    const exponential = Math.min(
      config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelayMs
    );
    
    // Jitter para evitar thundering herd
    const jitter = exponential * config.jitterFactor * Math.random();
    
    return Math.floor(exponential + jitter);
  }

  // ============================================
  // Heartbeat
  // ============================================

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      
      this.lastPingTime = Date.now();
      this.send({ type: "ping", timestamp: this.lastPingTime });
      
      // Timeout para pong
      this.heartbeatTimeoutTimer = setTimeout(() => {
        // Não recebeu pong - conexão stale
        this.handleStaleConnection();
      }, this.options.heartbeatTimeout);
      
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatTimeout();
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private handlePong(): void {
    this.clearHeartbeatTimeout();
    
    // Calcular latência
    const latency = Date.now() - this.lastPingTime;
    this.updateState({ latencyMs: latency });
  }

  private handleStaleConnection(): void {
    this.updateState({ lastError: "Connection stale (heartbeat timeout)" });
    this.ws?.close();
    // Reconexão será tratada em handleClose
  }

  // ============================================
  // Envio de Mensagens
  // ============================================

  send(message: WSClientMessage): void {
    // Se online, envia imediatamente
    if (this.state.status === "online" && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }
    
    // Se conectando/reconectando, enfileira
    if (this.state.status === "connecting" || 
        this.state.status === "authenticating" ||
        this.state.status === "reconnecting") {
      this.enqueueMessage(message);
      return;
    }
    
    // Se desconectado, erro
    throw new Error("WebSocket not connected");
  }

  private enqueueMessage(message: WSClientMessage): void {
    // Limite da fila: 100 mensagens
    if (this.messageQueue.length >= 100) {
      // Remove mais antiga
      this.messageQueue.shift();
      console.warn("[WebSocket] Fila cheia - mensagem antiga descartada");
    }
    
    this.messageQueue.push({
      message,
      timestamp: Date.now(),
      retries: 0,
    });
  }

  private flushMessageQueue(): void {
    // Remover mensagens muito antigas (> 5 min)
    const maxAge = 5 * 60 * 1000;
    const now = Date.now();
    
    this.messageQueue = this.messageQueue.filter(
      item => now - item.timestamp < maxAge
    );
    
    // Enviar mensagens enfileiradas
    while (this.messageQueue.length > 0) {
      const item = this.messageQueue.shift();
      if (item) {
        try {
          this.send(item.message);
        } catch (error) {
          console.error("[WebSocket] Erro ao enviar mensagem enfileirada:", error);
        }
      }
    }
  }

  // ============================================
  // Subscrição de Eventos
  // ============================================

  onMessage(handler: (message: WSServerMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: (status: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  onError(handler: (error: { code: string; message: string }) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  // ============================================
  // Getters
  // ============================================

  getConnectionStatus(): ConnectionStatus {
    return this.state.status;
  }

  isReady(): boolean {
    return this.state.status === "online";
  }

  getLatency(): number | undefined {
    return this.state.latencyMs;
  }

  getReconnectAttempt(): number {
    return this.state.reconnectAttempt;
  }

  // ============================================
  // Helpers
  // ============================================

  private updateState(updates: Partial<WebSocketState>): void {
    const previousStatus = this.state.status;
    this.state = { ...this.state, ...updates };
    
    // Notificar mudança de status
    if (previousStatus !== this.state.status) {
      this.statusHandlers.forEach(handler => {
        try {
          handler(this.state.status);
        } catch (e) {
          console.error("[WebSocket] Erro no status handler:", e);
        }
      });
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleErrorMessage(
    message: Extract<WSServerMessage, { type: "error" }>
  ): void {
    // Verificar se é erro fatal (não reconecta)
    const fatalCodes = ["AUTH_INVALID_TOKEN", "AUTH_EXPIRED_TOKEN"];
    
    if (fatalCodes.includes(message.code)) {
      this.updateState({ status: "error", lastError: message.message });
      this.disconnect();
      
      this.errorHandlers.forEach(handler => {
        handler({ code: message.code, message: message.message });
      });
      return;
    }
    
    // Erro recuperável - notifica mas mantém conexão
    this.errorHandlers.forEach(handler => {
      handler({ code: message.code, message: message.message });
    });
  }
}

// Singleton para aplicação
let wsManagerInstance: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!wsManagerInstance) {
    wsManagerInstance = new WebSocketManager();
  }
  return wsManagerInstance;
}

export function resetWebSocketManager(): void {
  wsManagerInstance?.disconnect();
  wsManagerInstance = null;
}
