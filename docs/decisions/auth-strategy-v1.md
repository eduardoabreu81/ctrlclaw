# ADR: Auth Strategy V1

> **Status:** ✅ DECISÃO FECHADA  
> **Data:** 2026-04-07  
> **Decisores:** Time CtrlClaw

---

## Resumo Executivo

| Aspecto | Decisão |
|---------|---------|
| **Estratégia Preferencial** | httpOnly Secure Cookie |
| **Fallback V1 (Temporário)** | Bearer Token em sessionStorage |
| **Proibido** | localStorage para tokens |
| **Modo de Seleção** | Configurável + Detecção Observável |

---

## Decisão

### Diretriz Aprovada

1. **Caminho preferencial da v1:** httpOnly cookie, se for viável
2. **Fallback temporário da v1:** bearer token em sessionStorage
3. **Nunca usar localStorage**

### Implementação

```typescript
// Estratégia determinada por (em ordem):
// 1. AUTH_STRATEGY env (override manual)
// 2. Detecção explícita do backend
// 3. Fallback seguro (sessionStorage)
```

**Características:**
- ✅ Verificação explícita de suporte a cookie
- ✅ Documentação do resultado
- ✅ Registro da decisão
- ✅ sessionStorage apenas como trade-off temporário
- ✅ Observável e debuggável (não implícito)
- ✅ Configurável via variável de ambiente

---

## Resultado da Verificação

### Informações Coletadas

**Fonte:** ARCHITECTURE.md (documentação existente do projeto)

**Encontrado:**
> "Backend constraint: NanoClaw atual retorna token no body, não cookie"

> "⚠️ TRADE-OFF V1: No httpOnly cookie support - Backend limitation, migration path documented"

**Questão Pendente (da ARCHITECTURE.md):**
> "Backend realmente não suporta cookies? Confirmar com documentação NanoClaw"

### Análise

| Evidência | Indicação |
|-----------|-----------|
| NanoClaw retorna token no body | ❌ Não usa cookies por padrão |
| Documentado como "constraint" | ⚠️ Limitação conhecida |
| Questão ainda pendente | ❓ Não confirmado 100% |

### Decisão Baseada na Verificação

**Estratégia selecionada para V1:** `bearer-token-session`

**Motivo:** Baseado na documentação atual, NanoClaw retorna bearer token no body da resposta, não utiliza cookies. A não ser que haja configuração alternativa não documentada, o fallback temporário é necessário.

**⚠️ NOTA:** Esta decisão deve ser reavaliada se:
1. Documentação oficial do NanoClaw indicar suporte a cookies
2. Configuração do NanoClaw permitir modo cookie
3. Versão mais nova do NanoClaw adicionar suporte

---

## Opções Consideradas

| Opção | Status | Notas |
|-------|--------|-------|
| httpOnly Cookie | ✅ **PREFERENCIAL** | Requer backend suportar |
| Bearer Token (memory) | ❌ Rejeitado | UX muito ruim (perde reload) |
| Bearer Token (sessionStorage) | ⚠️ **FALLBACK V1 (SELECIONADO)** | Trade-off aceito |
| localStorage | ❌ **PROIBIDO** | Nunca será usado |

---

## Trade-offs do Fallback (sessionStorage)

| Aspecto | Impacto | Mitigação |
|---------|---------|-----------|
| **Segurança** | Reduzida (XSS pode acessar) | CSP strict, input validation |
| **UX** | Boa (persiste reload, uma aba) | Re-login em múltiplas abas |
| **WebSocket** | Mais complexo | Re-autenticação manual no connect |
| **Compliance** | Requer atenção | Documentar em privacy policy |

**⚠️ Importante:** sessionStorage é **trade-off temporário V1**, não decisão ideal definitiva.

---

## Impacto na V1

| Cenário | httpOnly Cookie (ideal) | sessionStorage (V1) |
|---------|------------------------|---------------------|
| Implementação | +2 dias | Base |
| Segurança | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| UX | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Multi-tab | ✅ Funciona | ⚠️ Re-login necessário |

---

## Impacto Futuro (Migration V2)

### Caminho para httpOnly Cookie

```
Estado Atual (V1):
  Backend (NanoClaw) → Bearer Token → sessionStorage

Migration V2:
  Opção 1: Backend adiciona suporte a cookies
    Backend → Set-Cookie → httpOnly cookie
    
  Opção 2: Proxy/API Route intermediário
    Backend → Bearer Token → [Proxy converte] → httpOnly cookie
    
  Opção 3: Mudança de backend
    Novo backend com cookie support
```

**Esforço estimado:** 3-5 dias

---

## Configuração

### Override Manual (se necessário)

```bash
# .env.local
# Forçar estratégia específica se detecção falhar
AUTH_STRATEGY=bearer-token-session
```

### Verificação Programática

```typescript
import { detectCookieSupport, generateAuthDecisionReport } from "@/lib/security/cookie-detector";

// Executar durante setup
const result = await detectCookieSupport();
console.log(generateAuthDecisionReport(result));

// Ou usar determinador completo
const { strategy, source, details } = await determineAuthStrategy();
// strategy: "bearer-token-session"
// source: "detected" | "manual" | "default"
```

---

## Checklist de Implementação

- [x] Decisão registrada neste ADR
- [x] Verificação realizada (baseada em documentação existente)
- [x] Resultado: NanoClaw usa bearer token, não cookie
- [x] Estratégia V1 selecionada: `bearer-token-session`
- [x] Mecanismo de detecção implementado
- [x] Trade-off documentado como temporário
- [x] Migration path definido
- [ ] Implementar auth service com sessionStorage
- [ ] Testar com backend real

---

## Registro de Decisão

| Data | Evento | Resultado |
|------|--------|-----------|
| 2026-04-07 | Decisão arquitetural | Aprovada estratégia híbrida |
| 2026-04-07 | Implementação detector | Criado `cookie-detector.ts` |
| 2026-04-07 | Verificação backend | Revisada ARCHITECTURE.md |
| 2026-04-07 | **Decisão Final V1** | **bearer-token-session** (fallback temporário) |
| ? | Reavaliação | Se NanoClaw suportar cookies ou mudar backend |

---

## Conclusão

**Decisão final para V1:** Usar bearer token em sessionStorage como trade-off temporário.

**Razão:** Backend NanoClaw retorna token no body, não utiliza cookies (conforme documentação existente).

**Status do trade-off:** ✅ Aceito como temporário, com migration path documentado para v2.

**Próximo passo:** Revisar ADR 2 (Session Strategy)

---

**Status:** ✅ DECISÃO FECHADA E DOCUMENTADA
