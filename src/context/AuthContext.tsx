import React, { createContext, useContext, useEffect, useState } from "react";
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from "../lib/apiClient";
import { merchantApi } from "../lib/merchantApi";

export type AuthStatus = "unauthenticated" | "needs_activation" | "authenticated";

interface AuthUser {
  email: string;
  name: string;
}

interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  activate: (email: string, password: string, confirmPassword: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AUTH_STORAGE_KEY = "moni_hr_auth_session";

function readStoredSession(): { status: AuthStatus; user: AuthUser | null; activationToken: string } {
  if (typeof window === "undefined") {
    return { status: "unauthenticated", user: null, activationToken: "" };
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return { status: "unauthenticated", user: null, activationToken: "" };
    }

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
      return { status: "unauthenticated", user: null, activationToken: "" };
    }

    if (validStatus === "authenticated" && !getStoredAccessToken()) {
      return { status: "unauthenticated", user: null, activationToken: "" };
    }

    return { status: validStatus, user: validUser, activationToken: parsed.activationToken || "" };
  } catch (error) {
    console.log("[AuthProvider] failed to read auth session:", error);
    return { status: "unauthenticated", user: null, activationToken: "" };
  }
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

  console.log("[AuthProvider] status:", status, "user:", user);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (status === "unauthenticated" || !user) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          status,
          user,
          activationToken,
        })
      );
    } catch (error) {
      console.log("[AuthProvider] failed to persist auth session:", error);
    }
  }, [status, user, activationToken]);

  useEffect(() => {
    if (status !== "authenticated" || !getStoredAccessToken()) return;

    let cancelled = false;
    merchantApi.authMe()
      .then((principal) => {
        if (cancelled || !principal?.adminName) return;
        setUser((prev) => prev ? { ...prev, name: principal.adminName || prev.name } : prev);
      })
      .catch((error) => {
        console.log("[AuthProvider] failed to verify session:", error);
        if (cancelled) return;
        clearStoredAccessToken();
        setStatus("unauthenticated");
        setUser(null);
        setActivationToken("");
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    console.log("[AuthProvider] login attempt:", email);
    try {
      const result = await merchantApi.login(email, password);
      const nextUser = {
        email: result?.user?.email || email,
        name: result?.user?.name || email,
      };

      if (result?.status === "needs_activation") {
        clearStoredAccessToken();
        setUser(nextUser);
        setActivationToken(result.accessToken || "");
        setStatus("needs_activation");
        return { success: true };
      }

      if (!result?.accessToken) {
        return { success: false, message: "登录响应缺少访问令牌" };
      }

      setStoredAccessToken(result.accessToken);
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
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<{ success: boolean; message?: string }> => {
    console.log("[AuthProvider] activate:", email);
    await new Promise((r) => setTimeout(r, 800));

    if (password.length < 8) {
      return { success: false, message: "密码至少需要 8 位字符" };
    }
    if (password !== confirmPassword) {
      return { success: false, message: "两次输入的密码不一致" };
    }

    try {
      const urlToken = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") || "";
      const token = activationToken || urlToken;
      if (!token) {
        return { success: false, message: "缺少激活令牌，请使用激活链接重新进入" };
      }
      await merchantApi.activate(token, password);
      return await login(email, password);
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
