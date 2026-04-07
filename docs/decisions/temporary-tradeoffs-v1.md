# Trade-offs Temporários V1

> **Status:** Documentado para revisão no Checkpoint  
> **Versão:** 1.0  
> **Data:** 2026-04-07

---

## Visão Geral

Estes são os trade-offs técnicos temporários aceitos na v1 do CtrlClaw. Cada um deve ser tratado como **dívida técnica intencional** com plano claro de migração para v2.

---

## Lista de Trade-offs

### 1. Token Storage (CRÍTICO)

| Aspecto | V1 (Trade-off) | V2 (Ideal) |
|---------|----------------|------------|
| **Implementação** | Memory/sessionStorage | httpOnly Secure Cookie |
| **Segurança** | Média (vulnerável a XSS) | Alta (inacessível a JS) |
| **UX** | Ruim (perde sessão em reload) | Excelente |
| **Backend** | Não requer mudanças | Requer suporte a cookies |

**Condição para V1:** Apenas se backend realmente limitar cookies.
**Migration Path:** Implementar proxy/API route que converte bearer token em httpOnly cookie.
**Timeline V2:** Assim que confirmado suporte a cookies no backend.

---

### 2. NanoClaw Adapter (Backend)

| Aspecto | V1 (Trade-off) | V2+ (Ideal) |
|---------|----------------|-------------|
| **Implementação** | NanoClawAdapter | Múltiplos adapters |
| **Acoplamento** | Referência inicial | Totalmente desacoplado |
| **Testes** | Requer backend real | Mock adapter total |

**Nota:** NanoClaw é **backend de referência** para validação da arquitetura. O adapter pattern garante desacoplamento.
**Migration Path:** Implementar OpenClawAdapter, MockClawAdapter.
**Timeline V2:** Após estabilização da interface.

---

### 3. CSP com unsafe-eval/inline

| Aspecto | V1 (Trade-off) | V2 (Ideal) |
|---------|----------------|------------|
| **Implementação** | CSP permite unsafe-eval/inline | CSP strict com nonces |
| **Segurança** | Reduzida | Máxima |
| **Framework** | Next.js requer | Next.js suporta com config |

**Condição para V1:** Necessário para funcionamento do Next.js.
**Migration Path:** Configurar nonces para inline scripts, SRI para externos.
**Timeline V2:** Após setup inicial estável.

---

### 4. WebSocket Auth via Mensagem

| Aspecto | V1 (Trade-off) | V2 (Ideal) |
|---------|----------------|------------|
| **Implementação** | Envia token via mensagem WS | Cookie automático |
| **Segurança** | Token em memória JS | Token inacessível |
| **Complexidade** | Alta (re-auth em reconnect) | Baixa |

**Condição para V1:** Se cookie não suportado para WS.
**Migration Path:** Implementar cookie-based auth com query param temporário.
**Timeline V2:** Junto com httpOnly cookie.

---

### 5. Rate Limiting (Client-side)

| Aspecto | V1 (Realidade) | Ideal |
|---------|----------------|-------|
| **Implementação** | UX coordination apenas | Proteção real |
| **Efetividade** | Nenhuma contra abuso | Proteção completa |
| **Responsabilidade** | Frontend | Proxy + Backend |

**Nota:** Rate limiting no cliente é **sempre** apenas para UX.
**Proteção real:** Configurada no Nginx (proxy) e validada no backend.
**Timeline:** N/A - sempre será assim (defense in depth).

---

### 6. Sem Persistência Offline

| Aspecto | V1 (Trade-off) | V2+ (Ideal) |
|---------|----------------|-------------|
| **Mensagens** | Apenas em memória | IndexedDB criptografado |
| **Offline** | Não suportado | Suporte limitado |
| **UX** | Requer conexão | Funciona offline parcial |

**Condição para V1:** Segurança primeiro - persistência local é risco.
**Migration Path:** IndexedDB com criptografia (chave derivada de sessão).
**Timeline V2+:** Opt-in com consentimento explícito do usuário.

---

## Resumo de Impacto

| Trade-off | Impacto Segurança | Impacto UX | Esforço Migration |
|-----------|-------------------|------------|-------------------|
| Token Storage | ⭐⭐⭐⭐ Alta | ⭐⭐⭐⭐ Alta | ⭐⭐⭐ Médio |
| NanoClaw Adapter | ⭐ Baixa | ⭐ Baixa | ⭐⭐ Médio |
| CSP | ⭐⭐ Média | ⭐ Nenhum | ⭐⭐ Médio |
| WS Auth | ⭐⭐ Média | ⭐⭐⭐ Média | ⭐⭐ Médio |
| Rate Limiting | ⭐ Nenhum | ⭐ Nenhum | N/A |
| Offline | ⭐⭐ Média | ⭐⭐⭐ Média | ⭐⭐⭐⭐ Alto |

---

## Checklist para Checkpoint

- [ ] Confirmar que token storage é realmente necessário como trade-off
- [ ] Validar que NanoClaw é apenas referência, não acoplamento
- [ ] Aceitar CSP como limitação do framework
- [ ] Documentar WS auth como temporário
- [ ] Clarificar rate limiting (client vs proxy vs backend)
- [ ] Decidir se offline mode é prioridade v2

---

## Próximos Passos

1. **Checkpoint Estratégico:** Revisar e aceitar trade-offs
2. **V1:** Implementar com trade-offs documentados
3. **V2:** Executar migration paths conforme prioridade

---

**Relacionado:** Todos os ADRs em `docs/decisions/`
