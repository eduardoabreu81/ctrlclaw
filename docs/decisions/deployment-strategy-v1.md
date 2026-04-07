# ADR: Deployment Strategy V1

> **Status:** ✅ DECISÃO FECHADA  
> **Data:** 2026-04-07  
> **Decisores:** Time CtrlClaw

---

## Resumo Executivo

| Aspecto | Decisão |
|---------|---------|
| **Cenários Oficiais V1** | 3 cenários suportados |
| **Cenário 1: Local** | Desenvolvimento, teste, uso local |
| **Cenário 2: VPS Padrão** | Produção com reverse proxy + Let's Encrypt |
| **Cenário 3: Tunnel** | Publicação remota simplificada |
| **Princípio** | Local ≠ improviso, Tunnel ≠ exceção escondida |
| **CORS** | Whitelist explícita por cenário |
| **SSL** | Opcional local, obrigatório remoto |

---

## Visão dos 3 Cenários

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CENÁRIOS OFICIAIS V1                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   CENÁRIO 1  │    │   CENÁRIO 2  │    │   CENÁRIO 3  │                  │
│  │    LOCAL     │    │ VPS PADRÃO   │    │   TUNNEL     │                  │
│  │              │    │              │    │              │                  │
│  │ Desenvolver  │    │  Produção    │    │  Produção    │                  │
│  │    Testar    │    │   Própria    │    │ Simplificada │                  │
│  │   Usar local │    │   Controle   │    │   Remota     │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
│  🏠 Local         🏢 VPS + Nginx        🌐 Cloudflare Tunnel              │
│  sem proxy        + Let's Encrypt       ou similar                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Diretriz:** Todos os cenários são **primeira classe**. Local não é improviso. Tunnel não é exceção escondida.

---

## Cenário 1: Local

### Propósito
- Desenvolvimento ativo
- Testes automatizados
- Uso local sem infraestrutura

### Arquitetura

```
┌─────────────────────────────────────────────┐
│                BROWSER                      │
│  http://localhost:3000                      │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│           NEXT.JS (PORTA 3000)              │
│  - Frontend                                 │
│  - Middleware de segurança                  │
│  - Headers CSP, CORS                        │
└────────────────┬────────────────────────────┘
                 │ HTTP/WS (localhost)
                 ▼
┌─────────────────────────────────────────────┐
│          BACKEND (PORTA 3001)               │
│  - NanoClaw / Mock                          │
│  - WebSocket                                │
└─────────────────────────────────────────────┘
```

### Componentes

| Componente | Status | Nota |
|------------|--------|------|
| Next.js | ✅ Obrigatório | `npm run dev` |
| Backend | ✅ Obrigatório | Local ou Mock |
| Nginx | ❌ Não usa | Next.js serve direto |
| SSL/TLS | ❌ Opcional | HTTP aceitável |
| Docker | ❌ Opcional | `npm run dev` suficiente |

### Configuração

```bash
# .env.local
NODE_ENV=development
CLAW_API_URL=http://localhost:3001
CLAW_WS_URL=ws://localhost:3001
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
BACKEND_ADAPTER=mock  # ou nanoclaw se rodando
AUTH_STRATEGY=bearer-token-session
```

### CORS (Local)

| Aspecto | Configuração |
|---------|--------------|
| Origens permitidas | `localhost:3000`, `localhost:3001` |
| Validação | Next.js middleware |
| Wildcard | ❌ Nunca |
| Headers | `Access-Control-Allow-Origin: http://localhost:3000` |

### SSL/TLS (Local)

| Aspecto | Configuração |
|---------|--------------|
| Protocolo | HTTP (aceitável em local) |
| HTTPS opcional | Possível com certificado local |
| WebSocket | WS (não WSS) aceitável |
| Recomendação | HTTP/WS suficiente para dev |

### WebSocket (Local)

| Aspecto | Configuração |
|---------|--------------|
| URL | `ws://localhost:3001` |
| Auth | Message-based (bearer token) |
| SSL | Não necessário |
| Reconnect | Funciona normalmente |

---

## Cenário 2: VPS Padrão (Produção)

### Propósito
- Produção com controle total
- Infraestrutura própria
- Custo previsível

### Arquitetura

```
┌─────────────────────────────────────────────┐
│                BROWSER                      │
│  https://ctrlclaw.exemplo.com               │
└────────────────┬────────────────────────────┘
                 │ HTTPS/WSS
                 ▼
┌─────────────────────────────────────────────┐
│      NGINX (PORTAS 80/443)                  │
│  - TLS termination (Let's Encrypt)          │
│  - Rate limiting                            │
│  - CORS (primeira linha)                    │
│  - Reverse proxy                            │
└───────┬─────────────────┬───────────────────┘
        │                 │
        ▼                 ▼
┌───────────────┐   ┌─────────────────┐
│  NEXT.JS      │   │    BACKEND      │
│  :3000        │   │    :3001        │
│  (container)  │   │   (container)   │
└───────────────┘   └─────────────────┘
```

### Componentes

| Componente | Status | Nota |
|------------|--------|------|
| Nginx | ✅ Obrigatório | TLS, rate limiting, CORS |
| Next.js | ✅ Obrigatório | Container ou systemd |
| Backend | ✅ Obrigatório | Container ou systemd |
| Let's Encrypt | ✅ Obrigatório | SSL automático |
| Docker | ⚠️ Recomendado | `docker-compose.yml` pronto |

### Configuração

```bash
# .env (produção)
NODE_ENV=production
CLAW_API_URL=http://backend:3001  # Internal docker
CLAW_WS_URL=ws://backend:3001
FRONTEND_URL=https://ctrlclaw.exemplo.com
ALLOWED_ORIGINS=https://ctrlclaw.exemplo.com
BACKEND_ADAPTER=nanoclaw
AUTH_STRATEGY=bearer-token-session
DOMAIN=ctrlclaw.exemplo.com
SSL_EMAIL=admin@exemplo.com
```

### CORS (VPS)

| Aspecto | Configuração |
|---------|--------------|
| Origens permitidas | `ALLOWED_ORIGINS` env var |
| Validação | Nginx (bloqueio) + Next.js |
| Wildcard | ❌ Nunca em produção |
| HTTPS obrigatório | ✅ Sim |

### SSL/TLS (VPS)

| Aspecto | Configuração |
|---------|--------------|
| Certificado | Let's Encrypt automatizado |
| Renovação | Certbot auto (cron) |
| Protocolo | TLS 1.2+ |
| WebSocket | WSS obrigatório |
| Redirect | HTTP → HTTPS automático |

### WebSocket (VPS)

| Aspecto | Configuração |
|---------|--------------|
| URL | `wss://ctrlclaw.exemplo.com/ws` |
| Proxy | Nginx faz upgrade para WS |
| SSL | WSS (WebSocket over TLS) |
| Auth | Message-based |

---

## Cenário 3: Tunnel (Produção Simplificada)

### Propósito
- Publicação remota sem abrir portas
- Setup simplificado
- Proteção DDoS integrada

### Arquitetura

```
┌─────────────────────────────────────────────┐
│                BROWSER                      │
│  https://ctrlclaw.exemplo.com               │
│  ou https://xxx.trycloudflare.com           │
└────────────────┬────────────────────────────┘
                 │ HTTPS/WSS
                 ▼
┌─────────────────────────────────────────────┐
│      CLOUDFLARE EDGE                        │
│  - DDoS protection                          │
│  - SSL termination (Cloudflare)             │
│  - CORS (primeira linha)                    │
└────────────────┬────────────────────────────┘
                 │ Tunnel seguro (outbound)
                 ▼
┌─────────────────────────────────────────────┐
│      CLOUDFLARED (local)                    │
│  - Conexão outbound para Cloudflare         │
└────────────────┬────────────────────────────┘
                 │ HTTP (interno)
                 ▼
┌─────────────────────────────────────────────┐
│      NGINX (opcional, local)                │
│  - Pode ser omitido se não precisar         │
│    de rate limiting avançado                │
└───────┬─────────────────┬───────────────────┘
        │                 │
        ▼                 ▼
┌───────────────┐   ┌─────────────────┐
│  NEXT.JS      │   │    BACKEND      │
│  :3000        │   │    :3001        │
└───────────────┘   └─────────────────┘
```

### Componentes

| Componente | Status | Nota |
|------------|--------|------|
| Cloudflare | ✅ Obrigatório | Conta + Tunnel |
| cloudflared | ✅ Obrigatório | Daemon local |
| Nginx | ⚠️ Opcional | Recomendado para rate limiting |
| Next.js | ✅ Obrigatório | Container ou systemd |
| Backend | ✅ Obrigatório | Container ou systemd |
| Let's Encrypt | ❌ Não usa | SSL é do Cloudflare |

### Configuração

```bash
# .env (produção tunnel)
NODE_ENV=production
CLAW_API_URL=http://localhost:3001
CLAW_WS_URL=ws://localhost:3001
FRONTEND_URL=https://ctrlclaw.exemplo.com
ALLOWED_ORIGINS=https://ctrlclaw.exemplo.com,https://*.trycloudflare.com
BACKEND_ADAPTER=nanoclaw
AUTH_STRATEGY=bearer-token-session
TUNNEL_TOKEN=<token_do_cloudflare>
```

### CORS (Tunnel)

| Aspecto | Configuração |
|---------|--------------|
| Origens permitidas | Domínio oficial + domínios Cloudflare temp |
| Validação | Cloudflare + Nginx (se usado) + Next.js |
| Wildcard | ❌ Nunca |
| Subdomínios temp | Incluir `*.trycloudflare.com` se usar |

### SSL/TLS (Tunnel)

| Aspecto | Configuração |
|---------|--------------|
| Certificado | Cloudflare (automático) |
| Renovação | Automática |
| Protocolo | TLS 1.2+ (Cloudflare) |
| WebSocket | WSS (Cloudflare faz proxy) |
| Internal | HTTP entre cloudflared e apps |

### WebSocket (Tunnel)

| Aspecto | Configuração |
|---------|--------------|
| URL | `wss://ctrlclaw.exemplo.com/ws` |
| Proxy | Cloudflare → cloudflared → Nginx (opc) → Backend |
| SSL | WSS externo, WS interno |
| Funcionalidade | ✅ Suportado pelo Cloudflare |

---

## Matriz Comparativa por Cenário

### CORS

| Aspecto | Local | VPS | Tunnel |
|---------|-------|-----|--------|
| **Whitelist** | `localhost:*` | Domínio oficial | Domínio + Cloudflare temp |
| **Wildcard** | ❌ | ❌ | ❌ |
| **Validação** | Next.js | Nginx + Next.js | Cloudflare + Next.js |
| **HTTPS obrigatório** | ❌ | ✅ | ✅ |

### SSL/TLS

| Aspecto | Local | VPS | Tunnel |
|---------|-------|-----|--------|
| **Obrigatório** | ❌ | ✅ | ✅ (externo) |
| **Mecanismo** | Nenhum/opcional | Let's Encrypt | Cloudflare |
| **Renovação** | N/A | Automática (certbot) | Automática |
| **Protocolo** | HTTP/WS | HTTPS/WSS | HTTPS/WSS externo |
| **Internal** | HTTP/WS | HTTP/WS | HTTP/WS |

### WebSocket

| Aspecto | Local | VPS | Tunnel |
|---------|-------|-----|--------|
| **Protocolo** | WS | WSS | WSS externo, WS interno |
| **Auth** | Message | Message | Message |
| **Reconnect** | ✅ | ✅ | ✅ |
| **Proxy** | Direto | Nginx | Cloudflare + (Nginx) |

### Componentes Obrigatórios

| Componente | Local | VPS | Tunnel |
|------------|-------|-----|--------|
| Next.js | ✅ | ✅ | ✅ |
| Backend | ✅ | ✅ | ✅ |
| Nginx | ❌ | ✅ | ⚠️ (recomendado) |
| Let's Encrypt | ❌ | ✅ | ❌ |
| Cloudflare/Tunnel | ❌ | ❌ | ✅ |
| Docker | ❌ | ⚠️ | ⚠️ |

---

## Responsabilidades de Segurança por Cenário

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           LOCAL                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Layer        │ Responsabilidades                                          │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Browser      │ Navegação, cookies, localStorage (não usado para tokens)  │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Next.js      │ CORS, CSP, headers, input validation, idle timeout         │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Backend      │ Auth, rate limiting por token, input validation final      │
└──────────────┴────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                           VPS PADRÃO                                       │
├────────────────────────────────────────────────────────────────────────────┤
│ Layer        │ Responsabilidades                                          │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Nginx        │ TLS, rate limiting por IP, CORS (bloqueio), routing        │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Next.js      │ CSP, headers, input validation (UX), idle timeout          │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Backend      │ Auth, rate limiting por token, validação final             │
└──────────────┴────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                           TUNNEL                                           │
├────────────────────────────────────────────────────────────────────────────┤
│ Layer        │ Responsabilidades                                          │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Cloudflare   │ DDoS, edge SSL, CORS (primeira linha), edge caching        │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Nginx (opt)  │ Rate limiting por IP (refinado), routing                   │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Next.js      │ CSP, headers, input validation (UX), idle timeout          │
├──────────────┼────────────────────────────────────────────────────────────┤
│ Backend      │ Auth, rate limiting por token, validação final             │
└──────────────┴────────────────────────────────────────────────────────────┘
```

---

## Configuração por Cenário

### Cenário 1: Local

```bash
# .env.local
NODE_ENV=development
CLAW_API_URL=http://localhost:3001
CLAW_WS_URL=ws://localhost:3001
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
BACKEND_ADAPTER=mock
AUTH_STRATEGY=bearer-token-session

# Comandos
npm run dev        # Next.js
npm run backend    # Backend (separado)
```

### Cenário 2: VPS Padrão

```bash
# .env.production
NODE_ENV=production
CLAW_API_URL=http://backend:3001
CLAW_WS_URL=ws://backend:3001
FRONTEND_URL=https://ctrlclaw.exemplo.com
ALLOWED_ORIGINS=https://ctrlclaw.exemplo.com
BACKEND_ADAPTER=nanoclaw
AUTH_STRATEGY=bearer-token-session
DOMAIN=ctrlclaw.exemplo.com
SSL_EMAIL=admin@exemplo.com

# Comandos
docker-compose up -d
```

### Cenário 3: Tunnel

```bash
# .env.production
NODE_ENV=production
CLAW_API_URL=http://localhost:3001
CLAW_WS_URL=ws://localhost:3001
FRONTEND_URL=https://ctrlclaw.exemplo.com
ALLOWED_ORIGINS=https://ctrlclaw.exemplo.com,https://*.trycloudflare.com
BACKEND_ADAPTER=nanoclaw
AUTH_STRATEGY=bearer-token-session
TUNNEL_TOKEN=<seu_token>

# Comandos
docker-compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
```

---

## Rate Limiting por Cenário

### Local
- **Não aplica rate limiting por IP** (localhost)
- Backend aplica rate limiting por token
- Cliente tem coordenação UX

### VPS
```nginx
# nginx.conf
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;
```

### Tunnel
- Cloudflare aplica rate limiting (edge)
- Nginx (opcional) aplica refinamento
- Backend aplica por token

---

## Validação de Configuração

```typescript
// Validação no startup do aplicativo
export function validateDeploymentConfig(): { 
  valid: boolean; 
  errors: string[];
  scenario: 'local' | 'vps' | 'tunnel' | 'unknown';
} {
  const errors: string[] = [];
  
  // Detectar cenário
  const hasTunnelToken = !!process.env.TUNNEL_TOKEN;
  const hasDomain = !!process.env.DOMAIN;
  const isDev = process.env.NODE_ENV === 'development';
  
  let scenario: 'local' | 'vps' | 'tunnel' | 'unknown';
  if (isDev) scenario = 'local';
  else if (hasTunnelToken) scenario = 'tunnel';
  else if (hasDomain) scenario = 'vps';
  else scenario = 'unknown';
  
  // Validações comuns
  if (!process.env.FRONTEND_URL) {
    errors.push('FRONTEND_URL é obrigatório');
  }
  
  // Validações por cenário
  if (scenario === 'vps' || scenario === 'tunnel') {
    // Produção
    if (!process.env.ALLOWED_ORIGINS) {
      errors.push('ALLOWED_ORIGINS é obrigatório em produção');
    } else if (process.env.ALLOWED_ORIGINS.includes('*')) {
      errors.push('Wildcard (*) não permitido em ALLOWED_ORIGINS');
    }
    
    const origins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    const httpOrigins = origins.filter(o => o.startsWith('http://'));
    if (httpOrigins.length > 0) {
      errors.push(`Origens HTTP não permitidas em produção: ${httpOrigins.join(', ')}`);
    }
  }
  
  if (scenario === 'vps') {
    if (!process.env.DOMAIN) {
      errors.push('DOMAIN é obrigatório para cenário VPS');
    }
    if (!process.env.SSL_EMAIL) {
      errors.push('SSL_EMAIL é obrigatório para cenário VPS');
    }
  }
  
  if (scenario === 'tunnel') {
    if (!process.env.TUNNEL_TOKEN) {
      errors.push('TUNNEL_TOKEN é obrigatório para cenário Tunnel');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    scenario,
  };
}
```

---

## Checklist de Deployment por Cenário

### Cenário 1: Local ✅
- [ ] Node.js instalado
- [ ] `npm install` executado
- [ ] `.env.local` configurado
- [ ] `npm run dev` funciona
- [ ] Backend ou Mock rodando
- [ ] Acesso em `http://localhost:3000`

### Cenário 2: VPS Padrão ✅
- [ ] Servidor VPS provisionado
- [ ] Docker e Docker Compose instalados
- [ ] DNS apontando para servidor
- [ ] Portas 80/443 abertas
- [ ] `.env` configurado
- [ ] `docker-compose up -d` executado
- [ ] Let's Encrypt gerou certificados
- [ ] HTTPS funcionando
- [ ] WebSocket WSS funcionando

### Cenário 3: Tunnel ✅
- [ ] Conta Cloudflare criada
- [ ] Tunnel criado no dashboard
- [ ] `TUNNEL_TOKEN` obtido
- [ ] `.env` configurado
- [ ] `docker-compose.tunnel.yml` configurado
- [ ] `docker-compose up -d` executado
- [ ] Domínio configurado no Cloudflare
- [ ] HTTPS funcionando via Cloudflare
- [ ] WebSocket WSS funcionando

---

## Resumo do Checkpoint

| ADR | Decisão Principal |
|-----|-------------------|
| **ADR 1: Auth** | `bearer-token-session` (fallback temporário) |
| **ADR 2: Session** | 30min TTL/idle, 24h absolute, 5min warning |
| **ADR 3: WebSocket** | Message-based auth, 10 reconnect, 30s heartbeat |
| **ADR 4: Deployment** | **3 cenários oficiais: Local, VPS, Tunnel** |

### Cenários Definidos

| Cenário | SSL | CORS | WebSocket | Obrigatórios |
|---------|-----|------|-----------|--------------|
| **Local** | Opcional (HTTP/WS) | localhost | WS | Next.js, Backend |
| **VPS** | Let's Encrypt (HTTPS/WSS) | Whitelist | WSS | +Nginx, SSL |
| **Tunnel** | Cloudflare (HTTPS/WSS) | Whitelist+ | WSS ext/WS int | +cloudflared |

**Princípio Central:** Local ≠ improviso, Tunnel ≠ exceção. Todos são primeira classe.

---

**Status:** ✅ ADR 4 FECHADO

**Checkpoint Estratégico Completo! 🎉**

**Próximo passo:** Prosseguir para Fase 2 (Backend Adapter) com fundação totalmente consolidada!
