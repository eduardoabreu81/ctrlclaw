# Variáveis de Ambiente - CtrlClaw

Guia completo de configuração via variáveis de ambiente.

---

## Obrigatórias

### BACKEND_ADAPTER
Tipo de backend a usar.

```bash
BACKEND_ADAPTER=mock        # Para desenvolvimento
BACKEND_ADAPTER=nanoclaw    # Para backend real
```

### CLAW_API_URL
URL HTTP do backend.

```bash
# Desenvolvimento
CLAW_API_URL=http://localhost:3001

# Produção
CLAW_API_URL=https://api.exemplo.com
```

### CLAW_WS_URL
URL WebSocket do backend.

```bash
# Desenvolvimento (HTTP)
CLAW_WS_URL=ws://localhost:3001

# Produção (HTTPS)
CLAW_WS_URL=wss://api.exemplo.com
```

---

## Segurança

### FRONTEND_URL
URL pública do frontend (para CORS).

```bash
FRONTEND_URL=http://localhost:3000
# ou
FRONTEND_URL=https://ctrlclaw.exemplo.com
```

### ALLOWED_ORIGINS
Origens permitidas para CORS (separadas por vírgula).

```bash
# Desenvolvimento
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Produção (NUNCA use wildcard *)
ALLOWED_ORIGINS=https://ctrlclaw.exemplo.com
```

---

## Sessão

### SESSION_TTL_MINUTES
Tempo de vida do token em minutos.

```bash
SESSION_TTL_MINUTES=30
```

### IDLE_TIMEOUT_MINUTES
Tempo de inatividade antes de logout.

```bash
IDLE_TIMEOUT_MINUTES=30
```

### ABSOLUTE_TIMEOUT_HOURS
Tempo máximo desde login (independente de atividade).

```bash
ABSOLUTE_TIMEOUT_HOURS=24
```

---

## WebSocket

### WS_HEARTBEAT_INTERVAL
Intervalo de heartbeat em milissegundos.

```bash
WS_HEARTBEAT_INTERVAL=30000  # 30 segundos
```

### WS_HEARTBEAT_TIMEOUT
Timeout para resposta de heartbeat.

```bash
WS_HEARTBEAT_TIMEOUT=10000  # 10 segundos
```

### WS_RECONNECT_MAX_ATTEMPTS
Máximo de tentativas de reconexão.

```bash
WS_RECONNECT_MAX_ATTEMPTS=10
```

---

## Rate Limiting

### RATE_LIMIT_ENABLED
Habilitar coordenação de rate limiting no cliente.

```bash
RATE_LIMIT_ENABLED=true
```

### RATE_LIMIT_MAX_REQUESTS
Máximo de requisições por janela.

```bash
RATE_LIMIT_MAX_REQUESTS=100
```

### RATE_LIMIT_WINDOW_MS
Janela de tempo em milissegundos.

```bash
RATE_LIMIT_WINDOW_MS=60000  # 1 minuto
```

---

## Deployment

### DOMAIN
Domínio para SSL (cenário VPS).

```bash
DOMAIN=ctrlclaw.exemplo.com
```

### SSL_EMAIL
Email para notificações Let's Encrypt.

```bash
SSL_EMAIL=admin@exemplo.com
```

### TUNNEL_TOKEN
Token para Cloudflare Tunnel.

```bash
TUNNEL_TOKEN=<token_do_cloudflare>
```

---

## Exemplos por Cenário

### Desenvolvimento (Mock)

```bash
NODE_ENV=development
BACKEND_ADAPTER=mock
CLAW_API_URL=http://localhost:3001
CLAW_WS_URL=ws://localhost:3001
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Produção VPS

```bash
NODE_ENV=production
BACKEND_ADAPTER=nanoclaw
CLAW_API_URL=http://backend:3001
CLAW_WS_URL=ws://backend:3001
FRONTEND_URL=https://ctrlclaw.exemplo.com
ALLOWED_ORIGINS=https://ctrlclaw.exemplo.com
DOMAIN=ctrlclaw.exemplo.com
SSL_EMAIL=admin@exemplo.com
```

### Produção Tunnel

```bash
NODE_ENV=production
BACKEND_ADAPTER=nanoclaw
CLAW_API_URL=http://localhost:3001
CLAW_WS_URL=ws://localhost:3001
FRONTEND_URL=https://ctrlclaw.exemplo.com
ALLOWED_ORIGINS=https://ctrlclaw.exemplo.com
TUNNEL_TOKEN=<token>
```

---

## Validação

Para verificar se as variáveis estão corretas:

```bash
# O aplicativo valida no startup
npm run dev
```

Erros de configuração serão exibidos no console.
