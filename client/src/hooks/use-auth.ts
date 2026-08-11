"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import axios from "axios";

import {
  getCurrentUser,
  login,
  logout,
} from "@/services/auth-service";
import { useAuthStore } from "@/stores/auth-store";
import type { LoginInput } from "@/types/auth";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export function useCurrentUser(enabled = true) {
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const response = await getCurrentUser();
      setUser(response.user);
      return response.user;
    },
    enabled,
    retry: (failureCount, error) =>
      axios.isAxiosError(error) &&
      (error.response?.status ?? 0) >= 500 &&
      failureCount < 2,
    staleTime: 60_000,
    throwOnError: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.isError) {
      clearAuth();
    }
  }, [clearAuth, query.isError]);

  return query;
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: async (response) => {
      setUser(response.user);
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation({
    mutationFn: logout,
    onSettled: async () => {
      clearAuth();
      await queryClient.removeQueries({ queryKey: authKeys.me });
    },
  });
}
