"use client";

import { useState, useCallback } from "react";
import { ToastType } from "@/components/ui/toast";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info", duration?: number) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      return addToast(message, type);
    },
    [addToast]
  );

  const success = useCallback(
    (message: string) => addToast(message, "success", 3000),
    [addToast]
  );

  const error = useCallback(
    (message: string) => addToast(message, "error", 8000),
    [addToast]
  );

  const warning = useCallback(
    (message: string) => addToast(message, "warning", 5000),
    [addToast]
  );

  const info = useCallback(
    (message: string) => addToast(message, "info", 5000),
    [addToast]
  );

  return {
    toasts,
    addToast,
    removeToast,
    toast,
    success,
    error,
    warning,
    info,
  };
}
