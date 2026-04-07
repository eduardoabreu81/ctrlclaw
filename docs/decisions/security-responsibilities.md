# Responsabilidades de Segurança por Camada

> **Status:** Vivo (atualizado conforme evolução)  
> **Versão:** 1.0  
> **Data:** 2026-04-07

---

## Visão Geral

Este documento define claramente quem é responsável por cada aspecto de segurança no CtrlClaw. Isso evita gaps de segurança (quando ninguém assume) e duplicação desnecessária.

---

## Matriz de Responsabilidades

### 1. Autenticação e Autorização

| Aspecto | Frontend | Proxy | Backend |
|---------|----------|-------|---------|
| Validação de credenciais | ❌ | ❌ | ✅ |
| Emissão de tokens/sessões | ❌ | ❌ | ✅ |
| Validação de tokens | ⚠️ (cache client) | ❌ | ✅ (fonte da verdade) |
| Logout/invalidação | ⚠️ (UI) | ❌ | ✅ |
| Permissões/RBAC | ❌ | ❌ | ✅ |

**Legenda:** ✅ Principal | ⚠️ Auxiliar | ❌ Não responsável

---

### 2. Comunicação Segura

| Aspecto | Frontend | Proxy | Backend |
|---------|----------|-------|---------|
| TLS/SSL | ❌ | ✅ (termination) | ⚠️ (validação) |
| HTTPS redirects | ⚠️ (links) | ✅ | ❌ |
| Certificate management | ❌ | ✅ | ❌ |
| HSTS headers | ⚠️ | ✅ | ❌ |

---

### 3. CORS

| Aspecto | Frontend | Proxy | Backend |
|---------|----------|-------|---------|
| Whitelist de origens | ⚠️ (validação) | ✅ (bloqueio) | ✅ (validação final) |
| Headers CORS | ✅ (middleware) | ✅ | ⚠️ |
| Preflight handling | ✅ | ⚠️ | ⚠️ |

**Nota:** Defense in depth - todas as camadas validam.

---

### 4. Rate Limiting

| Aspecto | Frontend | Proxy | Backend |
|---------|----------|-------|---------|
| Por IP | ❌ | ✅ | ⚠️ |
| Por usuário/token | ❌ | ⚠️ | ✅ |
| Quotas de API | ❌ | ❌ | ✅ |
| Proteção contra brute force | ❌ | ⚠️ | ✅ |
| UX/feedback visual | ✅ | ❌ | ❌ |
| Prevenção de double-submit | ✅ | ❌ | ❌ |

**⚠️ CRÍTICO:** Rate limiting no frontend é APENAS para UX (feedback visual, debounce). Ele NÃO protege contra abuso malicioso porque pode ser facilmente burlado.

---

### 5. Headers de Segurança

| Header | Frontend | Proxy | Backend |
|--------|----------|-------|---------|
| Content-Security-Policy | ✅* | ⚠️ | ❌ |
| X-Frame-Options | ✅ | ✅ | ❌ |
| X-Content-Type-Options | ✅ | ✅ | ❌ |
| X-XSS-Protection | ✅ | ✅ | ❌ |
| Strict-Transport-Security | ⚠️** | ✅ | ❌ |
| Referrer-Policy | ✅ | ✅ | ❌ |

**Notas:**
- \* **CSP é diferente por ambiente** (ver seção abaixo)
- \*\* HSTS desabilitado em desenvolvimento local (pode causar problemas com localhost)

---

### 6. Validação de Input

| Aspecto | Frontend | Proxy | Backend |
|---------|----------|-------|---------|
| Formatação/UX | ✅ | ❌ | ❌ |
| Sanitização | ⚠️ | ❌ | ✅ |
| Validação de negócio | ❌ | ❌ | ✅ |
| Proteção contra injection | ❌ | ⚠️ (WAF) | ✅ |

---

### 7. WebSocket

| Aspecto | Frontend | Proxy | Backend |
|---------|----------|-------|---------|
| Upgrade para WSS | ⚠️ (request) | ✅ (upgrade) | ✅ |
| Autenticação WS | ⚠️ (envia token) | ❌ | ✅ (valida) |
| Rate limiting WS | ❌ | ✅ | ✅ |
| Heartbeat/ping | ✅ | ⚠️ | ⚠️ |

---

## Checklist de Implementação

### Frontend (Next.js)
- [x] CSP configurado
- [x] Security headers no next.config
- [x] CORS middleware
- [x] Rate limiting UX (não proteção real)
- [x] Input validation com Zod
- [ ] Auth store (em andamento)

### Proxy (Nginx)
- [x] Configuração base nginx.conf
- [ ] SSL certificates (instalação manual)
- [ ] Rate limiting por IP (configurado, necessita teste)
- [ ] CORS headers (primeira linha)
- [ ] WAF básico (considerar mod_security)

### Backend
- [ ] Rate limiting por token (verificar NanoClaw)
- [ ] Brute force protection (verificar NanoClaw)
- [ ] CORS validation final (verificar NanoClaw)
- [ ] Input validation (verificar NanoClaw)

---

## Pontos de Atenção

### 1. Token Storage (V1 Trade-off)
**Responsabilidade:** Frontend + Backend
- Frontend armazena token (memory/sessionStorage temporariamente)
- Backend emite e valida tokens
- **Gap conhecido:** httpOnly cookie ideal ainda não implementado

### 2. Session Management
**Responsabilidade:** Distribuída
- Frontend: Idle timeout, refresh automático
- Backend: Expiração, invalidação, validação
- Proxy: Não se envolve em lógica de sessão

### 3. Deployment Seguro
**Responsabilidade:** Principalmente Proxy + Infra
- SSL/TLS: Proxy (Nginx) faz termination
- Firewall: Infraestrutura
- Updates de segurança: DevOps

---

## Alterações Futuras

Quando implementarmos httpOnly cookies (v2):
- Frontend NÃO terá mais responsabilidade de armazenar tokens
- Proxy pode assumir responsabilidade de gerenciar cookies
- Backend continua sendo fonte da verdade

---

### 5.1 Content-Security-Policy por Ambiente

A CSP é configurada de forma diferente em **desenvolvimento** vs **produção**:

#### Desenvolvimento Local
```
connect-src 'self' http://localhost:* ws://localhost:* wss: https:
```

**Por quê:**
- Permite conexão com backend local em HTTP/WS
- Facilita desenvolvimento sem necessidade de SSL local
- Usa wildcard (`localhost:*`) para flexibilidade de portas

#### Produção
```
connect-src 'self' wss: https:
```

**Por quê:**
- Apenas conexões seguras (HTTPS/WSS)
- Bloqueia HTTP inseguro
- Força TLS termination no proxy

#### Diretivas de CSP por Ambiente

| Diretiva | Desenvolvimento | Produção | Justificativa |
|----------|----------------|----------|---------------|
| `script-src` | `'self' 'unsafe-eval' 'unsafe-inline'` | `'self'` | Dev: Next.js precisa de eval/inline |
| `style-src` | `'self' 'unsafe-inline'` | `'self'` | Dev: CSS-in-JS usa inline |
| `connect-src` | `'self' http://localhost:* ws://localhost:* wss: https:` | `'self' wss: https:` | Dev: Permite backend local HTTP |

**⚠️ Importante:** Nunca commitar configurações de dev para produção sem revisão.

---

**Próximo documento:** [Auth Strategy V1](./auth-strategy-v1.md)
