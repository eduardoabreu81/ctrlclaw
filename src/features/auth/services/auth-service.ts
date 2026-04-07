/**
 * Auth Service - CtrlClaw
 * 
 * Implementa IAuthService usando backend adapter.
 * Conforme decisões do checkpoint:
 * - Auth: bearer token em sessionStorage (trade-off v1)
 * - Session: 30min TTL, 30min idle, 24h absolute
 * - Auto-recovery de sessão do sessionStorage
 */

import { IAuthService, LoginOptions } from "@/lib/services/interfaces";
import {
  AuthResult,
  LoginCredentials,
  User,
  AuthSession,
} from "@/types/entities";
import { getBackendAdapter } from "@/lib/backend-factory";
import { AuthError } from "@/types/backend-adapter";

const SESSION_KEY = "ctrlclaw_session";
const SESSION_TTL_MINUTES = 30;
const ABSOLUTE_TIMEOUT_HOURS = 24;

class AuthService implements IAuthService {
  private session: AuthSession | null = null;
  private loginTime: Date | null = null;

  constructor() {
    // Tentar recuperar sessão do sessionStorage
    this.recoverSession();
  }

  // ============================================
  // Autenticação
  // ============================================

  async login(
    credentials: LoginCredentials,
    options: LoginOptions = {}
  ): Promise<AuthResult> {
    console.log("[AuthService] Iniciando login...");
    const adapter = await getBackendAdapter();
    console.log("[AuthService] Adapter:", adapter.type);
    
    // Login no backend
    console.log("[AuthService] Chamando adapter.login...");
    const result = await adapter.login(credentials);
    console.log("[AuthService] Login OK, token recebido");
    
    // Criar sessão
    const now = new Date();
    const session: AuthSession = {
      token: result.token,
      user: result.user,
      expiresAt: new Date(now.getTime() + result.expiresIn * 1000).toISOString(),
      obtainedAt: now.toISOString(),
    };
    
    // Armazenar
    this.session = session;
    this.loginTime = now;
    
    // Persistir em sessionStorage se solicitado
    console.log("[AuthService] storageMode:", options.storageMode);
    if (options.storageMode === "session") {
      console.log("[AuthService] Persistindo sessão...");
      this.persistSession(session);
      console.log("[AuthService] Sessão persistida!");
    } else {
      console.log("[AuthService] NÃO persistindo (storageMode !== 'session')");
    }
    
    return result;
  }

  async logout(): Promise<void> {
    if (!this.session) return;
    
    const adapter = await getBackendAdapter();
    
    // Notificar backend (best effort)
    try {
      await adapter.logout(this.session.token);
    } catch {
      // Ignorar erro - continuamos com logout local
    }
    
    // Limpar estado
    this.clearSession();
  }

  async validateSession(): Promise<User> {
    if (!this.session) {
      throw new AuthError("NO_SESSION", "No active session");
    }
    
    // Verificar absolute timeout (24h)
    if (this.isAbsoluteExpired()) {
      this.clearSession();
      throw new AuthError("ABSOLUTE_TIMEOUT", "Session expired (24h limit)");
    }
    
    // Verificar TTL local
    if (this.isTokenExpired()) {
      this.clearSession();
      throw new AuthError("SESSION_EXPIRED", "Session expired");
    }
    
    // Validar com backend
    const adapter = await getBackendAdapter();
    const user = await adapter.validateSession(this.session.token);
    
    // Atualizar dados do usuário
    this.session.user = user;
    
    return user;
  }

  // ============================================
  // Getters
  // ============================================

  hasValidSession(): boolean {
    if (!this.session) return false;
    if (this.isTokenExpired()) return false;
    if (this.isAbsoluteExpired()) return false;
    return true;
  }

  getToken(): string | null {
    return this.session?.token || null;
  }

  getCurrentUser(): User | null {
    return this.session?.user || null;
  }

  getSession(): AuthSession | null {
    return this.session;
  }

  // ============================================
  // Session Recovery
  // ============================================

  private recoverSession(): void {
    console.log("[AuthService] recoverSession() chamado");
    if (typeof window === "undefined") {
      console.log("[AuthService] window undefined, não recuperando");
      return;
    }
    
    try {
      console.log("[AuthService] Verificando sessionStorage...");
      const stored = sessionStorage.getItem(SESSION_KEY);
      console.log("[AuthService] sessionStorage.getItem('ctrlclaw_session'):", stored ? "ENCONTRADO" : "VAZIO");
      
      if (!stored) {
        console.log("[AuthService] Nada no sessionStorage, retornando");
        return;
      }
      
      const session: AuthSession = JSON.parse(stored);
      console.log("[AuthService] Sessão parseada, token:", session.token.substring(0, 10) + "...");
      
      // Verificar se não expirou
      const expiresAt = new Date(session.expiresAt).getTime();
      const now = Date.now();
      console.log("[AuthService] Verificando expiração:", { expiresAt: new Date(expiresAt).toISOString(), now: new Date(now).toISOString() });
      
      if (now > expiresAt) {
        console.log("[AuthService] Sessão EXPIRADA, removendo");
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }
      
      this.session = session;
      this.loginTime = new Date(session.obtainedAt);
      console.log("[AuthService] Sessão RECUPERADA com sucesso!");
      
    } catch (error) {
      console.error("[AuthService] Erro ao recuperar sessão:", error);
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  private persistSession(session: AuthSession): void {
    console.log("[AuthService] persistSession() chamado");
    if (typeof window === "undefined") {
      console.log("[AuthService] window undefined, não persistindo");
      return;
    }
    
    try {
      console.log("[AuthService] Salvando no sessionStorage...");
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      console.log("[AuthService] Sessão salva! Chave:", SESSION_KEY);
      
      // Verificar se salvou
      const verify = sessionStorage.getItem(SESSION_KEY);
      console.log("[AuthService] Verificação sessionStorage:", verify ? "SUCESSO" : "FALHA");
    } catch (error) {
      console.error("[AuthService] Erro ao persistir sessão:", error);
    }
  }

  private clearSession(): void {
    this.session = null;
    this.loginTime = null;
    
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  // ============================================
  // Validações
  // ============================================

  private isTokenExpired(): boolean {
    if (!this.session) return true;
    
    const expiresAt = new Date(this.session.expiresAt).getTime();
    return Date.now() > expiresAt;
  }

  private isAbsoluteExpired(): boolean {
    if (!this.loginTime) return true;
    
    const absoluteExpiry = new Date(
      this.loginTime.getTime() + ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000
    );
    return Date.now() > absoluteExpiry.getTime();
  }

  // ============================================
  // Refresh (se suportado no futuro)
  // ============================================

  async refreshSession(): Promise<boolean> {
    const adapter = await getBackendAdapter();
    
    // Verificar se backend suporta refresh
    if (!adapter.supports("refresh_token") || !adapter.refreshToken) {
      return false;
    }
    
    if (!this.session) return false;
    
    try {
      const result = await adapter.refreshToken(this.session.token);
      
      // Atualizar sessão
      const now = new Date();
      this.session = {
        token: result.token,
        user: result.user,
        expiresAt: new Date(now.getTime() + result.expiresIn * 1000).toISOString(),
        obtainedAt: now.toISOString(),
      };
      
      // Atualizar storage
      this.persistSession(this.session);
      
      return true;
      
    } catch {
      return false;
    }
  }
}

// Singleton
let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}

export function resetAuthService(): void {
  authServiceInstance = null;
}

// Exportar classe para testes
export { AuthService };
