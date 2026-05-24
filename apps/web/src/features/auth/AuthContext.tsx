"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/services/api";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  company_id?: number | null;
}

interface AuthCtx {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate session from stored token
  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiClient
      .get<AuthUser>("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("access_token");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await apiClient.post<{
        access_token: string;
        token_type: string;
        user: AuthUser;
      }>("/auth/login", { email, password });
      localStorage.setItem("access_token", r.data.access_token);
      setUser(r.data.user);
      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <Ctx.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
