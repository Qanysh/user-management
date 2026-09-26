import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchMe, login as apiLogin, setToken } from "../api/client";
import type { Me, Membership } from "../types";

type AuthState = {
  me: Me | null;
  loading: boolean;
  error: string | null;
  activeOrgId: string | null;
  activeMembership: Membership | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setActiveOrgId: (id: string) => void;
  hasPermission: (code: string) => boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(
    () => localStorage.getItem("active_org_id"),
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMe();
      setMe(data);
      const stored = localStorage.getItem("active_org_id");
      const stillValid = data.memberships.some((m) => m.organization.id === stored);
      if (stillValid && stored) {
        setActiveOrgIdState(stored);
      } else if (data.memberships[0]) {
        const id = data.memberships[0].organization.id;
        setActiveOrgIdState(id);
        localStorage.setItem("active_org_id", id);
      } else {
        setActiveOrgIdState(null);
        localStorage.removeItem("active_org_id");
      }
    } catch {
      setMe(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    await apiLogin(email, password);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
    setActiveOrgIdState(null);
    localStorage.removeItem("active_org_id");
  }, []);

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id);
    localStorage.setItem("active_org_id", id);
  }, []);

  const activeMembership = useMemo(
    () => me?.memberships.find((m) => m.organization.id === activeOrgId) ?? null,
    [me, activeOrgId],
  );

  const hasPermission = useCallback(
    (code: string) => Boolean(activeMembership?.permissions.includes(code)),
    [activeMembership],
  );

  const value = useMemo(
    () => ({
      me,
      loading,
      error,
      activeOrgId,
      activeMembership,
      login,
      logout,
      setActiveOrgId,
      hasPermission,
      refresh,
    }),
    [
      me,
      loading,
      error,
      activeOrgId,
      activeMembership,
      login,
      logout,
      setActiveOrgId,
      hasPermission,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
