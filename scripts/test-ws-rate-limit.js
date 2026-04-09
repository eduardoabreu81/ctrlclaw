#!/usr/bin/env node
/**
 * Teste rápido de rate limiting WS
 * 
 * Uso: node scripts/test-ws-rate-limit.js
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3002?token=mock-token-abuse-test';

async function testRateLimit() {
  console.log('=== Teste de Rate Limiting WS ===\n');
  
  const results = {
    accepted: 0,
    blocked: 0,
    errors: 0,
  };
  
  // Tentar 15 conexões sequenciais
  for (let i = 1; i <= 15; i++) {
    console.log(`\n--- Tentativa ${i} ---`);
    
    await new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          console.log('  -> TIMEOUT');
          results.errors++;
          resolved = true;
          resolve();
        }
      }, 2000);
      
      ws.on('open', () => {
        console.log('  -> CONECTADO (101)');
        results.accepted++;
        ws.close(1000, 'Test close');
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      });
      
      ws.on('close', (code, reason) => {
        console.log(`  -> FECHADO: code=${code}, reason=${reason}`);
        if (code === 1013) {
          results.blocked++;
        } else if (code !== 1000 && code !== 1005) {
          results.errors++;
        }
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      });
      
      ws.on('error', (err) => {
        console.log(`  -> ERRO: ${err.message}`);
        results.errors++;
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    
    // Pequeno delay entre tentativas
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log('\n=== RESULTADO ===');
  console.log(`Aceitas:  ${results.accepted}`);
  console.log(`Bloqueadas (1013): ${results.blocked}`);
  console.log(`Erros:    ${results.errors}`);
  console.log(`\nTaxa de bloqueio: ${(results.blocked / 15 * 100).toFixed(1)}%`);
  
  if (results.blocked > 0) {
    console.log('✅ Rate limiting FUNCIONANDO');
  } else {
    console.log('❌ Rate limiting NÃO FUNCIONANDO');
  }
  
  process.exit(0);
}

console.log('Aguardando servidor WS...');
setTimeout(testRateLimit, 1000);
