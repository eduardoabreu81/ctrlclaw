/**
 * Auth Store - CtrlClaw
 * 
 * Gerenciamento de estado de autenticação.
 * Usa Zustand com persistência via sessionStorage.
 * 
 * Correções:
 * - Reidratação na inicialização (lê sessionStorage)
 * - Estado de hidratação explícito (isHydrated)
 * - Route guard aguarda hidratação antes de redirecionar
 */

import { create } from "zustand";
import { AuthSession, LoginCredentials, User } from "@/types/entities";
import { getAuthService } from "@/features/auth/services/auth-service";
import { AuthError } from "@/types/backend-adapter";

const SESSION_KEY = "ctrlclaw_session";

interface AuthState {
  // Estado
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;  // ← NOVO: indica se reidratação foi feita
  
  // Ações
  login: (credentials: LoginCredentials, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setSession: (session: AuthSession | null) => void;
  hydrate: () => void;  // ← NOVO: forçar reidratação
}

/**
 * Recupera sessão inicial do sessionStorage
 * Executado apenas no lado do cliente
 */
function getInitialSession(): AuthSession | null {
  if (typeof window === "undefined") {
    console.log("[AuthStore] Server-side, retornando null");
    return null;
  }
  
  try {
    console.log("[AuthStore] Tentando recuperar sessão do sessionStorage...");
    const stored = sessionStorage.getItem(SESSION_KEY);
    
    if (!stored) {
      console.log("[AuthStore] Nenhuma sessão no sessionStorage");
      return null;
    }
    
    const session: AuthSession = JSON.parse(stored);
    console.log("[AuthStore] Sessão parseada, verificando expiração...");
    
    // Verificar se não expirou
    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();
    
    if (now > expiresAt) {
      console.log("[AuthStore] Sessão EXPIRADA, removendo");
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    
    console.log("[AuthStore] Sessão VÁLIDA recuperada:", session.user.username);
    return session;
    
  } catch (error) {
    console.error("[AuthStore] Erro ao recuperar sessão:", error);
    // Limpar sessionStorage corrompido
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Estado inicial com reidratação
  session: getInitialSession(),
  isLoading: false,
  error: null,
  isHydrated: typeof window === "undefined",  // Server-side considera hidratado

  // ============================================
  // Ações
  // ============================================

  hydrate: () => {
    console.log("[AuthStore] Forçando hidratação...");
    const session = getInitialSession();
    set({ 
      session, 
      isHydrated: true 
    });
    console.log("[AuthStore] Hidratação completa. Sessão:", session ? "presente" : "ausente");
  },

  login: async (credentials: LoginCredentials, rememberMe = false) => {
    console.log("[AuthStore] Login iniciado, rememberMe:", rememberMe);
    set({ isLoading: true, error: null });
    
    try {
      const authService = getAuthService();
      const storageMode = rememberMe ? "session" : "memory";
      console.log("[AuthStore] Chamando authService.login com storageMode:", storageMode);
      
      await authService.login(credentials, {
        storageMode,
      });
      
      console.log("[AuthStore] Login retornou, obtendo sessão...");
      const session = authService.getSession();
      console.log("[AuthStore] Sessão obtida:", session ? "SIM (token: " + session.token.substring(0,10) + "...)" : "NÃO");
      
      set({ session, isLoading: false, isHydrated: true });
      console.log("[AuthStore] Store atualizado, isAuthenticated será:", !!session);
      
    } catch (error) {
      let message = "Login failed";
      
      if (error instanceof AuthError) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      
      set({ error: message, isLoading: false, isHydrated: true });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    
    try {
      const authService = getAuthService();
      await authService.logout();
      
      set({ session: null, isLoading: false, error: null, isHydrated: true });
      
    } catch (error) {
      // Mesmo se falhar, limpar estado local
      set({ session: null, isLoading: false, error: null, isHydrated: true });
    }
  },

  clearError: () => set({ error: null }),

  setSession: (session: AuthSession | null) => set({ session, isHydrated: true }),
}));

// ============================================
// Selectores
// ============================================

export function useIsAuthenticated(): boolean {
  const session = useAuthStore(state => state.session);
  return !!session;
}

export function useIsHydrated(): boolean {
  return useAuthStore(state => state.isHydrated);
}

export function useCurrentUser(): User | null {
  const session = useAuthStore(state => state.session);
  return session?.user || null;
}

export function useAuthToken(): string | null {
  const session = useAuthStore(state => state.session);
  return session?.token || null;
}

export function useAuthLoading(): boolean {
  return useAuthStore(state => state.isLoading);
}

export function useAuthError(): string | null {
  return useAuthStore(state => state.error);
}
