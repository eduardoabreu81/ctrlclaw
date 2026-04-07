/**
 * Cookie Support Detector - CtrlClaw
 * 
 * Este módulo verifica EXPLICITAMENTE se o backend suporta httpOnly cookies.
 * NÃO é automágico - é observável, debuggável e documentável.
 * 
 * Responsabilidade: Determinar qual estratégia de auth usar na v1
 * Decisão: Registrada em docs/decisions/auth-strategy-v1.md
 */

import { getBackendAdapter } from "@/lib/backend-factory";

export type AuthStrategy = "httpOnly-cookie" | "bearer-token-session" | "undetermined";

interface CookieDetectionResult {
  strategy: AuthStrategy;
  supportsCookies: boolean;
  cookieName?: string;
  cookieAttributes?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  };
  fallbackReason?: string;
  timestamp: string;
}

/**
 * Verifica explicitamente se o backend suporta cookies seguros
 * 
 * Método: Tenta fazer uma requisição de teste e analisa a resposta
 * Observável: Retorna resultado completo para logging/documentação
 * 
 * ⚠️ ATENÇÃO: Esta função deve ser chamada durante setup ou diagnostico,
 * NÃO a cada requisição.
 */
export async function detectCookieSupport(): Promise<CookieDetectionResult> {
  const timestamp = new Date().toISOString();
  
  try {
    const adapter = getBackendAdapter();
    
    // Verificar se adapter expõe informação sobre cookie support
    if ("supportsCookies" in adapter) {
      const supportsCookies = (adapter as { supportsCookies(): boolean }).supportsCookies();
      
      if (supportsCookies) {
        return {
          strategy: "httpOnly-cookie",
          supportsCookies: true,
          timestamp,
        };
      }
    }
    
    // Se não temos informação explícita, verificar via teste de login
    // Nota: Requer credenciais de teste ou endpoint de health que sete cookie
    return await testCookieViaRequest(timestamp);
    
  } catch (error) {
    return {
      strategy: "undetermined",
      supportsCookies: false,
      fallbackReason: `Erro na detecção: ${error}`,
      timestamp,
    };
  }
}

/**
 * Testa suporte a cookie via requisição real
 * 
 * Implementação específica para NanoClaw/OpenClaw
 * Verifica se resposta inclui Set-Cookie header
 */
async function testCookieViaRequest(timestamp: string): Promise<CookieDetectionResult> {
  const apiUrl = process.env.CLAW_API_URL;
  
  if (!apiUrl) {
    return {
      strategy: "undetermined",
      supportsCookies: false,
      fallbackReason: "CLAW_API_URL não configurado",
      timestamp,
    };
  }
  
  try {
    // Tentar endpoint de health ou login de teste
    // Nota: NanoClaw típico retorna token no body, não cookie
    const response = await fetch(`${apiUrl}/api/health`, {
      method: "GET",
      credentials: "include", // Importante: inclui cookies na requisição
    });
    
    // Verificar Set-Cookie header
    const setCookieHeader = response.headers.get("set-cookie");
    
    if (setCookieHeader) {
      // Analisar atributos do cookie
      const attributes = parseCookieAttributes(setCookieHeader);
      
      if (attributes.httpOnly && attributes.secure) {
        return {
          strategy: "httpOnly-cookie",
          supportsCookies: true,
          cookieName: extractCookieName(setCookieHeader),
          cookieAttributes: attributes,
          timestamp,
        };
      }
      
      // Cookie existe mas não é httpOnly/secure
      return {
        strategy: "bearer-token-session",
        supportsCookies: false,
        fallbackReason: `Cookie encontrado mas sem atributos seguros: ${JSON.stringify(attributes)}`,
        timestamp,
      };
    }
    
    // Nenhum cookie retornado - backend típico NanoClaw
    return {
      strategy: "bearer-token-session",
      supportsCookies: false,
      fallbackReason: "Backend não retorna Set-Cookie header (comportamento NanoClaw padrão)",
      timestamp,
    };
    
  } catch (error) {
    return {
      strategy: "undetermined",
      supportsCookies: false,
      fallbackReason: `Falha na requisição de teste: ${error}`,
      timestamp,
    };
  }
}

/**
 * Extrai nome do cookie do header Set-Cookie
 */
function extractCookieName(setCookieHeader: string): string {
  const match = setCookieHeader.match(/^([^=]+)=/);
  return match ? match[1] : "unknown";
}

/**
 * Parse atributos do cookie
 */
function parseCookieAttributes(setCookieHeader: string): {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
} {
  const header = setCookieHeader.toLowerCase();
  
  return {
    httpOnly: header.includes("httponly"),
    secure: header.includes("secure"),
    sameSite: header.includes("samesite=strict") 
      ? "strict" 
      : header.includes("samesite=lax")
      ? "lax"
      : header.includes("samesite=none")
      ? "none"
      : undefined,
  };
}

/**
 * Gera relatório de decisão para documentação
 */
export function generateAuthDecisionReport(result: CookieDetectionResult): string {
  return `
# Auth Strategy Decision Report
**Gerado em:** ${result.timestamp}

## Resultado da Detecção
- **Estratégia Selecionada:** ${result.strategy}
- **Suporte a Cookies:** ${result.supportsCookies ? "Sim" : "Não"}
${result.cookieName ? `- **Nome do Cookie:** ${result.cookieName}` : ""}
${result.cookieAttributes ? `- **Atributos:** ${JSON.stringify(result.cookieAttributes, null, 2)}` : ""}
${result.fallbackReason ? `- **Motivo do Fallback:** ${result.fallbackReason}` : ""}

## Decisão Arquitetural
${result.strategy === "httpOnly-cookie" 
  ? "✅ Usar httpOnly Secure Cookie - estratégia preferencial"
  : result.strategy === "bearer-token-session"
  ? "⚠️  Usar Bearer Token em sessionStorage - TRADE-OFF TEMPORÁRIO V1"
  : "❓ Indeterminado - requer investigação manual"}

## Notas
- NUNCA usar localStorage para tokens
- Reavaliar quando backend suportar cookies
- Migration path: Implementar proxy/API route com cookie
`;
}

/**
 * Configuração explícita da estratégia (para override manual)
 */
export function getConfiguredAuthStrategy(): AuthStrategy {
  const envStrategy = process.env.AUTH_STRATEGY as AuthStrategy | undefined;
  
  if (envStrategy && ["httpOnly-cookie", "bearer-token-session"].includes(envStrategy)) {
    return envStrategy;
  }
  
  return "undetermined";
}

/**
 * Determina estratégia final considerando:
 * 1. Override manual (env)
 * 2. Detecção automática (observável)
 * 3. Fallback seguro
 */
export async function determineAuthStrategy(): Promise<{
  strategy: AuthStrategy;
  source: "manual" | "detected" | "default";
  details: CookieDetectionResult | null;
}> {
  // 1. Verificar override manual
  const manual = getConfiguredAuthStrategy();
  if (manual !== "undetermined") {
    return {
      strategy: manual,
      source: "manual",
      details: null,
    };
  }
  
  // 2. Tentar detecção
  const detected = await detectCookieSupport();
  if (detected.strategy !== "undetermined") {
    return {
      strategy: detected.strategy,
      source: "detected",
      details: detected,
    };
  }
  
  // 3. Fallback seguro (mais conservador)
  return {
    strategy: "bearer-token-session",
    source: "default",
    details: detected,
  };
}
