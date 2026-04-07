# Limitações e Trade-offs - CtrlClaw v1

> **Versão:** 1.0  
> **Status:** Documentado para transparência

---

## Trade-offs Temporários V1

### 1. Token Storage (CRÍTICO)

**Decisão:** Bearer token em sessionStorage

**Por quê:** Backend NanoClaw não suporta httpOnly cookies

**Impacto:**
- ✅ Token acessível a JavaScript (XSS vulnerability)
- ✅ Perde sessão ao fechar aba (modo memory)
- ✅ Múltiplas abas não compartilham sessão

**Migration Path v2:**
- Implementar proxy/API route que seta httpOnly cookie
- Token nunca toca JavaScript

---

### 2. CRUD de Agentes

**Decisão:** CRUD completo apenas no Mock

**Por quê:** NanoClaw v1 não expõe API para CRUD

**Impacto:**
- ✅ Mock permite criar/editar/deletar agentes
- ❌ Backend real: apenas listar e visualizar

**Nota:** Isso é **intencional** - NanoClaw é backend de referência, não alvo final.

---

### 3. Reconnection

**Decisão:** Validado em nível de estado/lógica

**Por quê:** Sem backend real para testar quedas de rede

**Impacto:**
- ✅ Lógica de reconexão implementada
- ✅ Estados transitam corretamente
- ❌ Comportamento real em quedas não testado
- ❌ Latência real entre tentativas desconhecida

**Será validado na Fase 5:**
- Reconnect em queda de rede real
- Comportamento com 10 tentativas reais
- Jitter em condições reais

---

### 4. Fila de Mensagens

**Decisão:** Validada em nível de lógica

**Por quê:** Sem condições de rede reais

**Impacto:**
- ✅ Mensagens enfileiradas quando offline
- ✅ Flush ao voltar online
- ❌ Comportamento com fila grande em rede lenta
- ❌ Race conditions não testadas

---

### 5. Session Restore

**Decisão:** Restore local implementado

**Por quê:** Validação remota requer backend real

**Impacto:**
- ✅ Sessão restaurada do sessionStorage
- ✅ Store rehidratada
- ✅ Tentativa de reconexão
- ❌ Token não validado remotamente no restore

---

### 6. Latência

**Decisão:** Simulada no Mock (100ms)

**Por quê:** Sem backend real

**Impacto:**
- ✅ UX otimizada para 100ms
- ❌ Tempos reais desconhecidos
- ❌ Timeouts podem precisar ajuste

---

## Limitações Conhecidas (Não são Trade-offs)

### NanoClaw como Único Backend de Referência

**Situação:** Apenas NanoClawAdapter implementado

**Não é problema:** Adapter pattern permite adicionar outros backends

**Futuro:** OpenClawAdapter, adapters customizados

---

### Multi-tab Não Compartilha Sessão

**Situação:** sessionStorage é por aba

**Causa raiz:** Trade-off #1 (token storage)

**Resolução:** Resolver trade-off #1 (httpOnly cookie)

---

## O que NÃO é Limitação

| Aspecto | Status | Nota |
|---------|--------|------|
| CORS | ✅ Configurado | Whitelist explícita |
| SSL/TLS | ✅ Configurado | Let's Encrypt ou Cloudflare |
| Security headers | ✅ Implementado | CSP, HSTS, etc. |
| Input validation | ✅ Implementado | Zod em todos os forms |
| Adapter pattern | ✅ Funcional | Desacoplado de backends |

---

## Checklist para v2

- [ ] httpOnly cookie (resolves trade-off #1)
- [ ] Multi-tab session sharing
- [ ] CRUD agentes no backend (se suportado)
- [ ] Refresh token rotation
- [ ] IndexedDB para histórico offline (opt-in)

---

## Documentação Relacionada

- [Fase 4 - Validado com Mock](fase4-validado-mock.md)
- [Fase 4 - Pendente Backend](fase4-pendente-backend.md)
- [Fase 5 - Proposta](fase5-proposta.md)
