# ADR: Session Strategy V1

> **Status:** ✅ DECISÃO FECHADA  
> **Data:** 2026-04-07  
> **Decisores:** Time CtrlClaw

---

## Resumo Executivo

| Aspecto | Decisão |
|---------|---------|
| **Token Storage** | sessionStorage (conforme ADR 1) |
| **Session TTL** | 30 minutos |
| **Idle Timeout** | 30 minutos |
| **Absolute Timeout** | 24 horas |
| **Warning** | 5 minutos antes do idle timeout |

---

## Decisão

### Parâmetros Definidos

| Parâmetro | Valor | Regra Obrigatória |
|-----------|-------|-------------------|
| **Token Storage** | sessionStorage | Persiste reload, uma aba apenas |
| **Session TTL** | 30 minutos | Token expira após 30min se não renovado |
| **Idle Timeout** | 30 minutos | ⭐ Renovado por atividade real do usuário |
| **Absolute Timeout** | 24 horas | ⭐ NUNCA é renovado |
| **Warning** | 5 minutos antes | ⭐ Permite renovação clara da sessão |

---

## Regras Obrigatórias

### 1. Idle Timeout - Renovação por Atividade

**O que conta como atividade:**
- Movimento do mouse
- Pressionamento de tecla
- Touch em dispositivos móveis
- Scroll
- Clique

**O que NÃO conta:**
- Recebimento de mensagem WS
- Atualização de status
- Background tasks

```typescript
// Eventos que renovam idle timeout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
```

### 2. Absolute Timeout - Fixo desde Login

**Regra:** O timestamp de login + 24 horas é o limite absoluto.

**NUNCA** é renovado por:
- Atividade do usuário
- Requisições API
- Reconexão WS
- Qualquer ação

```typescript
// Calculado no login, imutável
const absoluteExpiry = new Date(loginTime.getTime() + 24 * 60 * 60 * 1000);
```

### 3. Warning - Renovação Clara

**Modal de Aviso:**
```
┌─────────────────────────────────────────┐
│  ⚠️ Sessão Expirando                    │
│                                         │
│  Sua sessão expira em 5 minutos         │
│  por inatividade.                       │
│                                         │
│  [Continuar Logado]  [Sair]             │
└─────────────────────────────────────────┘
```

**Ação "Continuar Logado":**
- Reseta idle timeout (atividade detectada)
- Mantém absolute timeout (não muda)
- NÃO renova session TTL (token permanece mesmo)

---

## Estados da Sessão

```
┌──────────────┐
│  LOGGED_OUT  │
└──────┬───────┘
       │ login()
       ▼
┌──────────────┐     activity detected    ┌──────────────┐
│   LOGGED_IN  │◀─────────────────────────│  ACTIVE_USE  │
└──────┬───────┘                          └──────────────┘
       │
       │ 25min idle
       ▼
┌──────────────┐
│ IDLE_WARNING │──[Continuar Logado]──▶ LOGGED_IN (reset idle)
└──────┬───────┘
       │ [Sair] ou 30min idle
       ▼
┌──────────────┐     OR     ┌──────────────────┐
│   LOGOUT     │◀───────────│ ABSOLUTE_EXPIRED │
└──────────────┘            │ (24h desde login)│
                            └──────────────────┘
```

---

## Implementação

### Store Structure

```typescript
interface SessionState {
  token: string;
  user: User;
  loginTime: string;      // Para absolute timeout
  lastActivity: string;   // Para idle timeout
  expiresAt: string;      // Session TTL
}
```

### Idle Timeout Hook

```typescript
// hooks/use-idle-timeout.ts
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;      // 30 minutos
const WARNING_BEFORE_MS = 5 * 60 * 1000;     // 5 minutos antes
const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 horas

export function useIdleTimeout() {
  // Detecta atividade real do usuário
  // Mostra warning aos 25min
  // Logout aos 30min idle OU 24h desde login
}
```

---

## Trade-offs

| Aspecto | Impacto | Mitigação |
|---------|---------|-----------|
| **sessionStorage** | Uma aba apenas | Documentar limitação |
| **30min idle** | Pode deslogar usuário lento | Warning com 5min antes |
| **24h absolute** | Login diário obrigatório | UX aceitável para segurança |
| **Multi-tab** | Cada aba independente | Cada uma tem próprio idle timer |

---

## Impacto na V1

| Aspecto | Avaliação |
|---------|-----------|
| Segurança | ⭐⭐⭐⭐ Boa (absolute timeout, idle detection) |
| UX | ⭐⭐⭐⭐ Boa (warning, persiste reload) |
| Complexidade | ⭐⭐⭐ Média (idle detection, absolute timer) |

---

## Impacto Futuro

Quando migrarmos para httpOnly cookie (v2):
- Multi-tab funcionará com sessão compartilhada
- Absolute timeout continua igual
- Idle timeout pode ser gerenciado pelo backend
- Warning continua necessário

---

## Checklist de Implementação

- [x] Decisão registrada neste ADR
- [x] Parâmetros definidos
- [x] Regras obrigatórias documentadas
- [ ] Implementar auth store com sessionStorage
- [ ] Implementar idle timeout hook
- [ ] Implementar warning modal
- [ ] Implementar absolute timeout check
- [ ] Testar cenários de timeout

---

## Registro de Decisão

| Data | Evento | Resultado |
|------|--------|-----------|
| 2026-04-07 | Decisão arquitetural | Aprovados todos os parâmetros |
| 2026-04-07 | Regras definidas | Idle renovável, Absolute fixo, Warning com renovação |

---

**Status:** ✅ DECISÃO FECHADA

**Próximo passo:** Revisar ADR 3 (WebSocket Strategy)
