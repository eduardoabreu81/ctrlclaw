# K6 Load Testing - CtrlClaw P4.1

Testes de carga orientados a robustez, não throughput genérico.

## Objetivo

Validar comportamento dos mecanismos de proteção:
- Rate limiting HTTP (100 req/min)
- Rate limiting WebSocket (50 msg/min)
- Persistência de quota após reconnect
- Fallback Redis → memória local
- Circuit breaker (transições de estado)

## Estrutura

```
load-testing/k6/
├── config.js                          # Configurações centralizadas
├── README.md                          # Este arquivo
├── run-all.sh                         # Executa todos os cenários
├── scripts/
│   ├── 01-http-baseline.js            # HTTP normal, abaixo do limite
│   ├── 02-http-ratelimit-pressure.js  # HTTP excedendo limite
│   ├── 03-ws-baseline.js              # WebSocket normal
│   ├── 04-ws-abuse-reconnect.js       # WebSocket abuso + reconnect
│   ├── 05-redis-fallback.js           # Redis indisponível
│   └── 06-circuit-breaker.js          # Circuit breaker
└── results/                           # Saída dos testes (JSON)
```

## Instalação

### k6

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows (WSL2 recommended)
# Install k6 inside WSL2, not Windows native:
wsl
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Execução

### Individual

```bash
# HTTP Baseline
k6 run --env BASE_URL=http://localhost:3000 scripts/01-http-baseline.js

# HTTP Rate Limit Pressure
k6 run --env BASE_URL=http://localhost:3000 scripts/02-http-ratelimit-pressure.js

# WebSocket Baseline
k6 run --env BASE_URL=ws://localhost:3000 scripts/03-ws-baseline.js

# WebSocket Abuse + Reconnect
k6 run --env BASE_URL=ws://localhost:3000 scripts/04-ws-abuse-reconnect.js
```

### Todos os Cenários

```bash
chmod +x run-all.sh
./run-all.sh local http://localhost:3000
```

### Staging

```bash
./run-all.sh staging https://staging.ctrlclaw.example.com
```

## Cenários

### 01 - HTTP Baseline

**Objetivo:** Confirmar latência, taxa de erro e headers de rate limit em tráfego normal.

**Carga:** 10 VUs, 100 req/min por VU (abaixo do limite)

**Validações:**
- p95 < 500ms
- Taxa de erro < 1%
- Headers X-RateLimit-* presentes
- Nenhum 429

### 02 - HTTP Rate Limit Pressure

**Objetivo:** Medir 429, Retry-After, estabilidade e recuperação.

**Carga:** 5 VUs, 150 req/min por VU (acima do limite 100)

**Validações:**
- 429 recebidos após exceder limite
- Header Retry-After presente
- Sem erros 5xx
- Recuperação após 60s

### 03 - WebSocket Baseline

**Objetivo:** Conexões estáveis, troca normal de mensagens.

**Carga:** 20 conexões, 10 msg/min por conexão

**Validações:**
- >95% conexões bem-sucedidas
- Latência de mensagem < 100ms
- Nenhuma desconexão forçada

**Limitação K6:** Não simula reconexão automática nem persistência de sessão como browser real.

### 04 - WebSocket Abuse + Reconnect

**Objetivo:** Validar bloqueio real mesmo com reconnect.

**Carga:** 5 VUs, 100 msg/min, 3 reconnects por VU

**Validações:**
- Bloqueio após ~50 mensagens
- Bloqueio persiste após reconnect (mesma chave hashada)
- userHash:ipHash mantém estado

**Estratégia:** Reconecta com MESMO userId, verificando se backend mantém quota.

### 05 - Redis Fallback

**Objetivo:** Medir comportamento com fallback para memória local.

**Setup:** Requer parada manual do Redis

```bash
docker stop ctrlclaw-redis
k6 run --env BASE_URL=http://localhost:3000 scripts/05-redis-fallback.js
docker start ctrlclaw-redis
```

**Validações:**
- Latência similar ou menor
- Rate limiting funcional (por instância)
- Sem erros 5xx

**⚠️ Limitação:** Com Redis indisponível, rate limiting é LOCAL por instância. Em multi-instance, proteção é degradada. Isso é ACEITÁVEL para MVP.

### 06 - Circuit Breaker

**Objetivo:** Medir transição closed → open → half-open → closed.

**Setup:** Requer endpoint de controle no backend para induzir falhas.

**Critérios:**
- 5 falhas/60s → OPEN
- 30s em OPEN → HALF_OPEN
- 3 sucessos em HALF_OPEN → CLOSED

**Validações:**
- Tempo para abrir: ~60s
- Tempo em OPEN: ~30s
- Comportamento do cliente adequado

## Interpretação de Resultados

### Métricas Principais

| Métrica | Descrição | Alvo |
|---------|-----------|------|
| http_req_duration | Latência HTTP | p95 < 500ms (baseline) |
| http_req_failed | Taxa de erro | < 1% (baseline), < 5% (pressure) |
| ratelimit_hits | Quantidade de 429 | > 0 (quando esperado) |
| ws_connections | Conexões WS bem-sucedidas | > 95% |
| block_persists_after_reconnect | Bloqueio persiste | ~100% |

### Status do Teste

- **✅ PASSOU:** Comportamento dentro dos parâmetros esperados
- **⚠️ REVISAR:** Comportamento inesperado mas não crítico
- **❌ FALHOU:** Comportamento viola requisitos de robustez

## Relatório

Após execução, resultados JSON estão em `results/`.

Gerar relatório consolidado:

```bash
# Ver todos os resultados
ls -la results/

# Analisar métricas específicas
cat results/01-http-baseline.json | jq '.metrics.http_req_duration'
cat results/02-http-ratelimit-pressure.json | jq '.metrics.ratelimit_429_received'
```

## Troubleshooting

### "k6: not found"

Instale k6: https://k6.io/docs/get-started/installation/

### "connection refused"

Verifique se o backend está rodando na URL correta:

```bash
curl http://localhost:3000/api/health
```

### WebSocket falha em Windows

O suporte a WebSocket no k6 para Windows pode ser limitado. Use WSL2:

```bash
wsl
k6 run --env BASE_URL=ws://localhost:3000 scripts/03-ws-baseline.js
```

### Resultados inconsistentes

- Pausa entre testes pode ser necessária (rate limit windows de 60s)
- Verifique se Redis está no estado esperado para cada cenário
- Certifique-se de que não há outros testes rodando simultaneamente

## Limitações Conhecidas

1. **k6 WebSocket:** Suporte experimental, não cobre todos os cenários de browser real
2. **Circuit Breaker:** Requer implementação de endpoint de controle no backend
3. **Redis Fallback:** Requer intervenção manual no Docker
4. **Multi-instance:** Testes são contra instância única; comportamento distribuído completo requer ambiente dedicado

## Referências

- k6 Docs: https://k6.io/docs/
- k6 WebSocket: https://k6.io/docs/using-k6/protocols/websockets/
- CtrlClaw Architecture: ../../ARCHITECTURE.md
