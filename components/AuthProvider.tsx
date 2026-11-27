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
  email_verified?: boolean;
}

export function isOfficialRole(role?: string | null): boolean {
  if (!role || typeof role !== "string") return false;
  const normalized = role.trim().toLowerCase();
  return normalized !== "" && normalized !== "student" && normalized !== "guest";
}

export function isSuperAdminRole(role?: string | null): boolean {
  if (!role || typeof role !== "string") return false;
  return role.trim().toLowerCase() === "sk chairperson";
}

export function isTreasuryRole(role?: string | null): boolean {
  if (!role || typeof role !== "string") return false;
  const normalized = role.trim().toLowerCase();
  return normalized === "sk chairperson" || normalized === "sk treasurer";
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

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const entry of cookies) {
    const eq = entry.indexOf("=");
    if (eq === -1) continue;
    if (entry.slice(0, eq) === name) {
      try {
        return decodeURIComponent(entry.slice(eq + 1));
      } catch {
        return entry.slice(eq + 1);
      }
    }
  }
  return null;
}

function installGlobalCsrfInterceptor() {
  if (typeof window === "undefined") return;
  const win = window as unknown as {
    __skCsrfInstalled?: boolean;
    fetch: typeof window.fetch;
    XMLHttpRequest: typeof window.XMLHttpRequest;
  };
  if (win.__skCsrfInstalled) return;
  win.__skCsrfInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawMethod =
      init?.method || (input instanceof Request ? input.method : "GET");
    const method = rawMethod.toUpperCase();

    if (MUTATING_METHODS.has(method)) {
      let targetUrl: URL | null = null;
      try {
        const rawUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
            ? input.toString()
            : input.url;
        targetUrl = new URL(rawUrl, window.location.origin);
      } catch {
        targetUrl = null;
      }

      if (
        targetUrl &&
        targetUrl.origin === window.location.origin &&
        targetUrl.pathname.startsWith("/api/")
      ) {
        const csrfToken = readBrowserCookie("sk_csrf_token");
        if (csrfToken) {
          if (input instanceof Request && !init?.headers) {
            const headers = new Headers(input.headers);
            if (!headers.has("x-csrf-token")) {
              headers.set("x-csrf-token", csrfToken);
            }
            return originalFetch(new Request(input, { headers }), init);
          }
          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : undefined)
          );
          if (!headers.has("x-csrf-token")) {
            headers.set("x-csrf-token", csrfToken);
          }
          return originalFetch(input, { ...init, headers });
        }
      }
    }

    return originalFetch(input, init);
  };

  const XHRProto = window.XMLHttpRequest?.prototype as
    | (XMLHttpRequest & { __skMethod?: string; __skUrl?: string })
    | undefined;
  if (XHRProto) {
    const origOpen = XHRProto.open;
    const origSend = XHRProto.send;
    XHRProto.open = function (
      this: XMLHttpRequest & { __skMethod?: string; __skUrl?: string },
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      this.__skMethod = String(method || "GET").toUpperCase();
      this.__skUrl = String(url || "");
      return origOpen.call(this, method, url, async ?? true, username, password);
    };
    XHRProto.send = function (
      this: XMLHttpRequest & { __skMethod?: string; __skUrl?: string },
      body?: Document | XMLHttpRequestBodyInit | null
    ) {
      if (this.__skMethod && MUTATING_METHODS.has(this.__skMethod) && this.__skUrl) {
        try {
          const parsed = new URL(this.__skUrl, window.location.origin);
          if (
            parsed.origin === window.location.origin &&
            parsed.pathname.startsWith("/api/")
          ) {
            const csrfToken = readBrowserCookie("sk_csrf_token");
            if (csrfToken) {
              this.setRequestHeader("x-csrf-token", csrfToken);
            }
          }
        } catch {
          // ignore
        }
      }
      return origSend.call(this, body);
    };
  }
}

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
    installGlobalCsrfInterceptor();
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
      // Unbind & remove browser Web Push subscription on logout so shared devices do not receive the previous user's alerts
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          const subscription = registration
            ? await registration.pushManager.getSubscription()
            : null;
          if (subscription) {
            const endpoint = subscription.endpoint;
            await fetch("/api/notifications/subscribe", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint }),
            }).catch(() => {});
            await subscription.unsubscribe().catch(() => {});
          }
        } catch {
          // ignore push cleanup failures on logout
        }
      }
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
