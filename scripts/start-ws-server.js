#!/usr/bin/env node
/**
 * WebSocket Server com Rate Limiting Corrigido - P4.2
 * 
 * Correções:
 * - Reconnect limit removido do caminho de conexão normal
 * - Connection limit por identidade (user > ip)
 * - Logging detalhado de identidade
 * 
 * Uso: node scripts/start-ws-server.js
 */

const { WebSocketServer } = require('ws');
const { parse } = require('url');
const crypto = require('crypto');

// ============================================
// Rate Limiter Module (Inline)
// ============================================

const DEFAULT_WS_RATE_LIMIT = {
  connectionLimit: 10,
  messageLimit: 50,
  windowMs: 60 * 1000,
};

// Metrics
const metrics = {
  connectionLimitHits: 0,
  messageLimitHits: 0,
  activeConnections: 0,
  blockedConnections: 0,
  connectionsByIdentity: new Map(), // Para tracking/debug
};

function hashIdentity(value) {
  return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
}

function extractWsIdentity(userId, clientIp) {
  if (userId) {
    return { type: 'user', hash: hashIdentity(userId), raw: userId };
  }
  return { type: 'ip', hash: hashIdentity(clientIp || 'unknown'), raw: clientIp || 'unknown' };
}

function logRateLimitHit(entry) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'WARN',
    event: 'WS_RATE_LIMIT_HIT',
    ...entry,
  }));
}

// In-memory store com cleanup
class RateLimitStore {
  constructor() {
    this.store = new Map();
    setInterval(() => this.cleanup(), 60000);
  }
  
  increment(key, windowMs) {
    const now = Date.now();
    const entry = this.store.get(key);
    
    if (!entry || now > entry.resetAt) {
      const newEntry = { count: 1, resetAt: now + windowMs };
      this.store.set(key, newEntry);
      return { count: 1, resetAt: newEntry.resetAt };
    }
    
    entry.count++;
    return { count: entry.count, resetAt: entry.resetAt };
  }
  
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.resetAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimitStore = new RateLimitStore();

// APENAS Connection Limit (reconnect limit removido do caminho principal)
function checkConnectionLimit(identity) {
  const key = `ws:conn:${identity.type}:${identity.hash}`;
  const { count, resetAt } = rateLimitStore.increment(key, DEFAULT_WS_RATE_LIMIT.windowMs);
  
  // Log para debug de identidade
  console.log(`[RateLimit] ${identity.type}:${identity.hash.substring(0, 8)} count=${count}/${DEFAULT_WS_RATE_LIMIT.connectionLimit}`);
  
  if (count > DEFAULT_WS_RATE_LIMIT.connectionLimit) {
    metrics.connectionLimitHits++;
    metrics.blockedConnections++;
    
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    
    logRateLimitHit({
      dimension: 'connection',
      identityType: identity.type,
      identityHash: identity.hash,
      limit: DEFAULT_WS_RATE_LIMIT.connectionLimit,
      current: count,
      windowMs: DEFAULT_WS_RATE_LIMIT.windowMs,
      action: 'REJECTED',
      retryAfter,
    });
    
    return {
      allowed: false,
      reason: 'WS_QUOTA_EXHAUSTED',
      retryAfter,
      quota: { limit: DEFAULT_WS_RATE_LIMIT.connectionLimit, used: count },
    };
  }
  
  metrics.activeConnections++;
  
  // Track connections by identity for debugging
  const currentCount = metrics.connectionsByIdentity.get(identity.hash) || 0;
  metrics.connectionsByIdentity.set(identity.hash, currentCount + 1);
  
  return { allowed: true };
}

function cleanupConnection() {
  metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
}

// ============================================
// Connection Store
// ============================================

class ConnectionStore {
  constructor() {
    this.connections = new Map();
  }

  add(connection) {
    this.connections.set(connection.id, connection);
    console.log(`[WS Server] Connection added: ${connection.id}, total: ${this.connections.size}`);
  }

  remove(connectionId) {
    this.connections.delete(connectionId);
    console.log(`[WS Server] Connection removed: ${connectionId}, total: ${this.connections.size}`);
  }

  get(connectionId) {
    return this.connections.get(connectionId);
  }

  getAll() {
    return Array.from(this.connections.values());
  }
}

const connectionStore = new ConnectionStore();

// ============================================
// WebSocket Server
// ============================================

class WebSocketServerManager {
  constructor() {
    this.wss = null;
    this.heartbeatInterval = null;
    this.HEARTBEAT_INTERVAL = 30000;
  }

  start(port = 3002) {
    this.wss = new WebSocketServer({ port });

    console.log(`[WS Server] Starting on port ${port}`);
    console.log(`[WS Server] Rate limiting enabled:`);
    console.log(`  - Connection limit: ${DEFAULT_WS_RATE_LIMIT.connectionLimit}/${DEFAULT_WS_RATE_LIMIT.windowMs}ms`);
    console.log(`  - Identity priority: userId > ip`);

    this.wss.on('connection', (socket, req) => {
      this.handleConnection(socket, req);
    });

    this.startHeartbeat();

    console.log(`[WS Server] Started successfully on ws://localhost:${port}`);
    console.log(`[WS Server] Press Ctrl+C to stop`);
    
    // Metrics logging every 30s
    setInterval(() => {
      console.log(`[WS Server] Metrics:`, JSON.stringify({
        ...metrics,
        connectionsByIdentity: Array.from(metrics.connectionsByIdentity.entries()).map(([hash, count]) => ({
          hash: hash.substring(0, 8) + '...',
          count
        }))
      }));
    }, 30000);
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    connectionStore.getAll().forEach(conn => {
      conn.socket.close();
    });

    this.wss?.close();
    console.log('[WS Server] Stopped');
  }

  handleConnection(socket, req) {
    const { query } = parse(req.url || '', true);
    const token = query.token;
    
    // Extract client IP
    const clientIp = req.socket.remoteAddress || 'unknown';

    // Authentication
    if (!token) {
      console.log('[WS Server] Connection rejected: no token');
      socket.close(1008, 'Authentication required');
      return;
    }

    const userId = this.validateToken(token);
    const identity = extractWsIdentity(userId, clientIp);
    
    console.log(`[WS Server] Connection attempt from ${identity.type}:${identity.hash.substring(0, 8)} (raw: ${identity.raw.substring(0, 20)})`);

    // Check connection limit (APENAS connection limit, não reconnect)
    const connCheck = checkConnectionLimit(identity);
    if (!connCheck.allowed) {
      console.log(`[WS Server] Connection limit hit for ${identity.type}:${identity.hash.substring(0, 8)}`);
      
      const closeCode = 1013; // TRY_LATER
      const closeReason = JSON.stringify({
        code: 'WS_QUOTA_EXHAUSTED',
        retryAfter: connCheck.retryAfter,
        limit: connCheck.quota.limit,
        used: connCheck.quota.used,
      });
      
      socket.close(closeCode, closeReason);
      return;
    }

    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const connection = {
      id: connectionId,
      userId: userId || 'anonymous',
      identity: identity,
      socket,
      connectedAt: now,
      lastPingAt: now,
      conversations: [],
      isAlive: true,
    };

    connectionStore.add(connection);

    // Send connection confirmation
    this.sendToConnection(connectionId, 'connection:established', {
      connectionId,
      serverTime: now,
      identity: {
        type: identity.type,
        hash: identity.hash.substring(0, 8) + '...',
      },
    });

    // Setup event handlers
    socket.on('message', (data) => {
      this.handleMessage(connectionId, data.toString());
    });

    socket.on('close', () => {
      console.log(`[WS Server] Connection closed: ${connectionId}`);
      cleanupConnection();
      connectionStore.remove(connectionId);
    });

    socket.on('error', (error) => {
      console.error(`[WS Server] Connection error: ${connectionId}`, error);
      cleanupConnection();
      connectionStore.remove(connectionId);
    });

    // Pong handler for heartbeat
    socket.on('pong', () => {
      const conn = connectionStore.get(connectionId);
      if (conn) {
        conn.isAlive = true;
        conn.lastPingAt = new Date().toISOString();
      }
    });
  }

  handleMessage(connectionId, data) {
    const conn = connectionStore.get(connectionId);
    if (!conn) return;

    try {
      const message = JSON.parse(data);
      console.log(`[WS Server] Received: ${message.type} from ${connectionId}`);

      switch (message.type) {
        case 'ping':
          this.sendToConnection(connectionId, 'pong', {
            timestamp: message.payload?.timestamp,
            serverTime: new Date().toISOString(),
          });
          break;
        case 'test':
          this.sendToConnection(connectionId, 'test:response', {
            received: message.payload,
            serverTime: new Date().toISOString(),
          });
          break;
        default:
          console.log(`[WS Server] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[WS Server] Error handling message:', error);
    }
  }

  sendToConnection(connectionId, type, payload) {
    const conn = connectionStore.get(connectionId);
    if (!conn || conn.socket.readyState !== 1) return;

    const message = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      id: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    conn.socket.send(JSON.stringify(message));
  }

  validateToken(token) {
    if (token.startsWith('mock-token-')) {
      // Extrair identificador único do token
      const parts = token.split('mock-token-');
      if (parts.length > 1 && parts[1]) {
        return `user-${parts[1]}`;
      }
      return 'mock-user-id';
    }
    return null;
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      connectionStore.getAll().forEach(conn => {
        if (!conn.isAlive) {
          console.log(`[WS Server] Terminating inactive connection: ${conn.id}`);
          conn.socket.terminate();
          cleanupConnection();
          connectionStore.remove(conn.id);
          return;
        }

        conn.isAlive = false;
        conn.socket.ping();
      });
    }, this.HEARTBEAT_INTERVAL);
  }
}

// Start server
const server = new WebSocketServerManager();
server.start(3002);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[WS Server] Shutting down...');
  console.log('[WS Server] Final metrics:', JSON.stringify({
    ...metrics,
    connectionsByIdentity: Array.from(metrics.connectionsByIdentity.entries())
  }));
  server.stop();
  process.exit(0);
});
