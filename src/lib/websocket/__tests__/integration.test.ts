/**
 * WebSocket Server Integration Tests - P4.2
 * 
 * Integration tests with actual WebSocket connections
 */

import { WebSocket } from 'ws';
import { startWebSocketServer, stopWebSocketServer } from '../server';

const TEST_PORT = 3003; // Different port to avoid conflicts

describe('WebSocket Server Integration', () => {
  beforeAll(() => {
    startWebSocketServer(TEST_PORT);
  });

  afterAll(() => {
    stopWebSocketServer();
  });

  // ============================================
  // Basic Connectivity
  // ============================================
  describe('basic connectivity', () => {
    it('should accept connection with valid token', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}?token=mock-token-test`);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    it('should reject connection without token', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      ws.on('close', (code, reason) => {
        expect(code).toBe(1008); // POLICY_VIOLATION
        ws.terminate();
        done();
      });

      ws.on('open', () => {
        done(new Error('Should not have opened without token'));
      });
    });

    it('should reject connection with invalid token', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}?token=invalid-token`);
      
      ws.on('close', (code, reason) => {
        expect(code).toBe(1008); // POLICY_VIOLATION
        ws.terminate();
        done();
      });

      ws.on('open', () => {
        done(new Error('Should not have opened with invalid token'));
      });
    });
  });

  // ============================================
  // Rate Limiting - Connection
  // ============================================
  describe('connection rate limiting', () => {
    it('should accept connections within limit', async () => {
      const connections: WebSocket[] = [];
      
      // Create 5 connections (within limit of 10)
      for (let i = 0; i < 5; i++) {
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}?token=mock-token-${i}`);
        await new Promise<void>((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
        });
        connections.push(ws);
      }
      
      // All should be open
      connections.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });
      
      // Cleanup
      connections.forEach(ws => ws.close());
    });

    it('should reject connections when limit exceeded', async () => {
      const connections: WebSocket[] = [];
      const rejected: { code: number; reason: string }[] = [];
      
      // Try to create 15 connections (exceeds limit of 10)
      for (let i = 0; i < 15; i++) {
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}?token=mock-token-limit-${i}`);
        
        const result = await new Promise<{ connected: boolean; code?: number; reason?: string }>((resolve) => {
          ws.on('open', () => {
            resolve({ connected: true });
          });
          
          ws.on('close', (code, reason) => {
            resolve({ connected: false, code, reason: reason.toString() });
          });
          
          // Timeout
          setTimeout(() => {
            resolve({ connected: false });
          }, 1000);
        });
        
        if (result.connected) {
          connections.push(ws);
        } else {
          rejected.push({ code: result.code || 0, reason: result.reason || '' });
        }
      }
      
      // Should have some accepted and some rejected
      expect(connections.length).toBeGreaterThan(0);
      expect(rejected.length).toBeGreaterThan(0);
      
      // Rejected should have code 1013 (TRY_LATER)
      const hasTryLater = rejected.some(r => r.code === 1013);
      expect(hasTryLater).toBe(true);
      
      // Cleanup
      connections.forEach(ws => ws.close());
    });
  });

  // ============================================
  // Rate Limiting - Reconnect
  // ============================================
  describe('reconnect rate limiting', () => {
    it('should penalize aggressive reconnects', async () => {
      const identity = 'aggressive-reconnect-test';
      const results: { connected: boolean; delayed: boolean }[] = [];
      
      // Try 10 rapid reconnects (exceeds limit of 5)
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        const ws = new WebSocket(`ws://localhost:${TEST_PORT}?token=mock-token-${identity}`);
        
        const result = await new Promise<{ connected: boolean; delayed: boolean }>((resolve) => {
          ws.on('open', () => {
            ws.close();
            resolve({ connected: true, delayed: false });
          });
          
          ws.on('close', () => {
            const elapsed = Date.now() - startTime;
            // If it took > 4 seconds, it was likely delayed
            resolve({ connected: false, delayed: elapsed > 4000 });
          });
          
          setTimeout(() => {
            resolve({ connected: false, delayed: false });
          }, 1000);
        });
        
        results.push(result);
      }
      
      // Some should have been rejected/delayed
      const blockedCount = results.filter(r => !r.connected).length;
      expect(blockedCount).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Messaging
  // ============================================
  describe('messaging', () => {
    it('should echo ping messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}?token=mock-token-ping`);
      const testTimestamp = new Date().toISOString();
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'ping',
          payload: { timestamp: testTimestamp },
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'pong') {
          expect(message.payload.timestamp).toBe(testTimestamp);
          expect(message.payload.serverTime).toBeDefined();
          ws.close();
          done();
        }
      });

      ws.on('error', (err) => {
        done(err);
      });
    });

    it('should respond to test messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}?token=mock-token-echo`);
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'test',
          payload: { hello: 'world' },
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'test:response') {
          expect(message.payload.received.hello).toBe('world');
          ws.close();
          done();
        }
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });
});
