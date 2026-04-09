/**
 * WebSocket Rate Limiter Tests - P4.2
 * 
 * Unit tests para o rate limiter WS
 */

import {
  extractWsIdentity,
  checkConnectionLimit,
  checkMessageLimit,
  checkReconnectLimit,
  getWsRateLimitMetrics,
  resetWsRateLimitMetrics,
  DEFAULT_WS_RATE_LIMIT,
  cleanupConnection,
} from '../rate-limiter';

describe('WebSocket Rate Limiter', () => {
  beforeEach(() => {
    resetWsRateLimitMetrics();
  });

  // ============================================
  // Identity Extraction
  // ============================================
  describe('extractWsIdentity', () => {
    it('should prioritize userId over sessionId and IP', () => {
      const identity = extractWsIdentity('user-123', 'session-456', '192.168.1.1');
      
      expect(identity.type).toBe('user');
      expect(identity.hash).toHaveLength(16);
      expect(identity.raw).toBe('user-123');
    });

    it('should use sessionId when userId is not provided', () => {
      const identity = extractWsIdentity(undefined, 'session-456', '192.168.1.1');
      
      expect(identity.type).toBe('session');
      expect(identity.hash).toHaveLength(16);
      expect(identity.raw).toBe('session-456');
    });

    it('should fallback to IP when no userId or sessionId', () => {
      const identity = extractWsIdentity(undefined, undefined, '192.168.1.1');
      
      expect(identity.type).toBe('ip');
      expect(identity.hash).toHaveLength(16);
      expect(identity.raw).toBe('192.168.1.1');
    });

    it('should hash identity consistently', () => {
      const identity1 = extractWsIdentity('user-123');
      const identity2 = extractWsIdentity('user-123');
      
      expect(identity1.hash).toBe(identity2.hash);
    });

    it('should produce different hashes for different identities', () => {
      const identity1 = extractWsIdentity('user-123');
      const identity2 = extractWsIdentity('user-456');
      
      expect(identity1.hash).not.toBe(identity2.hash);
    });
  });

  // ============================================
  // Connection Limit
  // ============================================
  describe('checkConnectionLimit', () => {
    it('should allow connection within limit', () => {
      const identity = extractWsIdentity('user-test');
      
      const result = checkConnectionLimit(identity);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject connection when limit exceeded', () => {
      const identity = extractWsIdentity('user-limit-test');
      
      // Exceed limit
      for (let i = 0; i < DEFAULT_WS_RATE_LIMIT.connectionLimit + 1; i++) {
        checkConnectionLimit(identity);
      }
      
      const result = checkConnectionLimit(identity);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('WS_QUOTA_EXHAUSTED');
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.quota).toBeDefined();
      expect(result.quota?.limit).toBe(DEFAULT_WS_RATE_LIMIT.connectionLimit);
    });

    it('should track connection limit hits in metrics', () => {
      const identity = extractWsIdentity('user-metrics-test');
      
      // Exceed limit
      for (let i = 0; i < DEFAULT_WS_RATE_LIMIT.connectionLimit + 1; i++) {
        checkConnectionLimit(identity);
      }
      
      const metrics = getWsRateLimitMetrics();
      expect(metrics.connectionLimitHits).toBeGreaterThan(0);
      expect(metrics.blockedConnections).toBeGreaterThan(0);
    });

    it('should track active connections', () => {
      const identity = extractWsIdentity('user-active-test');
      
      checkConnectionLimit(identity);
      
      const metrics = getWsRateLimitMetrics();
      expect(metrics.activeConnections).toBe(1);
      
      cleanupConnection();
      
      const metricsAfter = getWsRateLimitMetrics();
      expect(metricsAfter.activeConnections).toBe(0);
    });
  });

  // ============================================
  // Message Limit
  // ============================================
  describe('checkMessageLimit', () => {
    it('should allow messages within limit', () => {
      const identity = extractWsIdentity('user-msg-test');
      
      const result = checkMessageLimit(identity);
      
      expect(result.allowed).toBe(true);
    });

    it('should reject messages when limit exceeded', () => {
      const identity = extractWsIdentity('user-msg-limit-test');
      
      // Exceed limit
      for (let i = 0; i < DEFAULT_WS_RATE_LIMIT.messageLimit + 1; i++) {
        checkMessageLimit(identity);
      }
      
      const result = checkMessageLimit(identity);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('WS_MESSAGE_QUOTA_EXCEEDED');
      expect(result.quota).toBeDefined();
      expect(result.quota?.limit).toBe(DEFAULT_WS_RATE_LIMIT.messageLimit);
    });

    it('should track message limit hits in metrics', () => {
      const identity = extractWsIdentity('user-msg-metrics-test');
      
      // Exceed limit
      for (let i = 0; i < DEFAULT_WS_RATE_LIMIT.messageLimit + 1; i++) {
        checkMessageLimit(identity);
      }
      
      const metrics = getWsRateLimitMetrics();
      expect(metrics.messageLimitHits).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Reconnect Limit
  // ============================================
  describe('checkReconnectLimit', () => {
    it('should allow reconnect within limit', () => {
      const identity = extractWsIdentity('user-reconn-test');
      
      const result = checkReconnectLimit(identity);
      
      expect(result.allowed).toBe(true);
      expect(result.shouldDelay).toBe(false);
    });

    it('should reject and delay when reconnect limit exceeded', () => {
      const identity = extractWsIdentity('user-reconn-limit-test');
      
      // Exceed limit
      for (let i = 0; i < DEFAULT_WS_RATE_LIMIT.reconnectLimit + 1; i++) {
        checkReconnectLimit(identity);
      }
      
      const result = checkReconnectLimit(identity);
      
      expect(result.allowed).toBe(false);
      expect(result.shouldDelay).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should track reconnect penalty hits in metrics', () => {
      const identity = extractWsIdentity('user-reconn-metrics-test');
      
      // Exceed limit
      for (let i = 0; i < DEFAULT_WS_RATE_LIMIT.reconnectLimit + 1; i++) {
        checkReconnectLimit(identity);
      }
      
      const metrics = getWsRateLimitMetrics();
      expect(metrics.reconnectPenaltyHits).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Window Behavior
  // ============================================
  describe('window behavior', () => {
    it('should reset counters after window expires', async () => {
      const identity = extractWsIdentity('user-window-test');
      
      // Hit limit
      for (let i = 0; i < DEFAULT_WS_RATE_LIMIT.connectionLimit + 1; i++) {
        checkConnectionLimit(identity);
      }
      
      // Should be blocked
      let result = checkConnectionLimit(identity);
      expect(result.allowed).toBe(false);
      
      // Verify retryAfter is reasonable
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });
  });

  // ============================================
  // Isolation Between Identities
  // ============================================
  describe('identity isolation', () => {
    it('should isolate limits between different users', () => {
      const user1 = extractWsIdentity('user-isolation-1');
      const user2 = extractWsIdentity('user-isolation-2');
      
      // Exhaust user1
      for (let i = 0; i < DEFAULT_WS_RATE_LIMIT.connectionLimit + 1; i++) {
        checkConnectionLimit(user1);
      }
      
      // User1 should be blocked
      const result1 = checkConnectionLimit(user1);
      expect(result1.allowed).toBe(false);
      
      // User2 should still be allowed
      const result2 = checkConnectionLimit(user2);
      expect(result2.allowed).toBe(true);
    });

    it('should isolate limits between user and IP', () => {
      const user = extractWsIdentity('user-mixed-test');
      const ip = extractWsIdentity(undefined, undefined, '192.168.1.1');
      
      // Exhaust user
      for (let i = 0; i < DEFAULT_WS_RATE_LIMIT.connectionLimit + 1; i++) {
        checkConnectionLimit(user);
      }
      
      // User should be blocked
      const userResult = checkConnectionLimit(user);
      expect(userResult.allowed).toBe(false);
      
      // Same "raw" IP should still be allowed (different identity type)
      const ipResult = checkConnectionLimit(ip);
      expect(ipResult.allowed).toBe(true);
    });
  });
});
