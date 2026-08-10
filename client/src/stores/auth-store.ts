"use client";

import { create } from "zustand";

import type { AuthUser } from "@/types/auth";

type AuthStatus = "idle" | "authenticated" | "unauthenticated";

type AuthStore = {
  user: AuthUser | null;
  status: AuthStatus;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  status: "idle",
  setUser: (user) => set({ user, status: "authenticated" }),
  clearAuth: () => set({ user: null, status: "unauthenticated" }),
}));
