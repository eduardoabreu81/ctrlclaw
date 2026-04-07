/**
 * NanoClaw Adapter - CtrlClaw
 * 
 * Backend de referência para v1.
 * Implementa ClawBackendAdapter para NanoClaw.
 * 
 * ⚠️ NOTA: NanoClaw é backend de REFERÊNCIA para validação da arquitetura.
 * O CtrlClaw permanece frontend genérico para ecossistema Claw.
 * 
 * Baseado nas decisões do checkpoint:
 * - Auth: Bearer token (sessionStorage trade-off v1)
 * - WebSocket: Message-based auth
 * - No cookie support (conforme verificado na ARCHITECTURE.md)
 */

import {
  ClawBackendAdapter,
  BackendCapability,
  CreateAgentConfig,
  BackendError,
  AuthError,
  NotFoundError,
  NotImplementedError,
} from "@/types/backend-adapter";
import {
  Agent,
  AuthResult,
  LoginCredentials,
  User,
  ListAgentsResponse,
  AuthMeResponse,
  LoginResponse,
} from "@/types/entities";
import { WebSocketConfig } from "@/types/websocket";

export class NanoClawAdapter implements ClawBackendAdapter {
  readonly type = "nanoclaw";
  readonly version = "1.0.0";
  readonly capabilities: BackendCapability[] = [];

  private baseUrl: string;
  private wsUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL || "http://localhost:3001";
    this.wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:3001";
    this.timeout = parseInt(process.env.BACKEND_TIMEOUT || "30000", 10);
  }

  // ============================================
  // Authentication
  // ============================================

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const url = `${this.baseUrl}/api/auth/login`;
    console.log("[NanoClawAdapter] Login URL:", url);
    console.log("[NanoClawAdapter] Credentials:", { username: credentials.username });
    
    const response = await this.fetchWithTimeout("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new AuthError(error.code || "AUTH_FAILED", error.message);
    }

    const data: LoginResponse = await response.json();

    // ⚠️ NOTA: NanoClaw retorna token no body (não cookie)
    // Este é o trade-off temporário da v1
    return {
      token: data.token,
      user: {
        username: data.username,
        permissions: ["read", "write", "admin"], // NanoClaw padrão
      },
      expiresIn: data.expiresIn || 1800, // 30 minutos padrão
    };
  }

  async logout(token: string): Promise<void> {
    try {
      await this.fetchWithTimeout("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          
        },
      });
    } catch {
      // Best effort - não falhar se logout remoto falhar
    }
  }

  async validateSession(token: string): Promise<User> {
    const response = await this.fetchWithTimeout("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthError("AUTH_INVALID_TOKEN", "Session invalid or expired");
      }
      const error = await this.parseError(response);
      throw new AuthError(error.code || "AUTH_FAILED", error.message);
    }

    const data: AuthMeResponse = await response.json();

    return {
      username: data.username,
      permissions: data.permissions || ["read", "write"],
    };
  }

  // ============================================
  // Agents
  // ============================================

  async listAgents(token: string): Promise<Agent[]> {
    const response = await this.fetchWithTimeout("/api/agents", {
      headers: {
        Authorization: `Bearer ${token}`,
        
      },
    });

    if (!response.ok) {
      throw new BackendError("AGENTS_FETCH_FAILED", "Failed to fetch agents");
    }

    const data: ListAgentsResponse = await response.json();
    return data.agents.map(this.mapAgent);
  }

  async getAgent(token: string, id: string): Promise<Agent> {
    const response = await this.fetchWithTimeout(`/api/agents/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError("Agent", id);
      }
      throw new BackendError("AGENT_FETCH_FAILED", `Failed to fetch agent ${id}`);
    }

    const data = await response.json();
    return this.mapAgent(data);
  }

  // ============================================
  // URL
  // ============================================

  getHttpUrl(): string {
    return this.baseUrl;
  }

  // ============================================
  // WebSocket
  // ============================================

  getWebSocketUrl(token: string): string {
    // NanoClaw usa auth via mensagem, não query param
    // Token não vai na URL por segurança
    return `${this.wsUrl}?v=1`;
  }

  getWebSocketConfig(token: string): WebSocketConfig {
    return {
      url: this.getWebSocketUrl(token),
      protocols: [],
      authMethod: "message", // Conforme ADR 3
    };
  }

  // ============================================
  // Capabilities
  // ============================================

  supports(feature: BackendCapability): boolean {
    return this.capabilities.includes(feature);
  }

  // ============================================
  // Métodos opcionais (não suportados na v1)
  // ============================================

  async createAgent(token: string, config: CreateAgentConfig): Promise<Agent> {
    throw new NotImplementedError("agent_creation");
  }

  async updateAgent(
    token: string,
    id: string,
    config: Partial<Agent["configuration"]>
  ): Promise<Agent> {
    throw new NotImplementedError("agent_configuration");
  }

  async deleteAgent(token: string, id: string): Promise<void> {
    throw new NotImplementedError("agent_deletion");
  }

  // ============================================
  // Helpers
  // ============================================

  private async fetchWithTimeout(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseError(response: Response): Promise<{ code: string; message: string }> {
    try {
      const data = await response.json();
      return {
        code: data.code || `HTTP_${response.status}`,
        message: data.error || data.message || `HTTP ${response.status}`,
      };
    } catch {
      return {
        code: `HTTP_${response.status}`,
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  }

  private mapAgent(data: unknown): Agent {
    // Type guard básico
    const d = data as Record<string, unknown>;
    
    return {
      id: String(d.id),
      name: String(d.name),
      description: d.description ? String(d.description) : undefined,
      status: (d.status as Agent["status"]) || "idle",
      capabilities: Array.isArray(d.capabilities) ? d.capabilities.map(String) : [],
      configuration: d.configuration as Agent["configuration"],
      createdAt: String(d.createdAt),
      lastActivity: d.lastActivity ? String(d.lastActivity) : undefined,
      stats: d.stats as Agent["stats"],
    };
  }
}
