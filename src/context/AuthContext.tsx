import React, { createContext, useContext, useEffect, useState } from "react";
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  getStoredAccessTokenScope,
  setStoredAccessToken,
  subscribeAuthExpired,
  type TokenStorageScope,
} from "../lib/apiClient";
import { merchantApi } from "../lib/merchantApi";

export type AuthStatus = "checking" | "unauthenticated" | "needs_activation" | "authenticated";

interface AuthUser {
  email: string;
  name: string;
}

interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; message?: string }>;
  activate: (token: string, password: string, confirmPassword: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AUTH_STORAGE_KEY = "moni_hr_auth_session";

interface StoredSessionState {
  status: AuthStatus;
  user: AuthUser | null;
  activationToken: string;
  storageScope: TokenStorageScope;
}

function getAuthStorage(scope: TokenStorageScope) {
  return scope === "local" ? window.localStorage : window.sessionStorage;
}

function removeStoredAuthSessions() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function readStoredSession(): StoredSessionState {
  if (typeof window === "undefined") {
    return { status: "unauthenticated", user: null, activationToken: "", storageScope: "session" };
  }

  const accessTokenScope = getStoredAccessTokenScope();
  const storageScopes: TokenStorageScope[] = accessTokenScope === "session" ? ["session", "local"] : ["local", "session"];

  try {
    for (const storageScope of storageScopes) {
      const raw = getAuthStorage(storageScope).getItem(AUTH_STORAGE_KEY);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as { status?: AuthStatus; user?: AuthUser | null; activationToken?: string };
      const validStatus =
        parsed.status === "authenticated" || parsed.status === "needs_activation"
          ? parsed.status
          : "unauthenticated";
      const validUser =
        parsed.user && typeof parsed.user.email === "string" && typeof parsed.user.name === "string"
          ? parsed.user
          : null;

      if (validStatus === "unauthenticated" || !validUser) {
        continue;
      }

      if (validStatus === "authenticated" && accessTokenScope !== storageScope) {
        continue;
      }

      return {
        status: validStatus === "authenticated" ? "checking" : validStatus,
        user: validUser,
        activationToken: parsed.activationToken || "",
        storageScope,
      };
    }
  } catch (error) {
    console.log("[AuthProvider] failed to read auth session:", error);
  }

  return { status: "unauthenticated", user: null, activationToken: "", storageScope: "session" };
}

const AuthContext = createContext<AuthContextType>({
  status: "unauthenticated",
  user: null,
  login: async () => ({ success: false }),
  activate: async () => ({ success: false }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [storedSession] = useState(() => readStoredSession());
  const [status, setStatus] = useState<AuthStatus>(storedSession.status);
  const [user, setUser] = useState<AuthUser | null>(storedSession.user);
  const [activationToken, setActivationToken] = useState(storedSession.activationToken);
  const [storageScope, setStorageScope] = useState<TokenStorageScope>(storedSession.storageScope);

  console.log("[AuthProvider] status:", status, "user:", user);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (status === "checking") {
        return;
      }

      if (status === "unauthenticated" || !user) {
        removeStoredAuthSessions();
        clearStoredAccessToken();
        return;
      }

      const targetStorage = getAuthStorage(storageScope);
      const staleStorage = getAuthStorage(storageScope === "local" ? "session" : "local");
      targetStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          status,
          user,
          activationToken,
        })
      );
      staleStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.log("[AuthProvider] failed to persist auth session:", error);
    }
  }, [status, user, activationToken, storageScope]);

  useEffect(() => {
    return subscribeAuthExpired(() => {
      console.log("[AuthProvider] auth expired");
      setStatus("unauthenticated");
      setUser(null);
      setActivationToken("");
      setStorageScope("session");
    });
  }, []);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (status === "checking" && !token) {
      queueMicrotask(() => {
        setStatus("unauthenticated");
        setUser(null);
        setActivationToken("");
        setStorageScope("session");
      });
      return;
    }
    if (status !== "checking" && status !== "authenticated") return;
    if (!token) return;

    let cancelled = false;
    merchantApi.authMe()
      .then((principal) => {
        if (cancelled) return;
        if (principal?.adminName) {
          setUser((prev) => prev ? { ...prev, name: principal.adminName || prev.name } : prev);
        }
        setStatus("authenticated");
      })
      .catch((error) => {
        console.log("[AuthProvider] failed to verify session:", error);
        if (cancelled) return;
        clearStoredAccessToken();
        setStatus("unauthenticated");
        setUser(null);
        setActivationToken("");
        setStorageScope("session");
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const login = async (
    email: string,
    password: string,
    rememberMe = false
  ): Promise<{ success: boolean; message?: string }> => {
    console.log("[AuthProvider] login attempt:", email);
    try {
      const result = await merchantApi.login(email, password);
      const nextStorageScope: TokenStorageScope = rememberMe ? "local" : "session";
      const nextUser = {
        email: result?.user?.email || email,
        name: result?.user?.name || email,
      };

      if (result?.status === "needs_activation") {
        clearStoredAccessToken();
        setStorageScope(nextStorageScope);
        setUser(nextUser);
        setActivationToken(result.accessToken || "");
        setStatus("needs_activation");
        return { success: true };
      }

      if (!result?.accessToken) {
        return { success: false, message: "登录响应缺少访问令牌" };
      }

      setStoredAccessToken(result.accessToken, nextStorageScope);
      setStorageScope(nextStorageScope);
      setUser(nextUser);
      setActivationToken("");
      setStatus("authenticated");
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败，请检查邮箱和密码";
      return { success: false, message };
    }
  };

  const activate = async (
    token: string,
    password: string,
    confirmPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    console.log("[AuthProvider] activate with token:", Boolean(token));

    if (password.length < 8) {
      return { success: false, message: "密码至少需要 8 位字符" };
    }
    if (password !== confirmPassword) {
      return { success: false, message: "两次输入的密码不一致" };
    }

    try {
      const effectiveToken = token || activationToken;
      if (!effectiveToken) {
        return { success: false, message: "缺少激活令牌，请使用激活链接重新进入" };
      }
      await merchantApi.activate(effectiveToken, password);
      clearStoredAccessToken();
      setStatus("unauthenticated");
      setUser(null);
      setActivationToken("");
      setStorageScope("session");
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "激活失败，请重试";
      return { success: false, message };
    }
  };

  const logout = () => {
    console.log("[AuthProvider] logout");
    merchantApi.logout().catch((error) => {
      console.log("[AuthProvider] remote logout failed:", error);
    });
    clearStoredAccessToken();
    setStatus("unauthenticated");
    setUser(null);
    setActivationToken("");
    setStorageScope("session");
  };

  return (
    <AuthContext.Provider value={{ status, user, login, activate, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
