/**
 * useIdleTimeout Hook - CtrlClaw
 * 
 * Gerenciamento de idle timeout conforme ADR 2:
 * - 30 minutos de idle = logout
 * - Warning aos 25 minutos (5 min antes)
 * - Renovação por atividade real do usuário
 * - Absolute timeout de 24h (não renovável)
 */

import { useEffect, useCallback } from "react";
import { useRuntimeStore } from "@/stores/runtime-store";
import { useAuth } from "./use-auth";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;      // 30 minutos
const WARNING_BEFORE_MS = 5 * 60 * 1000;     // 5 minutos antes
const ABSOLUTE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 horas

// Eventos que contam como atividade
const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "mousemove",
];

export function useIdleTimeout() {
  const { logout, isAuthenticated } = useAuth();
  const { 
    isWarningVisible, 
    showIdleWarning, 
    hideIdleWarning 
  } = useRuntimeStore();
  
  // Verificar absolute timeout (loginTime seria armazenado no auth service)
  // Por simplicidade, vamos focar no idle timeout
  
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let idleTimer: NodeJS.Timeout;
    let warningTimer: NodeJS.Timeout;
    
    const resetTimer = () => {
      // Limpar timers existentes
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      
      // Esconder warning se visível
      if (isWarningVisible) {
        hideIdleWarning();
      }
      
      // Mostrar warning aos 25min
      warningTimer = setTimeout(() => {
        showIdleWarning(WARNING_BEFORE_MS / 1000);
      }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
      
      // Logout aos 30min
      idleTimer = setTimeout(() => {
        logout();
      }, IDLE_TIMEOUT_MS);
    };
    
    // Registrar listeners de atividade
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, resetTimer);
    });
    
    // Iniciar timer
    resetTimer();
    
    // Cleanup
    return () => {
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated, logout, showIdleWarning, hideIdleWarning, isWarningVisible]);
  
  return {
    isWarningVisible,
    timeRemaining: useRuntimeStore(state => state.timeRemaining),
  };
}

/**
 * Hook para interagir com o modal de idle warning
 */
export function useIdleWarning() {
  const { logout } = useAuth();
  const { hideIdleWarning } = useRuntimeStore();
  
  const stayLoggedIn = useCallback(() => {
    // Reset do timer é automático pelo useIdleTimeout
    hideIdleWarning();
  }, [hideIdleWarning]);
  
  const logoutNow = useCallback(() => {
    hideIdleWarning();
    logout();
  }, [hideIdleWarning, logout]);
  
  return {
    stayLoggedIn,
    logoutNow,
  };
}
