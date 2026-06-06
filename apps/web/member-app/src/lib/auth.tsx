"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Member } from "@osaja/types";
import { apiFetch, setToken, getToken } from "./api";
import { mapMember } from "./types";

interface AuthState {
  member: Member | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
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
      setMember(res.data ? mapMember(res.data) : null);
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

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ member: Record<string, unknown>; token: { access_token: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.data?.token.access_token ?? null);
    setMember(res.data?.member ? mapMember(res.data.member) : null);
  };

  const register = async (data: Record<string, unknown>) => {
    const res = await apiFetch<{ member: Record<string, unknown>; token: { access_token: string } }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setToken(res.data?.token.access_token ?? null);
    setMember(res.data?.member ? mapMember(res.data.member) : null);
  };

  const logout = () => {
    setToken(null);
    setMember(null);
  };

  return (
    <AuthContext.Provider value={{ member, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
