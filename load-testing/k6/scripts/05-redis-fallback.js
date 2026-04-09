/**
 * Cenário 05: Redis Fallback
 * 
 * Pré-requisitos:
 *   - Servidor Next.js rodando
 *   - Redis PARADO (docker stop redis-test)
 * 
 * Execução:
 *   k6 run --env BASE_URL=http://localhost:3000 --env DURATION=2m --env VUS=10 scripts/05-redis-fallback.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const DURATION = __ENV.DURATION || '2m';
const VUS = parseInt(__ENV.VUS || '10');

const fallbackActive = new Rate('fallback_memory_active');
const degradedResponses = new Counter('degraded_responses');
const circuitBreakerResponses = new Counter('circuit_breaker_fallback');

export const options = {
  scenarios: {
    redis_fallback: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      tags: { scenario: 'redis_fallback' },
    },
  },
};

function generateUserId(vu) {
  return `user-${vu}`;
}

export default function () {
  const userId = generateUserId(__VU);
  
  // Testar circuit breaker
  const cbResponse = http.get(`${BASE_URL}/api/test/circuit-breaker`, {
    headers: { 'X-Test-User': userId },
  });
  
  const state = cbResponse.headers['X-Circuit-Breaker-State'];
  if (state === 'open' || cbResponse.status === 503) {
    circuitBreakerResponses.add(1);
    fallbackActive.add(1);
  }
  
  // Testar rate limit
  const rlResponse = http.get(`${BASE_URL}/api/test/ratelimit`, {
    headers: { 'X-Test-User': userId },
  });
  
  if (rlResponse.status >= 500) {
    degradedResponses.add(1);
  }
  
  check(rlResponse, {
    'fallback: rate limit responds': (r) => r.status === 200 || r.status === 429,
    'fallback: no 500 errors': (r) => r.status < 500,
  });
  
  check(cbResponse, {
    'fallback: circuit breaker responds': (r) => [200, 503].includes(r.status),
  });
  
  sleep(1);
}

function m(data, name, field, fallback = 'N/A') {
  return data.metrics?.[name]?.values?.[field] ?? fallback;
}

export function handleSummary(data) {
  const cbCount = m(data, 'circuit_breaker_fallback', 'count', 0);
  const fallbackRate = m(data, 'fallback_memory_active', 'rate', 0);
  const degraded = m(data, 'degraded_responses', 'count', 0);
  const p95 = m(data, 'http_req_duration', 'p(95)', 0);
  const throughput = m(data, 'http_reqs', 'rate', 0);
  const errorRate = m(data, 'http_req_failed', 'rate', 0);
  
  return {
    'results/05-redis-fallback.json': JSON.stringify(data, null, 2),
    stdout: `
╔══════════════════════════════════════════════════════════════╗
║        CENÁRIO 05: Redis Fallback                            ║
╠══════════════════════════════════════════════════════════════╣

  Config: Duração=${DURATION}, VUs=${VUS}
  Redis: INDISPONÍVEL (esperado)

  Resumo:
    Circuit Breaker atuou: ${cbCount}
    Fallback memória: ${(fallbackRate * 100).toFixed(1)}%
    Respostas degradadas: ${degraded}

  Performance:
    p95: ${typeof p95 === 'number' ? p95.toFixed(2) : p95}ms
    Throughput: ${typeof throughput === 'number' ? throughput.toFixed(2) : throughput} req/s
    Taxa de Erro: ${(errorRate * 100).toFixed(2)}%

  Validação:
    Serviço mantém resposta: ${degraded < 10 ? '✅ PASSOU' : '❌ FALHOU'}
    Circuit breaker funciona: ${cbCount > 0 ? '✅ PASSOU' : '⚠️ REVISAR'}
    Sem erros 5xx massivos: ${errorRate < 0.05 ? '✅ PASSOU' : '❌ FALHOU'}

  Status: ${degraded < 10 && errorRate < 0.05 ? '✅ PASSOU' : '❌ FALHOU'}

╚══════════════════════════════════════════════════════════════╝
`,
  };
}
