/**
 * Cenário 03: WebSocket Baseline (Corrigido P4.2)
 * 
 * Correção: Token único por VU para evitar colapso de identidade
 * 
 * Execução:
 *   k6 run --env WS_URL=ws://localhost:3002 --env DURATION=2m --env VUS=20 scripts/03-ws-baseline.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

const WS_BASE_URL = __ENV.WS_URL || 'ws://localhost:3002';
const DURATION = __ENV.DURATION || '2m';
const VUS = parseInt(__ENV.VUS || '20');

// Token único por VU para isolamento de identidade
const WS_URL = `${WS_BASE_URL}?token=mock-token-vu-${__VU}`;

const wsConnections = new Counter('ws_connections');
const wsMessagesSent = new Counter('ws_messages_sent');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsLatency = new Trend('ws_latency');
const wsSuccessRate = new Rate('ws_success_rate');

export const options = {
  scenarios: {
    ws_baseline: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      tags: { scenario: 'ws_baseline' },
    },
  },
};

export default function () {
  const start = Date.now();
  
  const res = ws.connect(WS_URL, {}, function (socket) {
    wsConnections.add(1);
    
    socket.on('open', function () {
      socket.send(JSON.stringify({ type: 'test', data: 'hello' }));
      wsMessagesSent.add(1);
    });
    
    socket.on('message', function (message) {
      wsMessagesReceived.add(1);
      wsLatency.add(Date.now() - start);
    });
    
    socket.on('close', function () {});
    
    socket.on('error', function (e) {
      console.error('WS Error:', e.error());
    });
    
    socket.setTimeout(function () {
      socket.close();
    }, 5000);
  });
  
  wsSuccessRate.add(res.status === 101);
  
  check(res, {
    'ws: connection established': (r) => r && r.status === 101,
  });
  
  sleep(1);
}

function m(data, name, field, fallback = 'N/A') {
  return data.metrics?.[name]?.values?.[field] ?? fallback;
}

export function handleSummary(data) {
  const conns = m(data, 'ws_connections', 'count', 0);
  const successRate = m(data, 'ws_success_rate', 'rate', 0);
  const sent = m(data, 'ws_messages_sent', 'count', 0);
  const received = m(data, 'ws_messages_received', 'count', 0);
  const latencyAvg = m(data, 'ws_latency', 'avg', 0);
  const latencyP50 = m(data, 'ws_latency', 'p(50)', 0);
  const latencyP95 = m(data, 'ws_latency', 'p(95)', 0);
  const latencyP99 = m(data, 'ws_latency', 'p(99)', 0);
  
  return {
    'results/03-ws-baseline.json': JSON.stringify(data, null, 2),
    stdout: `
╔══════════════════════════════════════════════════════════════╗
║        CENÁRIO 03: WebSocket Baseline (P4.2)                 ║
╠══════════════════════════════════════════════════════════════╣

  Config: Duração=${DURATION}, VUs=${VUS}
  Alvo: ${WS_BASE_URL}
  Identidade: Token único por VU (isolation)

  Conexões:
    Tentativas: ${conns}
    Sucesso (101): ${(successRate * conns).toFixed(0)}
    Taxa de Sucesso: ${(successRate * 100).toFixed(1)}%

  Mensagens:
    Enviadas: ${sent}
    Recebidas: ${received}
    Ratio: ${sent > 0 ? (received / sent).toFixed(2) : 'N/A'}

  Latência (ms):
    Média: ${typeof latencyAvg === 'number' ? latencyAvg.toFixed(2) : latencyAvg}
    p50:   ${typeof latencyP50 === 'number' ? latencyP50.toFixed(2) : latencyP50}
    p95:   ${typeof latencyP95 === 'number' ? latencyP95.toFixed(2) : latencyP95}
    p99:   ${typeof latencyP99 === 'number' ? latencyP99.toFixed(2) : latencyP99}

  Status: ${successRate > 0.8 ? '✅ PASSOU' : '❌ FALHOU'}

╚══════════════════════════════════════════════════════════════╝
`,
  };
}
