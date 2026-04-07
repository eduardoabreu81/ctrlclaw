/**
 * Mock Adapter - CtrlClaw
 * 
 * Backend simulado para desenvolvimento e testes.
 * Implementa ClawBackendAdapter com dados mockados.
 * 
 * Permite desenvolvimento independente de backend real.
 * Útil para:
 * - Desenvolvimento local (cenário Local do ADR 4)
 * - Testes unitários e de integração
 * - Demonstrações
 * - CI/CD sem dependência de backend
 */

import {
  ClawBackendAdapter,
  BackendCapability,
  CreateAgentConfig,
  AuthError,
  NotFoundError,
  NotImplementedError,
} from "@/types/backend-adapter";
import {
  Agent,
  AuthResult,
  LoginCredentials,
  User,
} from "@/types/entities";
import { WebSocketConfig } from "@/types/websocket";

// Dados mockados
const MOCK_USERS: Record<string, { password: string; user: User }> = {
  admin: {
    password: "admin123",
    user: {
      username: "admin",
      permissions: ["read", "write", "admin"],
    },
  },
  user: {
    password: "user123",
    user: {
      username: "user",
      permissions: ["read", "write"],
    },
  },
};

const MOCK_AGENTS: Agent[] = [
  {
    id: "agent-001",
    name: "Research Assistant",
    description: "Agent for web research and summarization",
    status: "idle",
    capabilities: ["search", "summarize", "analyze"],
    configuration: {
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 2000,
    },
    createdAt: "2026-01-15T10:00:00Z",
    lastActivity: "2026-04-07T08:30:00Z",
    stats: {
      messagesProcessed: 1523,
      lastActive: "2026-04-07T08:30:00Z",
    },
  },
  {
    id: "agent-002",
    name: "Code Assistant",
    description: "Agent for code review and generation",
    status: "busy",
    capabilities: ["code_review", "code_generation", "refactoring"],
    configuration: {
      model: "gpt-4",
      temperature: 0.3,
      maxTokens: 4000,
    },
    createdAt: "2026-02-20T14:00:00Z",
    lastActivity: "2026-04-07T09:15:00Z",
    stats: {
      messagesProcessed: 892,
      lastActive: "2026-04-07T09:15:00Z",
    },
  },
  {
    id: "agent-003",
    name: "Data Analyzer",
    description: "Agent for data analysis and visualization",
    status: "offline",
    capabilities: ["data_analysis", "visualization", "reporting"],
    createdAt: "2026-03-10T09:00:00Z",
    lastActivity: "2026-04-06T18:00:00Z",
    stats: {
      messagesProcessed: 445,
      lastActive: "2026-04-06T18:00:00Z",
    },
  },
];

export class MockClawAdapter implements ClawBackendAdapter {
  readonly type = "mock";
  readonly version = "1.0.0-mock";
  readonly capabilities: BackendCapability[] = [
    "agent_creation",
    "agent_deletion",
    "agent_configuration",
  ];

  private sessions = new Map<string, User>();
  private agents = new Map<string, Agent>(MOCK_AGENTS.map(a => [a.id, a]));
  private latency = 100; // ms simulados de delay
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL || "http://localhost:3001";
    console.log("[MockAdapter] Inicializado - desenvolvimento local");
  }

  // ============================================
  // URL
  // ============================================

  getHttpUrl(): string {
    return this.baseUrl;
  }

  // ============================================
  // Authentication
  // ============================================

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    await this.simulateLatency();

    const mockUser = MOCK_USERS[credentials.username];
    
    if (!mockUser || mockUser.password !== credentials.password) {
      throw new AuthError("AUTH_INVALID_CREDENTIALS", "Invalid username or password");
    }

    // Gerar token mock
    const token = `mock-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Armazenar sessão
    this.sessions.set(token, mockUser.user);

    console.log(`[MockAdapter] Login: ${credentials.username}`);

    return {
      token,
      user: mockUser.user,
      expiresIn: 1800, // 30 minutos
    };
  }

  async logout(token: string): Promise<void> {
    await this.simulateLatency();
    
    this.sessions.delete(token);
    
    console.log("[MockAdapter] Logout");
  }

  async validateSession(token: string): Promise<User> {
    await this.simulateLatency();

    const user = this.sessions.get(token);
    
    if (!user) {
      throw new AuthError("AUTH_INVALID_TOKEN", "Session invalid or expired");
    }

    return user;
  }

  // ============================================
  // Agents
  // ============================================

  async listAgents(token: string): Promise<Agent[]> {
    await this.simulateLatency();
    
    // Validar token
    await this.validateSession(token);

    return Array.from(this.agents.values());
  }

  async getAgent(token: string, id: string): Promise<Agent> {
    await this.simulateLatency();
    
    await this.validateSession(token);

    const agent = this.agents.get(id);
    
    if (!agent) {
      throw new NotFoundError("Agent", id);
    }

    return agent;
  }

  async createAgent(token: string, config: CreateAgentConfig): Promise<Agent> {
    await this.simulateLatency();
    
    await this.validateSession(token);

    const newAgent: Agent = {
      id: `agent-${Date.now()}`,
      name: config.name,
      description: config.description,
      status: "idle",
      capabilities: config.capabilities || [],
      configuration: config.configuration,
      createdAt: new Date().toISOString(),
      stats: {
        messagesProcessed: 0,
      },
    };

    this.agents.set(newAgent.id, newAgent);
    
    console.log(`[MockAdapter] Created agent: ${newAgent.id}`);

    return newAgent;
  }

  async updateAgent(
    token: string,
    id: string,
    config: Partial<Agent["configuration"]>
  ): Promise<Agent> {
    await this.simulateLatency();
    
    await this.validateSession(token);

    const agent = await this.getAgent(token, id);
    
    const updated: Agent = {
      ...agent,
      configuration: {
        ...agent.configuration,
        ...config,
      },
    };

    this.agents.set(id, updated);
    
    console.log(`[MockAdapter] Updated agent: ${id}`);

    return updated;
  }

  async deleteAgent(token: string, id: string): Promise<void> {
    await this.simulateLatency();
    
    await this.validateSession(token);

    if (!this.agents.has(id)) {
      throw new NotFoundError("Agent", id);
    }

    this.agents.delete(id);
    
    console.log(`[MockAdapter] Deleted agent: ${id}`);
  }

  // ============================================
  // WebSocket
  // ============================================

  getWebSocketUrl(token: string): string {
    // Mock não tem WebSocket real, mas retorna URL válida para testes
    const wsUrl = process.env.CLAW_WS_URL || "ws://localhost:3001";
    return `${wsUrl}?v=1&mock=true`;
  }

  getWebSocketConfig(token: string): WebSocketConfig {
    return {
      url: this.getWebSocketUrl(token),
      protocols: [],
      authMethod: "message",
    };
  }

  // ============================================
  // Capabilities
  // ============================================

  supports(feature: BackendCapability): boolean {
    return this.capabilities.includes(feature);
  }

  // ============================================
  // Helpers
  // ============================================

  private async simulateLatency(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.latency));
  }

  /**
   * Configura delay simulado (para testes)
   */
  setLatency(ms: number): void {
    this.latency = ms;
  }

  /**
   * Limpa todas as sessões (para testes)
   */
  clearSessions(): void {
    this.sessions.clear();
  }

  /**
   * Reseta agents para estado inicial (para testes)
   */
  resetAgents(): void {
    this.agents.clear();
    MOCK_AGENTS.forEach(a => this.agents.set(a.id, a));
  }
}
