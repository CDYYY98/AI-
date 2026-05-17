import type { ApiResponse } from "@ai-novel/shared/types/api";
import { apiClient } from "./client";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export async function register(payload: {
  username: string;
  email: string;
  password: string;
}) {
  const { data } = await apiClient.post<ApiResponse<AuthResult>>("/auth/register", payload);
  return data;
}

export async function login(payload: {
  email: string;
  password: string;
}) {
  const { data } = await apiClient.post<ApiResponse<AuthResult>>("/auth/login", payload);
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get<ApiResponse<AuthUser>>("/auth/me");
  return data;
}
