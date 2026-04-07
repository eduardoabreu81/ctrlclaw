/**
 * Core Entities - CtrlClaw v1
 * 
 * Definições finais das entidades de domínio.
 * Nenhuma persistência local de conteúdo sensível.
 */

// ============================================
// User & Auth
// ============================================

export interface User {
  username: string;
  permissions: Permission[];
}

export type Permission = 'read' | 'write' | 'admin';

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: string; // ISO 8601
  obtainedAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: User;
  expiresIn: number;
}

// ============================================
// Agent
// ============================================

export interface Agent {
  id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  capabilities: string[];
  configuration?: AgentConfiguration;
  createdAt: string;
  lastActivity?: string;
  stats?: AgentStats;
}

export type AgentStatus = 'idle' | 'busy' | 'offline' | 'error';

export interface AgentConfiguration {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  [key: string]: unknown;
}

export interface AgentStats {
  messagesProcessed: number;
  lastActive?: string;
}

export interface CreateAgentConfig {
  name: string;
  description?: string;
  capabilities?: string[];
  configuration?: AgentConfiguration;
}

// ============================================
// Message & Conversation
// ============================================

export interface Message {
  id: string;
  conversationId: string;
  sender: string;        // agent ID ou "user"
  senderName: string;    // display name
  content: string;
  timestamp: string;
  isFromMe: boolean;
  type: MessageType;
  metadata?: MessageMetadata;
  status: MessageStatus;
}

export type MessageType = 'text' | 'system' | 'error' | 'command';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface MessageMetadata {
  agentId?: string;
  command?: string;
  executionTime?: number;
  tokensUsed?: number;
}

export interface Conversation {
  id: string;
  title: string;
  agentId?: string;      // undefined = chat principal
  messages: Message[];
  createdAt: string;
  lastActivity: string;
  unreadCount: number;
  status: ConversationStatus;
}

export type ConversationStatus = 'active' | 'archived' | 'error';

// ============================================
// Runtime State
// ============================================

export interface RuntimeState {
  connection: ConnectionState;
  session: SessionState;
  execution: ExecutionState;
}

export interface ConnectionState {
  status: ConnectionStatus;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastPingAt?: string;
  latencyMs?: number;
  reconnectAttempt: number;
  serverStatus?: ServerHealthStatus;
}

export type ConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'reconnecting';

export type ServerHealthStatus = 'healthy' | 'degraded' | 'overloaded';

export interface SessionState {
  isAuthenticated: boolean;
  user?: User;
  expiresAt?: string;
  lastActivityAt: string;
  storageMode: StorageMode;
}

export type StorageMode = 'memory' | 'session';

export interface ExecutionState {
  status: ExecutionStatus;
  currentAgent?: string;
  currentConversation?: string;
  startTime?: string;
  lastError?: ExecutionError;
}

export type ExecutionStatus = 'idle' | 'processing' | 'waiting' | 'error';

export interface ExecutionError {
  code: string;
  message: string;
  timestamp: string;
}

// ============================================
// UI State (Non-sensitive only)
// ============================================

/**
 * ⚠️ SECURITY: Only non-sensitive UI preferences.
 * NEVER store messages, tokens, or user data here.
 */
export interface UICache {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  activeConversationId: string | null; // ID only, not content
}

// ============================================
// API Response Types
// ============================================

export interface ListAgentsResponse {
  agents: Agent[];
  total: number;
}

export interface AuthMeResponse {
  username: string;
  permissions?: Permission[];
}

export interface LoginResponse {
  token: string;
  username: string;
  expiresIn?: number;
}

export interface LogoutResponse {
  ok: boolean;
}
