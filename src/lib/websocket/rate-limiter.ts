/**
 * WebSocket Rate Limiter - P4.2
 * 
 * Rate limiting por dimensão (connection, message, reconnect)
 * com identidade priorizada: userId > sessionId > ipHash
 */

import * as crypto from 'crypto';

// ============================================
// Configuration
// ============================================

export interface WsRateLimitConfig {
  connectionLimit: number;
  messageLimit: number;
  reconnectLimit: number;
  windowMs: number;
  reconnectPenaltyMs: number;
}

export const DEFAULT_WS_RATE_LIMIT: WsRateLimitConfig = {
  connectionLimit: 10,
  messageLimit: 50,
  reconnectLimit: 5,
  windowMs: 60 * 1000, // 60 seconds
  reconnectPenaltyMs: 5000, // 5 seconds delay
};

// ============================================
// Types
// ============================================

export interface WsIdentity {
  type: 'user' | 'session' | 'ip';
  hash: string;
  raw?: string; // Only for internal use, never log this
}

export interface WsRateLimitResult {
  allowed: boolean;
  dimension: 'connection' | 'message' | 'reconnect';
  current: number;
  limit: number;
  resetAt: number;
  retryAfter?: number;
}

export interface WsRateLimitCheck {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  quota?: {
    limit: number;
    used: number;
    resetAt: string;
  };
}

// ============================================
// Identity Resolution
// ============================================

/**
 * Extrai identidade priorizada: userId > sessionId > ip
 */
export function extractWsIdentity(
  userId?: string,
  sessionId?: string,
  clientIp?: string
): WsIdentity {
  if (userId) {
    return { type: 'user', hash: hashIdentity(userId), raw: userId };
  }
  
  if (sessionId) {
    return { type: 'session', hash: hashIdentity(sessionId), raw: sessionId };
  }
  
  const ip = clientIp || 'unknown';
  return { type: 'ip', hash: hashIdentity(ip), raw: ip };
}

function hashIdentity(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
}

// ============================================
// Metrics (Aggregated)
// ============================================

interface WsRateLimitMetrics {
  connectionLimitHits: number;
  messageLimitHits: number;
  reconnectPenaltyHits: number;
  activeConnections: number;
  blockedConnections: number;
}

const metrics: WsRateLimitMetrics = {
  connectionLimitHits: 0,
  messageLimitHits: 0,
  reconnectPenaltyHits: 0,
  activeConnections: 0,
  blockedConnections: 0,
};

export function recordConnectionLimitHit(): void {
  metrics.connectionLimitHits++;
}

export function recordMessageLimitHit(): void {
  metrics.messageLimitHits++;
}

export function recordReconnectPenaltyHit(): void {
  metrics.reconnectPenaltyHits++;
}

export function incrementActiveConnections(): void {
  metrics.activeConnections++;
}

export function decrementActiveConnections(): void {
  metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
}

export function incrementBlockedConnections(): void {
  metrics.blockedConnections++;
}

export function getWsRateLimitMetrics(): Readonly<WsRateLimitMetrics> {
  return { ...metrics };
}

export function resetWsRateLimitMetrics(): void {
  metrics.connectionLimitHits = 0;
  metrics.messageLimitHits = 0;
  metrics.reconnectPenaltyHits = 0;
  metrics.activeConnections = 0;
  metrics.blockedConnections = 0;
}

// ============================================
// Structured Logging
// ============================================

interface RateLimitLogEntry {
  timestamp: string;
  level: 'WARN' | 'ERROR';
  event: 'WS_RATE_LIMIT_HIT' | 'WS_RATE_LIMIT_ERROR';
  dimension: 'connection' | 'message' | 'reconnect';
  identityType: 'user' | 'session' | 'ip';
  identityHash: string;
  limit: number;
  current: number;
  windowMs: number;
  action: 'REJECTED' | 'DELAYED' | 'CLOSED';
  retryAfter?: number;
}

export function logRateLimitHit(
  entry: Omit<RateLimitLogEntry, 'timestamp' | 'level' | 'event'>
): void {
  const logEntry: RateLimitLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    event: 'WS_RATE_LIMIT_HIT',
    ...entry,
  };
  
  // Log structured (no raw identifiers)
  console.log(JSON.stringify(logEntry));
}

// ============================================
// In-Memory Store (with cleanup)
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  
  constructor() {
    // Cleanup every 60 seconds
    setInterval(() => this.cleanup(), 60000);
  }
  
  increment(key: string, windowMs: number): { count: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);
    
    if (!entry || now > entry.resetAt) {
      // New window
      const newEntry: RateLimitEntry = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.store.set(key, newEntry);
      return { count: 1, resetAt: newEntry.resetAt };
    }
    
    // Increment existing
    entry.count++;
    return { count: entry.count, resetAt: entry.resetAt };
  }
  
  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    
    // Check if expired
    if (Date.now() > entry.resetAt) {
      this.store.delete(key);
      return undefined;
    }
    
    return entry;
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimitStore = new RateLimitStore();

// ============================================
// Rate Limit Check Functions
// ============================================

export function checkConnectionLimit(
  identity: WsIdentity,
  config: WsRateLimitConfig = DEFAULT_WS_RATE_LIMIT
): WsRateLimitCheck {
  const key = `ws:conn:${identity.type}:${identity.hash}`;
  const { count, resetAt } = rateLimitStore.increment(key, config.windowMs);
  
  if (count > config.connectionLimit) {
    recordConnectionLimitHit();
    incrementBlockedConnections();
    
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    
    logRateLimitHit({
      dimension: 'connection',
      identityType: identity.type,
      identityHash: identity.hash,
      limit: config.connectionLimit,
      current: count,
      windowMs: config.windowMs,
      action: 'REJECTED',
      retryAfter,
    });
    
    return {
      allowed: false,
      reason: 'WS_QUOTA_EXHAUSTED',
      retryAfter,
      quota: {
        limit: config.connectionLimit,
        used: count,
        resetAt: new Date(resetAt).toISOString(),
      },
    };
  }
  
  incrementActiveConnections();
  return { allowed: true };
}

export function checkMessageLimit(
  identity: WsIdentity,
  config: WsRateLimitConfig = DEFAULT_WS_RATE_LIMIT
): WsRateLimitCheck {
  const key = `ws:msg:${identity.type}:${identity.hash}`;
  const { count, resetAt } = rateLimitStore.increment(key, config.windowMs);
  
  if (count > config.messageLimit) {
    recordMessageLimitHit();
    
    logRateLimitHit({
      dimension: 'message',
      identityType: identity.type,
      identityHash: identity.hash,
      limit: config.messageLimit,
      current: count,
      windowMs: config.windowMs,
      action: 'CLOSED',
    });
    
    return {
      allowed: false,
      reason: 'WS_MESSAGE_QUOTA_EXCEEDED',
      quota: {
        limit: config.messageLimit,
        used: count,
        resetAt: new Date(resetAt).toISOString(),
      },
    };
  }
  
  return { allowed: true };
}

export function checkReconnectLimit(
  identity: WsIdentity,
  config: WsRateLimitConfig = DEFAULT_WS_RATE_LIMIT
): { allowed: boolean; shouldDelay: boolean; retryAfter?: number } {
  const key = `ws:reconn:${identity.type}:${identity.hash}`;
  const { count, resetAt } = rateLimitStore.increment(key, config.windowMs);
  
  if (count > config.reconnectLimit) {
    recordReconnectPenaltyHit();
    
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    
    logRateLimitHit({
      dimension: 'reconnect',
      identityType: identity.type,
      identityHash: identity.hash,
      limit: config.reconnectLimit,
      current: count,
      windowMs: config.windowMs,
      action: 'DELAYED',
      retryAfter,
    });
    
    return {
      allowed: false,
      shouldDelay: true,
      retryAfter,
    };
  }
  
  return { allowed: true, shouldDelay: false };
}

// ============================================
// Cleanup on Disconnect
// ============================================

export function cleanupConnection(identity: WsIdentity): void {
  decrementActiveConnections();
  
  // Note: We don't decrement counters here because rate limiting
  // is window-based, not connection-count-based
}

// ============================================
// Export Config
// ============================================

export function getWsRateLimitConfig(): WsRateLimitConfig {
  return { ...DEFAULT_WS_RATE_LIMIT };
}
