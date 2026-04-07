/**
 * Backend Adapter Interface - CtrlClaw
 * 
 * Camada de abstração para suportar múltiplos backends Claw-like.
 * Implementações: NanoClawAdapter, OpenClawAdapter, MockAdapter
 */

import {
  Agent,
  AgentConfiguration,
  AuthResult,
  LoginCredentials,
  User,
} from './entities';
import { WebSocketConfig } from './websocket';

// ============================================
// Adapter Interface
// ============================================

export interface ClawBackendAdapter {
  /** Identificador do tipo de backend */
  readonly type: string;
  
  /** Versão do adapter */
  readonly version: string;
  
  /** Capabilidades suportadas por este backend */
  readonly capabilities: BackendCapability[];

  // ----------------------------------------
  // Authentication
  // ----------------------------------------
  
  /**
   * Autentica usuário com credenciais.
   * @throws AuthError em caso de falha
   */
  login(credentials: LoginCredentials): Promise<AuthResult>;
  
  /**
   * Invalida sessão no backend.
   */
  logout(token: string): Promise<void>;
  
  /**
   * Valida sessão e retorna dados atualizados do usuário.
   * @throws AuthError se token inválido
   */
  validateSession(token: string): Promise<User>;
  
  /**
   * Renova token de acesso (opcional).
   * @throws AuthError se refresh não suportado ou falhou
   */
  refreshToken?(token: string): Promise<AuthResult>;

  // ----------------------------------------
  // Agents
  // ----------------------------------------
  
  /**
   * Lista todos os agentes disponíveis.
   */
  listAgents(token: string): Promise<Agent[]>;
  
  /**
   * Retorna detalhes de um agente específico.
   * @throws NotFoundError se agente não existe
   */
  getAgent(token: string, id: string): Promise<Agent>;
  
  /**
   * Cria novo agente (se suportado).
   * @throws NotImplementedError se não suportado
   */
  createAgent?(token: string, config: CreateAgentConfig): Promise<Agent>;
  
  /**
   * Atualiza configuração de agente (se suportado).
   * @throws NotImplementedError se não suportado
   */
  updateAgent?(
    token: string, 
    id: string, 
    config: Partial<AgentConfiguration>
  ): Promise<Agent>;
  
  /**
   * Remove agente (se suportado).
   * @throws NotImplementedError se não suportado
   */
  deleteAgent?(token: string, id: string): Promise<void>;

  // ----------------------------------------
  // URLs
  // ----------------------------------------
  
  /**
   * Retorna URL base do backend (HTTP/HTTPS).
   */
  getHttpUrl(): string;
  
  // ----------------------------------------
  // WebSocket
  // ----------------------------------------
  
  /**
   * Retorna URL completa do WebSocket.
   */
  getWebSocketUrl(token: string): string;
  
  /**
   * Retorna configuração completa de WebSocket.
   */
  getWebSocketConfig(token: string): WebSocketConfig;

  // ----------------------------------------
  // Capabilities
  // ----------------------------------------
  
  /**
   * Verifica se backend suporta feature específica.
   */
  supports(feature: BackendCapability): boolean;
}

// ============================================
// Capabilities
// ============================================

export type BackendCapability =
  | 'oauth_login'           // Login via Google/GitHub/etc
  | 'refresh_token'         // Token rotation suportado
  | 'agent_creation'        // Criar agentes via API
  | 'agent_deletion'        // Remover agentes via API
  | 'agent_configuration'   // Configurar parâmetros de agente
  | 'flow_orchestration'    // Multi-agent flows
  | 'multi_workspace'       // Múltiplos workspaces/tenants
  | 'file_upload'           // Upload de arquivos
  | 'persistent_history';   // Histórico persistente no backend

// ============================================
// Configuration Types
// ============================================

export interface CreateAgentConfig {
  name: string;
  description?: string;
  configuration?: AgentConfiguration;
  capabilities?: string[];
}

export type BackendType = 'nanoclaw' | 'openclaw' | 'mock';

// ============================================
// Errors
// ============================================

export class BackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

export class AuthError extends BackendError {
  constructor(
    code: string,
    message: string,
    cause?: unknown
  ) {
    super(code, message, cause);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends BackendError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} with id '${id}' not found`);
    this.name = 'NotFoundError';
  }
}

export class NotImplementedError extends BackendError {
  constructor(feature: string) {
    super('NOT_IMPLEMENTED', `Feature '${feature}' not implemented for this backend`);
    this.name = 'NotImplementedError';
  }
}

// ============================================
// Factory Configuration
// ============================================

export interface BackendFactoryConfig {
  type: BackendType;
  apiUrl: string;
  wsUrl: string;
  timeout?: number;
}
