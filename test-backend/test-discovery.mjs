/**
 * Teste de Discovery - Validação Fase 5
 */

import { 
  discoverLocalBackend, 
  testHttpConnection, 
  testWebSocketConnection,
  detectScenario
} from '../src/lib/setup/discovery.ts';

async function runDiscoveryTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE 1: Discovery com Backend Real Disponível            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // 1. Backend info
  console.log('📋 BACKEND ESPERADO:');
  console.log('   URL: http://localhost:3001');
  console.log('   Health: /api/health\n');
  
  // 2. Test HTTP health directly
  console.log('⏳ Testando HTTP health...');
  const httpResult = await testHttpConnection('http://localhost:3001');
  console.log('   HTTP Result:', JSON.stringify(httpResult, null, 2));
  
  // 3. Test WebSocket
  console.log('\n⏳ Testando WebSocket...');
  const wsResult = await testWebSocketConnection('ws://localhost:3001');
  console.log('   WS Result:', JSON.stringify(wsResult, null, 2));
  
  // 4. Run full discovery
  console.log('\n⏳ Executando discoverLocalBackend()...');
  console.log('   Portas testadas: 3001, 8080, 8000, 5000, 1337, 3000');
  console.log('   Timeout por porta: 2000ms\n');
  
  const discovery = await discoverLocalBackend();
  
  console.log('✅ DISCOVERY RESULT:');
  console.log(JSON.stringify(discovery, null, 2));
  
  // 5. Summary
  console.log('\n📊 RESUMO:');
  console.log('   Backend encontrado:', discovery.found ? '✅ SIM' : '❌ NÃO');
  console.log('   HTTP URL:', discovery.httpUrl || 'N/A');
  console.log('   WS URL:', discovery.wsUrl || 'N/A');
  console.log('   Cenário:', discovery.scenario);
  console.log('   Confiança:', discovery.confidence);
  
  // 6. Validation
  console.log('\n🎯 VALIDAÇÃO:');
  if (discovery.found && discovery.httpUrl === 'http://localhost:3001') {
    console.log('   ✅ PASSED: Backend detectado na porta correta');
  } else {
    console.log('   ❌ FAILED: Backend não detectado ou porta incorreta');
  }
  
  if (discovery.wsUrl === 'ws://localhost:3001') {
    console.log('   ✅ PASSED: WebSocket URL inferido corretamente');
  } else {
    console.log('   ❌ FAILED: WebSocket URL incorreta');
  }
  
  return discovery;
}

runDiscoveryTest().catch(e => {
  console.error('❌ ERRO:', e);
  process.exit(1);
});
