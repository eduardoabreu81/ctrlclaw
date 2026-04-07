/**
 * OpenClaw Adapter - CtrlClaw
 * 
 * Placeholder para futuro suporte a OpenClaw.
 * 
 * ⚠️ NOTA: OpenClaw ainda não é suportado na v1.
 * Este adapter existe apenas para demonstrar:
 * 1. Como adicionar novos backends
 * 2. Que o adapter pattern está funcionando
 * 3. Preparação para v2
 * 
 * Para implementar:
 * 1. Copiar estrutura do NanoClawAdapter
 * 2. Adaptar endpoints conforme API OpenClaw
 * 3. Adicionar capabilities específicas
 * 4. Implementar auth (pode suportar cookies)
 */

import {
  ClawBackendAdapter,
  BackendCapability,
  CreateAgentConfig,
  NotImplementedError,
} from "@/types/backend-adapter";
import {
  Agent,
  AuthResult,
  LoginCredentials,
  User,
} from "@/types/entities";
import { WebSocketConfig } from "@/types/websocket";

export class OpenClawAdapter implements ClawBackendAdapter {
  readonly type = "openclaw";
  readonly version = "0.0.0-placeholder";
  readonly capabilities: BackendCapability[] = [
    // OpenClaw pode suportar mais features que NanoClaw
    // Exemplos:
    // 'oauth_login',
    // 'refresh_token',
    // 'agent_creation',
    // 'multi_workspace',
  ];

  constructor() {
    console.warn("[OpenClawAdapter] Placeholder - não implementado na v1");
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    throw new NotImplementedError("openclaw_login");
  }

  async logout(token: string): Promise<void> {
    throw new NotImplementedError("openclaw_logout");
  }

  async validateSession(token: string): Promise<User> {
    throw new NotImplementedError("openclaw_validateSession");
  }

  async listAgents(token: string): Promise<Agent[]> {
    throw new NotImplementedError("openclaw_listAgents");
  }

  async getAgent(token: string, id: string): Promise<Agent> {
    throw new NotImplementedError("openclaw_getAgent");
  }

  getHttpUrl(): string {
    throw new NotImplementedError("openclaw_getHttpUrl");
  }

  getWebSocketUrl(token: string): string {
    throw new NotImplementedError("openclaw_getWebSocketUrl");
  }

  getWebSocketConfig(token: string): WebSocketConfig {
    throw new NotImplementedError("openclaw_getWebSocketConfig");
  }

  supports(feature: BackendCapability): boolean {
    return this.capabilities.includes(feature);
  }
}
