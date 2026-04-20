import React, { createContext, useContext, useEffect, useState } from "react";

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

function readStoredSession(): { status: AuthStatus; user: AuthUser | null } {
  if (typeof window === "undefined") {
    return { status: "unauthenticated", user: null };
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return { status: "unauthenticated", user: null };
    }

    const parsed = JSON.parse(raw) as { status?: AuthStatus; user?: AuthUser | null };
    const validStatus =
      parsed.status === "authenticated" || parsed.status === "needs_activation"
        ? parsed.status
        : "unauthenticated";
    const validUser =
      parsed.user && typeof parsed.user.email === "string" && typeof parsed.user.name === "string"
        ? parsed.user
        : null;

    if (validStatus === "unauthenticated" || !validUser) {
      return { status: "unauthenticated", user: null };
    }

    return { status: validStatus, user: validUser };
  } catch (error) {
    console.log("[AuthProvider] failed to read auth session:", error);
    return { status: "unauthenticated", user: null };
  }
}

const AuthContext = createContext<AuthContextType>({
  status: "unauthenticated",
  user: null,
  login: async () => ({ success: false }),
  activate: async () => ({ success: false }),
  logout: () => {},
});

// Mock users for demo
const MOCK_USERS = [
  { email: "admin@moni-hr.com", password: "admin123", name: "Admin", activated: true },
  { email: "new@moni-hr.com", password: "", name: "New User", activated: false },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() => readStoredSession().status);
  const [user, setUser] = useState<AuthUser | null>(() => readStoredSession().user);
  // Track activated accounts in memory
  const [activatedAccounts, setActivatedAccounts] = useState<Record<string, string>>({});

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
        })
      );
    } catch (error) {
      console.log("[AuthProvider] failed to persist auth session:", error);
    }
  }, [status, user]);

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    console.log("[AuthProvider] login attempt:", email);
    await new Promise((r) => setTimeout(r, 800));

    const found = MOCK_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found) {
      return { success: false, message: "邮箱不存在，请检查后重试" };
    }

    // Check if this account needs activation
    if (!found.activated && !activatedAccounts[email.toLowerCase()]) {
      setUser({ email: found.email, name: found.name });
      setStatus("needs_activation");
      return { success: true };
    }

    // Check password
    const expectedPassword = activatedAccounts[email.toLowerCase()] ?? found.password;
    if (password !== expectedPassword) {
      return { success: false, message: "密码错误，请重新输入" };
    }

    setUser({ email: found.email, name: found.name });
    setStatus("authenticated");
    return { success: true };
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

    setActivatedAccounts((prev) => ({ ...prev, [email.toLowerCase()]: password }));
    setStatus("authenticated");
    return { success: true };
  };

  const logout = () => {
    console.log("[AuthProvider] logout");
    setStatus("unauthenticated");
    setUser(null);
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
