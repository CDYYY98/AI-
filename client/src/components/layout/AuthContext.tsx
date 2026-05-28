import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "@/api/auth";
import * as authApi from "@/api/auth";
import { apiClient } from "@/api/client";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "ai_novel_token";

function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // noop
  }
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // noop
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: loadToken(),
    loading: true,
  });

  useEffect(() => {
    const token = loadToken();
    if (!token) {
      setState({ user: null, token: null, loading: false });
      return;
    }

    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    authApi.getMe()
      .then((res) => {
        if (res.success && res.data) {
          setState({ user: res.data, token, loading: false });
        } else {
          clearToken();
          setState({ user: null, token: null, loading: false });
        }
      })
      .catch(() => {
        clearToken();
        setState({ user: null, token: null, loading: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (!res.success || !res.data) {
      throw new Error(res.error ?? "登录失败");
    }
    saveToken(res.data.token);
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
    setState({ user: res.data.user, token: res.data.token, loading: false });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    delete apiClient.defaults.headers.common["Authorization"];
    setState({ user: null, token: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
