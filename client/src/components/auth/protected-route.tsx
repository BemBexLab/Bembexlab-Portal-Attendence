"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { useCurrentUser } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

type ProtectedRouteProps = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const currentUser = useCurrentUser();

  useEffect(() => {
    if (currentUser.isError) {
      clearAuth();
      router.replace("/login");
    }
  }, [clearAuth, currentUser.isError, router]);

  if (currentUser.isLoading || currentUser.isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </main>
    );
  }

  return <>{children}</>;
}
