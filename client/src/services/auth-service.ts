import { api } from "@/lib/api";
import type { AuthResponse, LoginInput } from "@/types/auth";

export async function login(input: LoginInput) {
  const response = await api.post<AuthResponse>("/auth/login", input);
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get<AuthResponse>("/auth/me");
  return response.data;
}

export async function logout() {
  await api.post("/auth/logout");
}
