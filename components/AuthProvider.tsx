"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  contact_number?: string;
  avatar_url?: string | null;
  auth_provider?: string;
  theme_preference?: string | null;
  accent_preference?: string | null;
}

export function isOfficialRole(role?: string | null): boolean {
  if (!role || typeof role !== "string") return false;
  const normalized = role.trim().toLowerCase();
  return normalized !== "" && normalized !== "student" && normalized !== "guest";
}

export type GuardedAction =
  | { type: "logout" }
  | { type: "navigate"; href: string };

export type NavigationGuard = (action: GuardedAction) => boolean;

interface AuthContextValue {
  user: AuthUser | null;
  authLoading: boolean;
  loggingOut: boolean;
  setUser: (user: AuthUser | null) => void;
  updateUserPreferences: (theme: string, accent: string) => void;
  refreshUser: () => Promise<AuthUser | null>;
  logout: (options?: { force?: boolean }) => Promise<boolean>;
  requestNavigation: (href: string, onProceed: () => void) => void;
  registerNavigationGuard: (guard: NavigationGuard) => () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const guardRef = useRef<NavigationGuard | null>(null);

  const setUser = useCallback((nextUser: AuthUser | null) => {
    setUserState(nextUser);
    setAuthLoading(false);
  }, []);

  const updateUserPreferences = useCallback((theme: string, accent: string) => {
    setUserState((prev) =>
      prev
        ? {
            ...prev,
            theme_preference: theme,
            accent_preference: accent,
          }
        : prev
    );
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const nextUser = data.authenticated && data.user ? (data.user as AuthUser) : null;
        setUserState(nextUser);
        return nextUser;
      }
      setUserState(null);
      return null;
    } catch {
      setUserState(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const registerNavigationGuard = useCallback((guard: NavigationGuard) => {
    guardRef.current = guard;
    return () => {
      if (guardRef.current === guard) {
        guardRef.current = null;
      }
    };
  }, []);

  const requestNavigation = useCallback((href: string, onProceed: () => void) => {
    if (guardRef.current && guardRef.current({ type: "navigate", href })) {
      return;
    }
    onProceed();
  }, []);

  const logout = useCallback(async (options?: { force?: boolean }): Promise<boolean> => {
    if (!options?.force && guardRef.current && guardRef.current({ type: "logout" })) {
      return false;
    }

    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUserState(null);
      return true;
    } catch {
      setUserState(null);
      return true;
    } finally {
      setLoggingOut(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        loggingOut,
        setUser,
        updateUserPreferences,
        refreshUser,
        logout,
        requestNavigation,
        registerNavigationGuard,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
