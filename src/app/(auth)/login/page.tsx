"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useRedirectIfAuthenticated, useAuthInit } from "@/hooks/use-auth";

export default function LoginPage() {
  const router = useRouter();
  
  // Garantir hidratação do auth store
  const { isHydrated } = useAuthInit();
  const { isLoading } = useRedirectIfAuthenticated();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <LoginForm
      onSuccess={() => {
        router.push("/chat");
      }}
    />
  );
}
