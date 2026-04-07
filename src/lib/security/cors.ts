/**
 * CORS Configuration - CtrlClaw
 * 
 * ⚠️ SECURITY: CORS nunca deve estar "aberto" (wildcard *) em produção.
 * Whitelist explícita é obrigatória.
 * 
 * Responsabilidades:
 * - Frontend: Validação de origem no middleware, headers CORS
 * - Proxy: Bloqueio de origens não autorizadas antes de chegar ao frontend
 * - Backend: Validação final de origem (defense in depth)
 */

// Ambiente de desenvolvimento
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

// Ambiente de produção (configurável via variáveis de ambiente)
function getProductionOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim());
  }
  
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    return [frontendUrl];
  }
  
  // ⚠️ CRITICAL: Em produção, se não houver ALLOWED_ORIGINS configurado,
  // o sistema NÃO deve aceitar requisições de origens desconhecidas
  console.error("[SECURITY] ALLOWED_ORIGINS ou FRONTEND_URL não configurado!");
  return [];
}

/**
 * Lista de origens permitidas
 */
export function getAllowedOrigins(): string[] {
  const isDev = process.env.NODE_ENV === "development";
  
  if (isDev) {
    return [...DEV_ORIGINS, ...getProductionOrigins()];
  }
  
  return getProductionOrigins();
}

/**
 * Valida se uma origem está na whitelist
 */
export function validateOrigin(origin: string | null): boolean {
  if (!origin) return true; // Requests without origin (e.g., server-to-server)
  
  const allowed = getAllowedOrigins();
  
  // Em produção sem configuração, bloquear tudo
  if (allowed.length === 0 && process.env.NODE_ENV === "production") {
    console.error(`[SECURITY] Bloqueando origem ${origin} - nenhuma origem configurada`);
    return false;
  }
  
  return allowed.includes(origin);
}

/**
 * Verifica se CORS está configurado corretamente para produção
 */
export function validateCorsConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ALLOWED_ORIGINS && !process.env.FRONTEND_URL) {
      errors.push("ALLOWED_ORIGINS ou FRONTEND_URL deve ser configurado em produção");
    }
    
    const origins = getProductionOrigins();
    if (origins.length === 0) {
      errors.push("Nenhuma origem permitida configurada");
    }
    
    // Verificar se há wildcard (não permitido)
    if (origins.includes("*")) {
      errors.push("Wildcard (*) não permitido em ALLOWED_ORIGINS");
    }
    
    // Verificar se há origens HTTP em produção
    const httpOrigins = origins.filter((o) => o.startsWith("http://"));
    if (httpOrigins.length > 0) {
      errors.push(`Origens HTTP não seguras detectadas: ${httpOrigins.join(", ")}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
