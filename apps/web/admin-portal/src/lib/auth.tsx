"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Member } from "@osaja/types";
import { apiFetch, getToken, setToken } from "./api";
import { EXECUTIVE_ROLES, isExecutiveRole, mapMember } from "./types";

interface AuthState {
  member: Member | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMember(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch<Record<string, unknown>>("/auth/me");
      const mapped = res.data ? mapMember(res.data) : null;
      if (!mapped || !isExecutiveRole(mapped.role)) {
        setToken(null);
        setMember(null);
        return;
      }
      setMember(mapped);
    } catch {
      setToken(null);
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (identifier: string, password: string) => {
    const res = await apiFetch<{ member: Record<string, unknown>; token: { access_token: string } }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      }
    );

    const mapped = res.data?.member ? mapMember(res.data.member) : null;
    if (!mapped || !isExecutiveRole(mapped.role)) {
      setToken(null);
      setMember(null);
      throw new Error(
        "This account does not have admin access. Ask an administrator to promote your role."
      );
    }

    setToken(res.data?.token.access_token ?? null);
    setMember(mapped);
  };

  const logout = () => {
    setToken(null);
    setMember(null);
  };

  return (
    <AuthContext.Provider value={{ member, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { EXECUTIVE_ROLES, isExecutiveRole };
