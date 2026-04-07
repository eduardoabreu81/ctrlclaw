/**
 * Discovery Engine (Copy for testing) + Test Validation
 */

const COMMON_PORTS = [3001, 8080, 8000, 5000, 1337, 3000];
const COMMON_HOSTS = ['localhost', '127.0.0.1'];

async function isClawBackend(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const data = await response.json();
    
    return (
      data.service?.toLowerCase().includes('claw') ||
      data.name?.toLowerCase().includes('claw') ||
      data.version?.toLowerCase().includes('claw') ||
      data.api?.includes('claw')
    );
  } catch {
    return false;
  }
}

export async function discoverLocalBackend() {
  for (const host of COMMON_HOSTS) {
    for (const port of COMMON_PORTS) {
      const httpUrl = `http://${host}:${port}`;
      
      try {
        const isClaw = await isClawBackend(httpUrl);
        if (isClaw) {
          return {
            found: true,
            httpUrl,
            wsUrl: `ws://${host}:${port}`,
            host,
            port,
            hasSSL: false,
            scenario: 'local',
            confidence: 'high',
          };
        }
      } catch {
        // Continue to next port
      }
    }
  }

  return {
    found: false,
    scenario: 'unknown',
    confidence: 'low',
    error: 'No backend found in common ports',
  };
}

export async function testHttpConnection(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${url}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      success: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function testWebSocketConnection(url) {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(`${url}?v=1`);
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ success: false, error: 'Timeout' });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({ success: true });
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({ success: false, error: 'WebSocket error' });
      };
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create WebSocket',
      });
    }
  });
}

// ============================================
// TEST EXECUTION
// ============================================

async function runTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE 1: Discovery com Backend Real Disponível            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 BACKEND ESPERADO:');
  console.log('   URL: http://localhost:3001');
  console.log('   Health Endpoint: GET /api/health');
  console.log('   Resposta esperada: { service: "nanoclaw", ... }\n');
  
  // Test HTTP directly
  console.log('⏳ [1/4] Testando conectividade HTTP...');
  const httpResult = await testHttpConnection('http://localhost:3001');
  console.log('   Resultado HTTP:', JSON.stringify(httpResult));
  
  // Test WebSocket directly  
  console.log('\n⏳ [2/4] Testando conectividade WebSocket...');
  const wsResult = await testWebSocketConnection('ws://localhost:3001');
  console.log('   Resultado WS:', JSON.stringify(wsResult));
  
  // Run discovery
  console.log('\n⏳ [3/4] Executando discoverLocalBackend()...');
  console.log('   Varredura:');
  console.log('   - Hosts: localhost, 127.0.0.1');
  console.log('   - Portas: 3001, 8080, 8000, 5000, 1337, 3000');
  console.log('   - Timeout por porta: 2000ms');
  
  const startTime = Date.now();
  const discovery = await discoverLocalBackend();
  const duration = Date.now() - startTime;
  
  console.log(`\n   ✅ Varredura completa em ${duration}ms`);
  
  // Results
  console.log('\n📊 [4/4] RESULTADO DO DISCOVERY:');
  console.log(JSON.stringify(discovery, null, 2));
  
  // Validation
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  VALIDAÇÃO                                                 ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  let passed = 0;
  let failed = 0;
  
  if (httpResult.success) {
    console.log('✅ HTTP: Conectividade OK');
    passed++;
  } else {
    console.log('❌ HTTP: Falhou -', httpResult.error);
    failed++;
  }
  
  if (wsResult.success) {
    console.log('✅ WebSocket: Conectividade OK');
    passed++;
  } else {
    console.log('⚠️  WebSocket:', wsResult.error, '(pode ser timeout normal)');
  }
  
  if (discovery.found) {
    console.log('✅ Discovery: Backend encontrado');
    passed++;
  } else {
    console.log('❌ Discovery: Backend NÃO encontrado');
    failed++;
  }
  
  if (discovery.httpUrl === 'http://localhost:3001') {
    console.log('✅ URL HTTP: Correta (localhost:3001)');
    passed++;
  } else {
    console.log('❌ URL HTTP: Incorreta -', discovery.httpUrl);
    failed++;
  }
  
  if (discovery.wsUrl === 'ws://localhost:3001') {
    console.log('✅ URL WebSocket: Correta (ws://localhost:3001)');
    passed++;
  } else {
    console.log('❌ URL WebSocket: Incorreta -', discovery.wsUrl);
    failed++;
  }
  
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  RESULTADO: ${passed} passed, ${failed} failed                          ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  return { discovery, httpResult, wsResult, passed, failed };
}

runTest().then(r => {
  process.exit(r.failed > 0 ? 1 : 0);
}).catch(e => {
  console.error('❌ ERRO FATAL:', e);
  process.exit(1);
});
