/**
 * WebSocket Protocol - CtrlClaw v1
 * 
 * Contrato formalizado de comunicação WebSocket.
 * Protocol version: 1
 */

import { Agent, Message } from './entities';

// ============================================
// Topics
// ============================================

export type WSTopic = 'messages' | 'agents' | 'system' | 'tasks';

// ============================================
// Client → Server Messages
// ============================================

export interface WSAuthenticateMessage {
  type: 'authenticate';
  token: string;
  id: string;  // UUID para correlation
}

export interface WSSubscribeMessage {
  type: 'subscribe';
  topics: WSTopic[];
  id: string;
}

export interface WSUnsubscribeMessage {
  type: 'unsubscribe';
  topics: WSTopic[];
  id: string;
}

export interface WSPingMessage {
  type: 'ping';
  timestamp: number;
}

export interface WSChatMessage {
  type: 'chat_message';
  content: string;
  conversationId?: string;
  id: string;
}

export interface WSAckMessage {
  type: 'ack';
  messageId: string;
}

export type WSClientMessage =
  | WSAuthenticateMessage
  | WSSubscribeMessage
  | WSUnsubscribeMessage
  | WSPingMessage
  | WSChatMessage
  | WSAckMessage;

// ============================================
// Server → Client Messages
// ============================================

export interface WSAuthRequiredMessage {
  type: 'auth_required';
  protocol: string;
}

export interface WSAuthSuccessMessage {
  type: 'auth_success';
  session: {
    username: string;
    expiresAt: string;
  };
  correlationId?: string;
}

export interface WSAuthFailedMessage {
  type: 'auth_failed';
  reason: string;
  code: WSErrorCode;
  correlationId?: string;
}

export interface WSSubscribedMessage {
  type: 'subscribed';
  topics: WSTopic[];
  correlationId?: string;
}

export interface WSMessageMessage {
  type: 'message';
  data: Message;
  id: string;
}

export interface WSAgentUpdateMessage {
  type: 'agent_update';
  data: Agent;
}

export interface WSAgentListMessage {
  type: 'agent_list';
  data: Agent[];
}

export interface WSConnectionStatusMessage {
  type: 'connection_status';
  status: 'healthy' | 'degraded' | 'overloaded';
  latency?: number;
}

export interface WSErrorMessage {
  type: 'error';
  code: WSErrorCode;
  message: string;
  correlationId?: string;
}

export interface WSPongMessage {
  type: 'pong';
  timestamp: number;
}

export type WSServerMessage =
  | WSAuthRequiredMessage
  | WSAuthSuccessMessage
  | WSAuthFailedMessage
  | WSSubscribedMessage
  | WSMessageMessage
  | WSAgentUpdateMessage
  | WSAgentListMessage
  | WSConnectionStatusMessage
  | WSErrorMessage
  | WSPongMessage;

// ============================================
// Error Codes
// ============================================

export type WSErrorCode =
  // Auth errors
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_EXPIRED_TOKEN'
  | 'AUTH_REQUIRED'
  // Rate limiting
  | 'RATE_LIMIT_EXCEEDED'
  // Validation errors
  | 'INVALID_MESSAGE_FORMAT'
  | 'UNKNOWN_TOPIC'
  // Server errors
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

// ============================================
// Configuration
// ============================================

export interface WebSocketConfig {
  url: string;
  protocols: string[];
  authMethod: 'message' | 'query_param' | 'header';
}

export interface WSConnectionOptions {
  autoReconnect: boolean;
  reconnectConfig: ReconnectConfig;
  heartbeatInterval: number;
  heartbeatTimeout: number;
}

export interface ReconnectConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

// ============================================
// Default Configurations
// ============================================

export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 10,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
};

export const DEFAULT_WS_OPTIONS: WSConnectionOptions = {
  autoReconnect: true,
  reconnectConfig: DEFAULT_RECONNECT_CONFIG,
  heartbeatInterval: 30000, // 30s
  heartbeatTimeout: 10000,  // 10s
};

// ============================================
// Message Type Guards
// ============================================

export function isWSServerMessage(data: unknown): data is WSServerMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as Record<string, unknown>).type === 'string'
  );
}

export function isAuthRequiredMessage(msg: WSServerMessage): msg is WSAuthRequiredMessage {
  return msg.type === 'auth_required';
}

export function isAuthSuccessMessage(msg: WSServerMessage): msg is WSAuthSuccessMessage {
  return msg.type === 'auth_success';
}

export function isAuthFailedMessage(msg: WSServerMessage): msg is WSAuthFailedMessage {
  return msg.type === 'auth_failed';
}

export function isMessageMessage(msg: WSServerMessage): msg is WSMessageMessage {
  return msg.type === 'message';
}

export function isAgentUpdateMessage(msg: WSServerMessage): msg is WSAgentUpdateMessage {
  return msg.type === 'agent_update';
}

export function isErrorMessage(msg: WSServerMessage): msg is WSErrorMessage {
  return msg.type === 'error';
}

export function isPongMessage(msg: WSServerMessage): msg is WSPongMessage {
  return msg.type === 'pong';
}
