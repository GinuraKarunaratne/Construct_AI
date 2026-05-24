import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "@/services/api";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("access_token").then(async (token: string | null) => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await apiClient.get<AuthUser>("/auth/me");
        setUser(res.data);
      } catch {
        await AsyncStorage.removeItem("access_token");
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<{
      access_token: string;
      token_type: string;
      user: AuthUser;
    }>("/auth/login", { email, password });
    await AsyncStorage.setItem("access_token", res.data.access_token);
    setUser(res.data.user);
    router.replace("/(tabs)");
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("access_token");
    setUser(null);
    router.replace("/(auth)/login");
  }, []);

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
