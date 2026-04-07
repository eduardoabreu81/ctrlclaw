/**
 * Service Interfaces - CtrlClaw
 * 
 * Contratos para serviços da aplicação.
 * Implementações concretas em features/[domain]/services/
 */

import {
  Agent,
  AuthResult,
  AuthSession,
  Conversation,
  CreateAgentConfig,
  LoginCredentials,
  Message,
  User,
} from '@/types/entities';
import {
  ReconnectConfig,
  WSClientMessage,
  WSServerMessage,
  WSTopic,
} from '@/types/websocket';

// ============================================
// Auth Service
// ============================================

export interface IAuthService {
  /**
   * Autentica usuário e inicia sessão.
   */
  login(
    credentials: LoginCredentials,
    options?: LoginOptions
  ): Promise<AuthResult>;
  
  /**
   * Encerra sessão atual.
   */
  logout(): Promise<void>;
  
  /**
   * Valida sessão atual com backend.
   */
  validateSession(): Promise<User>;
  
  /**
   * Verifica se há sessão válida (client-side check).
   */
  hasValidSession(): boolean;
  
  /**
   * Retorna token atual (se existir).
   */
  getToken(): string | null;
  
  /**
   * Retorna usuário atual (se autenticado).
   */
  getCurrentUser(): User | null;
}

export interface LoginOptions {
  /** 
   * Modo de persistência do token.
   * @default 'memory'
   */
  storageMode?: 'memory' | 'session';
}

// ============================================
// Chat Service
// ============================================

export interface IChatService {
  /**
   * Envia mensagem para o backend.
   */
  sendMessage(
    content: string,
    conversationId?: string
  ): Promise<void>;
  
  /**
   * Solicita histórico de conversa.
   * @returns Promise que resolve quando histórico chegar via WS
   */
  loadHistory(conversationId: string): Promise<void>;
  
  /**
   * Cria nova conversa.
   */
  createConversation(agentId?: string): Promise<Conversation>;
  
  /**
   * Arquiva conversa.
   */
  archiveConversation(conversationId: string): Promise<void>;
  
  /**
   * Retorna conversa ativa atual.
   */
  getActiveConversation(): Conversation | null;
  
  /**
   * Define conversa ativa.
   */
  setActiveConversation(conversationId: string | null): void;
}

// ============================================
// Agent Service
// ============================================

export interface IAgentService {
  /**
   * Lista todos os agentes.
   */
  listAgents(): Promise<Agent[]>;
  
  /**
   * Retorna agente específico.
   */
  getAgent(id: string): Promise<Agent>;
  
  /**
   * Cria novo agente (se backend suportar).
   * @throws NotImplementedError se não suportado
   */
  createAgent(config: CreateAgentConfig): Promise<Agent>;
  
  /**
   * Atualiza agente (se backend suportar).
   * @throws NotImplementedError se não suportado
   */
  updateAgent(id: string, config: Partial<Agent['configuration']>): Promise<Agent>;
  
  /**
   * Remove agente (se backend suportar).
   * @throws NotImplementedError se não suportado
   */
  deleteAgent(id: string): Promise<void>;
  
  /**
   * Inicia conversa com agente.
   */
  startConversation(agentId: string): Promise<Conversation>;
  
  /**
   * Subscreve em atualizações de agente.
   * @returns Função de unsubscribe
   */
  subscribeToUpdates(
    agentId: string,
    callback: (agent: Agent) => void
  ): () => void;
}

// ============================================
// WebSocket Service
// ============================================

export interface IWebSocketService {
  /**
   * Conecta ao WebSocket.
   */
  connect(): Promise<void>;
  
  /**
   * Desconecta do WebSocket.
   */
  disconnect(): void;
  
  /**
   * Envia mensagem para o servidor.
   */
  send(message: WSClientMessage): void;
  
  /**
   * Subscreve em mensagens do servidor.
   * @returns Função de unsubscribe
   */
  onMessage(
    handler: (message: WSServerMessage) => void
  ): () => void;
  
  /**
   * Subscreve em mudanças de estado de conexão.
   * @returns Função de unsubscribe
   */
  onConnectionChange(
    handler: (status: ConnectionStatus) => void
  ): () => void;
  
  /**
   * Subscreve em erros.
   * @returns Função de unsubscribe
   */
  onError(
    handler: (error: WebSocketError) => void
  ): () => void;
  
  /**
   * Retorna estado atual da conexão.
   */
  getConnectionStatus(): ConnectionStatus;
  
  /**
   * Verifica se está conectado e autenticado.
   */
  isReady(): boolean;
  
  /**
   * Força reconexão.
   */
  reconnect(): Promise<void>;
  
  /**
   * Subscreve em tópicos.
   */
  subscribe(topics: WSTopic[]): void;
  
  /**
   * Cancela subscrição de tópicos.
   */
  unsubscribe(topics: WSTopic[]): void;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticating'
  | 'online'
  | 'reconnecting'
  | 'error';

export interface WebSocketError {
  code: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

export interface WebSocketOptions {
  autoReconnect?: boolean;
  reconnectConfig?: Partial<ReconnectConfig>;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
}

// ============================================
// Runtime Service
// ============================================

export interface IRuntimeService {
  /**
   * Inicializa runtime (chamado no startup).
   */
  initialize(): Promise<void>;
  
  /**
   * Registra atividade do usuário.
   * Usado para idle timeout.
   */
  registerActivity(): void;
  
  /**
   * Retorna tempo desde última atividade.
   */
  getIdleTime(): number;
  
  /**
   * Retorna estado de execução atual.
   */
  getExecutionStatus(): ExecutionStatus;
  
  /**
   * Define estado de execução.
   */
  setExecutionStatus(status: ExecutionStatus, metadata?: ExecutionMetadata): void;
  
  /**
   * Subscreve em mudanças de estado.
   */
  onStatusChange(
    handler: (status: RuntimeStatus) => void
  ): () => void;
  
  /**
   * Limpa estado (logout/shutdown).
   */
  reset(): void;
}

export interface ExecutionStatus {
  state: 'idle' | 'processing' | 'waiting' | 'error';
  currentAgent?: string;
  currentConversation?: string;
  startTime?: Date;
  progress?: number;
}

export interface ExecutionMetadata {
  agentId?: string;
  conversationId?: string;
  operation: string;
}

export interface RuntimeStatus {
  connection: ConnectionStatus;
  session: SessionStatus;
  execution: ExecutionStatus;
  idleTime: number;
}

export interface SessionStatus {
  isAuthenticated: boolean;
  expiresAt?: Date;
  lastActivityAt: Date;
}

// ============================================
// Storage Service (Non-sensitive only!)
// ============================================

/**
 * ⚠️ SECURITY: This service ONLY stores non-sensitive UI preferences.
 * NEVER use for tokens, messages, or user data.
 */
export interface IStorageService {
  /**
   * Armazena valor (session-only).
   */
  set<T>(key: string, value: T): void;
  
  /**
   * Recupera valor.
   */
  get<T>(key: string): T | null;
  
  /**
   * Remove valor.
   */
  remove(key: string): void;
  
  /**
   * Limpa todos os valores.
   */
  clear(): void;
}

// ============================================
// Error Handler Service
// ============================================

export interface IErrorHandlerService {
  /**
   * Registra erro para análise.
   */
  logError(error: Error, context?: Record<string, unknown>): void;
  
  /**
   * Mostra erro para usuário.
   */
  showError(error: UserFacingError): void;
  
  /**
   * Mostra warning.
   */
  showWarning(message: string): void;
  
  /**
   * Mostra info.
   */
  showInfo(message: string): void;
  
  /**
   * Mostra sucesso.
   */
  showSuccess(message: string): void;
}

export interface UserFacingError {
  title: string;
  message: string;
  code?: string;
  action?: {
    label: string;
    handler: () => void;
  };
  recoverable: boolean;
}
