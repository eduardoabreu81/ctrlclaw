/**
 * Rate Limiting - CtrlClaw
 * 
 * ⚠️ IMPORTANTE: Rate limiting no cliente é APENAS para UX (feedback visual),
 * NÃO é proteção real contra abuso.
 * 
 * Responsabilidades de Rate Limiting:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ CAMADA          │ RESPONSABILIDADE                                  │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ PROXY/Nginx     │ Rate limiting por IP, conexões simultâneas         │
 * │                 │ Bloqueio de IPs maliciosos, WAF básico            │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ Backend         │ Rate limiting por usuário/token, quotas de API     │
 * │                 │ Proteção contra brute force em endpoints auth     │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ Frontend        │ Coordenação UX, prevenção de double-submit        │
 * │ (este arquivo)  │ Feedback visual, debounce de ações do usuário     │
 * └─────────────────────────────────────────────────────────────────────┘
 */

// Configuração de rate limiting para UX (não é proteção real)
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

// Configurações por tipo de ação (apenas para UX)
const UX_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Login: evitar spam visual, backend faz proteção real
  login: { maxAttempts: 5, windowMs: 60 * 1000 }, // 5 tentativas por minuto
  
  // Envio de mensagens: prevenir double-click acidental
  sendMessage: { maxAttempts: 10, windowMs: 10 * 1000 }, // 10 mensagens em 10s
  
  // Requisições API gerais: debounce
  apiRequest: { maxAttempts: 100, windowMs: 60 * 1000 }, // 100 req/min
};

interface RateLimitState {
  attempts: number;
  windowStart: number;
  blockedUntil?: number;
}

// Estado em memória (não persistido)
const rateLimitStates = new Map<string, RateLimitState>();

/**
 * Verifica rate limiting para UX (feedback visual)
 * 
 * ⚠️ ATENÇÃO: Esta função NÃO protege contra abuso malicioso.
 * Ela apenas previne erros de usuário legítimo (double-click, spam acidental).
 * 
 * Para proteção real:
 * - Proxy/Nginx: Configurar limit_req_zone e limit_req
 * - Backend: Implementar rate limiting por token/IP
 */
export function checkClientRateLimit(
  action: keyof typeof UX_RATE_LIMITS,
  identifier: string
): { allowed: boolean; retryAfter?: number; remaining?: number } {
  const config = UX_RATE_LIMITS[action];
  const key = `${action}:${identifier}`;
  const now = Date.now();
  
  let state = rateLimitStates.get(key);
  
  // Inicializar estado se não existe ou janela expirou
  if (!state || now - state.windowStart > config.windowMs) {
    state = { attempts: 0, windowStart: now };
    rateLimitStates.set(key, state);
  }
  
  // Verificar se está bloqueado
  if (state.blockedUntil && now < state.blockedUntil) {
    return {
      allowed: false,
      retryAfter: Math.ceil((state.blockedUntil - now) / 1000),
      remaining: 0,
    };
  }
  
  // Incrementar contagem
  state.attempts++;
  
  // Verificar se excedeu limite
  if (state.attempts > config.maxAttempts) {
    state.blockedUntil = now + config.windowMs;
    return {
      allowed: false,
      retryAfter: Math.ceil(config.windowMs / 1000),
      remaining: 0,
    };
  }
  
  return {
    allowed: true,
    remaining: config.maxAttempts - state.attempts,
  };
}

/**
 * Reseta o rate limiting para um identificador
 * Útil após login bem-sucedido
 */
export function resetClientRateLimit(action: string, identifier: string): void {
  const key = `${action}:${identifier}`;
  rateLimitStates.delete(key);
}

/**
 * Retorna recomendações de configuração para o proxy
 */
export function getProxyRateLimitConfig(): string {
  return `
# Nginx Rate Limiting Configuration
# Adicionar ao nginx.conf no server block

# Limitar requisições por IP
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

# Aplicar limits
location /api/auth/login {
    limit_req zone=login burst=5 nodelay;
    # ... proxy pass
}

location /api/ {
    limit_req zone=general burst=20 nodelay;
    # ... proxy pass
}

# Limitar conexões simultâneas
limit_conn_zone $binary_remote_addr zone=addr:10m;
limit_conn addr 10;
`;
}

/**
 * Documentação de responsabilidades
 */
export const RATE_LIMIT_RESPONSIBILITIES = {
  proxy: [
    "Rate limiting por IP (requests por segundo)",
    "Limitação de conexões simultâneas",
    "Bloqueio de IPs maliciosos",
    "Proteção DDoS básica",
  ],
  backend: [
    "Rate limiting por usuário/token autenticado",
    "Quotas de API por usuário",
    "Brute force protection em endpoints críticos",
    "Validação de tokens e sessões",
  ],
  frontend: [
    "Prevenção de double-submit (UX)",
    "Debounce de ações do usuário",
    "Feedback visual de rate limiting",
    "NÃO é proteção contra abuso",
  ],
} as const;
