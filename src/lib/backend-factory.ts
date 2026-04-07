/**
 * Backend Adapter Factory - CtrlClaw
 * 
 * Factory pattern para criação de adapters de backend.
 * Desacoplado de implementações específicas.
 * 
 * Suporta: nanoclaw, openclaw, mock
 */

import { 
  ClawBackendAdapter, 
  BackendType, 
  BackendFactoryConfig,
  BackendError 
} from "@/types/backend-adapter";

// Imports dinâmicos para evitar circular dependencies
async function loadAdapter(type: BackendType): Promise<new () => ClawBackendAdapter> {
  switch (type) {
    case "nanoclaw":
      const { NanoClawAdapter } = await import("@/adapters/nanoclaw-adapter");
      return NanoClawAdapter;
    case "openclaw":
      const { OpenClawAdapter } = await import("@/adapters/openclaw-adapter");
      return OpenClawAdapter;
    case "mock":
      const { MockClawAdapter } = await import("@/adapters/mock-adapter");
      return MockClawAdapter;
    default:
      throw new BackendError("UNKNOWN_ADAPTER", `Unknown backend adapter: ${type}`);
  }
}

/**
 * Cria uma instância do adapter de backend
 * 
 * @param type - Tipo do backend (nanoclaw, openclaw, mock)
 * @returns Instância do adapter configurado
 */
export async function createBackendAdapter(
  type?: BackendType
): Promise<ClawBackendAdapter> {
  const adapterType = type || (process.env.NEXT_PUBLIC_BACKEND_ADAPTER as BackendType) || "mock";
  
  const AdapterClass = await loadAdapter(adapterType);
  const adapter = new AdapterClass();
  
  return adapter;
}

/**
 * Cria adapter com configuração explícita
 * 
 * Útil para testes ou quando precisa de múltiplas instâncias
 */
export async function createConfiguredBackendAdapter(
  config: BackendFactoryConfig
): Promise<ClawBackendAdapter> {
  const AdapterClass = await loadAdapter(config.type);
  const adapter = new AdapterClass();
  
  // Aqui poderíamos fazer configuração adicional se necessário
  
  return adapter;
}

// Singleton para reutilização
let adapterInstance: ClawBackendAdapter | null = null;
let adapterType: BackendType | null = null;

/**
 * Retorna adapter singleton (cached)
 * 
 * Mesmo tipo = mesma instância
 * Tipo diferente = recria
 */
export async function getBackendAdapter(): Promise<ClawBackendAdapter> {
  const currentType = (process.env.NEXT_PUBLIC_BACKEND_ADAPTER as BackendType) || "mock";
  
  if (!adapterInstance || adapterType !== currentType) {
    adapterInstance = await createBackendAdapter(currentType);
    adapterType = currentType;
  }
  
  return adapterInstance;
}

/**
 * Reseta o singleton (útil para testes)
 */
export function resetBackendAdapter(): void {
  adapterInstance = null;
  adapterType = null;
}

/**
 * Lista backends disponíveis
 */
export function getAvailableBackends(): BackendType[] {
  return ["nanoclaw", "openclaw", "mock"];
}

/**
 * Verifica se um backend type é válido
 */
export function isValidBackendType(type: string): type is BackendType {
  return ["nanoclaw", "openclaw", "mock"].includes(type);
}
