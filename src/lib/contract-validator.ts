/**
 * Contract Validator - CtrlClaw
 * 
 * Valida que implementações de adapter estão em conformidade
 * com os contratos definidos.
 * 
 * Executar durante:
 * - CI/CD (prevenir regressões)
 * - Setup inicial (verificar configuração)
 * - Desenvolvimento (validar mock)
 * 
 * Se houver divergência entre contrato e implementação:
 * 1. Documentar neste arquivo
 * 2. Corrigir adapter OU contrato
 * 3. NÃO prosseguir para UI até resolver
 */

import { ClawBackendAdapter } from "@/types/backend-adapter";
import { LoginCredentials } from "@/types/entities";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  adapter: string;
}

/**
 * Valida um adapter contra o contrato
 * 
 * @param adapter - Instância do adapter a validar
 * @returns Resultado da validação
 */
export async function validateAdapter(adapter: ClawBackendAdapter): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // ============================================
  // 1. Validação de interface
  // ============================================
  
  // Propriedades obrigatórias
  if (!adapter.type) {
    errors.push("Adapter deve ter propriedade 'type'");
  }
  
  if (!adapter.version) {
    errors.push("Adapter deve ter propriedade 'version'");
  }
  
  if (!Array.isArray(adapter.capabilities)) {
    errors.push("Adapter deve ter 'capabilities' como array");
  }
  
  // Métodos obrigatórios
  const requiredMethods = [
    'login',
    'logout', 
    'validateSession',
    'listAgents',
    'getAgent',
    'getWebSocketUrl',
    'getWebSocketConfig',
    'supports',
  ];
  
  for (const method of requiredMethods) {
    if (typeof ((adapter as unknown) as Record<string, unknown>)[method] !== 'function') {
      errors.push(`Adapter deve implementar método '${method}'`);
    }
  }
  
  // ============================================
  // 2. Validação de comportamento (se possível)
  // ============================================
  
  // Testar supports()
  try {
    const supportsResult = adapter.supports('refresh_token');
    if (typeof supportsResult !== 'boolean') {
      errors.push("supports() deve retornar boolean");
    }
  } catch (e) {
    errors.push(`supports() lançou exceção: ${e}`);
  }
  
  // ============================================
  // 3. Validação específica por tipo
  // ============================================
  
  if (adapter.type === 'nanoclaw') {
    validateNanoClawSpecifics(adapter, errors, warnings);
  } else if (adapter.type === 'mock') {
    validateMockSpecifics(adapter, errors, warnings);
  }
  
  // ============================================
  // 4. Validação de contratos HTTP (se aplicável)
  // ============================================
  
  // Nota: Validar endpoints reais requer backend rodando
  // Isso é feito em validateHttpContracts()
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    adapter: adapter.type,
  };
}

/**
 * Valida específicos do NanoClaw
 */
function validateNanoClawSpecifics(
  adapter: ClawBackendAdapter,
  errors: string[],
  warnings: string[]
): void {
  // NanoClaw não deve suportar certas capabilities (ainda)
  const unsupportedCapabilities = [
    'oauth_login',
    'refresh_token',
    'multi_workspace',
  ];
  
  for (const cap of unsupportedCapabilities) {
    if (adapter.supports(cap as Parameters<ClawBackendAdapter['supports']>[0])) {
      warnings.push(`NanoClaw não deveria suportar '${cap}' na v1`);
    }
  }
  
  // Verificar se version está definida
  if (adapter.version === '0.0.0' || !adapter.version) {
    warnings.push("NanoClawAdapter deve ter version definida");
  }
}

/**
 * Valida específicos do Mock
 */
function validateMockSpecifics(
  adapter: ClawBackendAdapter,
  errors: string[],
  warnings: string[]
): void {
  // Mock deve suportar operações de CRUD para testes
  const expectedCapabilities = [
    'agent_creation',
    'agent_deletion',
  ];
  
  for (const cap of expectedCapabilities) {
    if (!adapter.supports(cap as Parameters<ClawBackendAdapter['supports']>[0])) {
      warnings.push(`Mock deveria suportar '${cap}' para testes completos`);
    }
  }
}

/**
 * Valida contratos HTTP contra backend real
 * 
 * ⚠️ Requer backend acessível
 * ⚠️ Pode criar dados de teste
 */
export async function validateHttpContracts(
  adapter: ClawBackendAdapter,
  testCredentials?: LoginCredentials
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Se não temos credenciais, não podemos testar auth
  if (!testCredentials) {
    warnings.push("Sem credenciais de teste - pulando validação de auth");
    return {
      valid: true, // Não é erro, apenas não testamos
      errors,
      warnings,
      adapter: adapter.type,
    };
  }
  
  let token: string | null = null;
  
  // ============================================
  // Testar login
  // ============================================
  try {
    const authResult = await adapter.login(testCredentials);
    
    // Validar estrutura do resultado
    if (!authResult.token) {
      errors.push("AuthResult deve ter 'token'");
    }
    if (!authResult.user) {
      errors.push("AuthResult deve ter 'user'");
    }
    if (!authResult.expiresIn) {
      errors.push("AuthResult deve ter 'expiresIn'");
    }
    
    token = authResult.token;
    
  } catch (error) {
    errors.push(`Login falhou: ${error}`);
    return {
      valid: false,
      errors,
      warnings,
      adapter: adapter.type,
    };
  }
  
  // ============================================
  // Testar validateSession
  // ============================================
  try {
    const user = await adapter.validateSession(token);
    
    if (!user.username) {
      errors.push("User deve ter 'username'");
    }
    if (!Array.isArray(user.permissions)) {
      errors.push("User deve ter 'permissions' como array");
    }
    
  } catch (error) {
    errors.push(`validateSession falhou: ${error}`);
  }
  
  // ============================================
  // Testar listAgents
  // ============================================
  try {
    const agents = await adapter.listAgents(token);
    
    if (!Array.isArray(agents)) {
      errors.push("listAgents deve retornar array");
    } else {
      // Validar estrutura do primeiro agente (se existir)
      if (agents.length > 0) {
        const agent = agents[0];
        if (!agent.id) errors.push("Agent deve ter 'id'");
        if (!agent.name) errors.push("Agent deve ter 'name'");
        if (!agent.status) errors.push("Agent deve ter 'status'");
      }
    }
    
  } catch (error) {
    errors.push(`listAgents falhou: ${error}`);
  }
  
  // ============================================
  // Testar WebSocket config
  // ============================================
  try {
    const wsUrl = adapter.getWebSocketUrl(token);
    const wsConfig = adapter.getWebSocketConfig(token);
    
    if (!wsUrl) {
      errors.push("getWebSocketUrl deve retornar URL");
    }
    if (!wsConfig.url) {
      errors.push("WebSocketConfig deve ter 'url'");
    }
    if (!wsConfig.authMethod) {
      errors.push("WebSocketConfig deve ter 'authMethod'");
    }
    
    // Verificar se URL usa protocolo correto
    if (wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://')) {
      // OK
    } else {
      errors.push(`WebSocket URL inválida: ${wsUrl}`);
    }
    
  } catch (error) {
    errors.push(`WebSocket config falhou: ${error}`);
  }
  
  // ============================================
  // Cleanup
  // ============================================
  try {
    await adapter.logout(token);
  } catch {
    // Ignorar erro no cleanup
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    adapter: adapter.type,
  };
}

/**
 * Valida contratos WebSocket
 * 
 * Nota: WebSocket é testado em tempo de execução,
 * não podemos validar estaticamente como HTTP
 */
export function validateWebSocketContracts(): {
  protocolVersion: string;
  messageTypes: string[];
  requiredServerTypes: string[];
  requiredClientTypes: string[];
} {
  // Documentação do protocolo WebSocket
  return {
    protocolVersion: "1",
    messageTypes: [
      // Client → Server
      'authenticate',
      'subscribe',
      'unsubscribe',
      'ping',
      'chat_message',
      'ack',
      // Server → Client
      'auth_required',
      'auth_success',
      'auth_failed',
      'subscribed',
      'message',
      'agent_update',
      'agent_list',
      'connection_status',
      'error',
      'pong',
    ],
    requiredServerTypes: [
      'auth_required',
      'auth_success',
      'auth_failed',
      'message',
      'error',
      'pong',
    ],
    requiredClientTypes: [
      'authenticate',
      'ping',
    ],
  };
}

/**
 * Relatório completo de validação
 */
export function generateValidationReport(
  results: ValidationResult[]
): string {
  let report = `# Contract Validation Report\n\n`;
  report += `**Data:** ${new Date().toISOString()}\n\n`;
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const result of results) {
    report += `## ${result.adapter}\n\n`;
    report += `**Status:** ${result.valid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}\n\n`;
    
    if (result.errors.length > 0) {
      report += `**Erros:**\n`;
      for (const error of result.errors) {
        report += `- ❌ ${error}\n`;
      }
      report += `\n`;
    }
    
    if (result.warnings.length > 0) {
      report += `**Avisos:**\n`;
      for (const warning of result.warnings) {
        report += `- ⚠️ ${warning}\n`;
      }
      report += `\n`;
    }
    
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  }
  
  report += `---\n\n`;
  report += `**Resumo:**\n`;
  report += `- Total de erros: ${totalErrors}\n`;
  report += `- Total de avisos: ${totalWarnings}\n`;
  report += `- Status geral: ${totalErrors === 0 ? '✅ VÁLIDO' : '❌ INVÁLIDO'}\n`;
  
  return report;
}

/**
 * Executa validação completa
 */
export async function runFullValidation(
  adapters: ClawBackendAdapter[],
  options?: {
    testCredentials?: LoginCredentials;
    testHttp?: boolean;
  }
): Promise<{
  valid: boolean;
  report: string;
  results: ValidationResult[];
}> {
  const results: ValidationResult[] = [];
  
  for (const adapter of adapters) {
    // Validação estática
    const staticResult = await validateAdapter(adapter);
    
    // Validação HTTP (se solicitado e possível)
    if (options?.testHttp && options?.testCredentials) {
      const httpResult = await validateHttpContracts(adapter, options.testCredentials);
      
      // Merge resultados
      results.push({
        valid: staticResult.valid && httpResult.valid,
        errors: [...staticResult.errors, ...httpResult.errors],
        warnings: [...staticResult.warnings, ...httpResult.warnings],
        adapter: adapter.type,
      });
    } else {
      results.push(staticResult);
    }
  }
  
  const valid = results.every(r => r.valid);
  const report = generateValidationReport(results);
  
  return { valid, report, results };
}
