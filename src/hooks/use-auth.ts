/**
 * useAuth Hook - CtrlClaw
 * 
 * Hook wrapper do auth store.
 * Facilita uso em componentes.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  useAuthStore, 
  useIsAuthenticated, 
  useIsHydrated,
  useCurrentUser, 
  useAuthToken,
  useAuthLoading,
  useAuthError,
} from "@/features/auth/stores/auth-store";
import { LoginCredentials } from "@/types/entities";

export function useAuth() {
  const store = useAuthStore();
  
  return {
    // Estado
    isAuthenticated: useIsAuthenticated(),
    isHydrated: useIsHydrated(),
    user: useCurrentUser(),
    token: useAuthToken(),
    isLoading: useAuthLoading(),
    error: useAuthError(),
    session: store.session,
    
    // Ações
    login: store.login,
    logout: store.logout,
    clearError: store.clearError,
    hydrate: store.hydrate,
  };
}

/**
 * Hook para proteção de rotas
 * Redireciona para /login se não autenticado
 * 
 * CORREÇÃO: Aguarda hidratação antes de decidir redirecionar
 */
export function useRequireAuth() {
  const isAuthenticated = useIsAuthenticated();
  const isHydrated = useIsHydrated();
  const isLoading = useAuthLoading();
  const router = useRouter();
  
  console.log("[useRequireAuth] Estado:", { isLoading, isHydrated, isAuthenticated });
  
  useEffect(() => {
    console.log("[useRequireAuth] Effect triggered:", { isLoading, isHydrated, isAuthenticated });
    
    // AGUARDAR hidratação antes de decidir
    if (!isHydrated) {
      console.log("[useRequireAuth] Aguardando hidratação...");
      return;  // ← NÃO redireciona enquanto não hidratar
    }
    
    if (isLoading) {
      console.log("[useRequireAuth] Aguardando loading...");
      return;
    }
    
    if (!isAuthenticated) {
      console.log("[useRequireAuth] REDIRECIONANDO para /login!");
      router.push("/login");
    } else {
      console.log("[useRequireAuth] Usuário autenticado, sem redirect");
    }
  }, [isAuthenticated, isHydrated, isLoading, router]);
  
  return { isAuthenticated, isHydrated, isLoading };
}

/**
 * Hook para redirecionar se já autenticado
 * Útil na página de login
 * 
 * CORREÇÃO: Aguarda hidratação antes de decidir
 */
export function useRedirectIfAuthenticated(redirectTo: string = "/chat") {
  const isAuthenticated = useIsAuthenticated();
  const isHydrated = useIsHydrated();
  const isLoading = useAuthLoading();
  const router = useRouter();
  
  useEffect(() => {
    // Aguardar hidratação
    if (!isHydrated || isLoading) return;
    
    if (isAuthenticated) {
      console.log("[useRedirectIfAuthenticated] Usuário já autenticado, redirecionando para", redirectTo);
      router.push(redirectTo);
    }
  }, [isAuthenticated, isHydrated, isLoading, router, redirectTo]);
  
  return { isAuthenticated, isHydrated, isLoading };
}

/**
 * Hook de inicialização para garantir hidratação
 * Usar no layout raiz ou página de login
 */
export function useAuthInit() {
  const isHydrated = useIsHydrated();
  const hydrate = useAuthStore(state => state.hydrate);
  
  useEffect(() => {
    if (!isHydrated && typeof window !== "undefined") {
      console.log("[useAuthInit] Forçando hidratação...");
      hydrate();
    }
  }, [isHydrated, hydrate]);
  
  return { isHydrated };
}
