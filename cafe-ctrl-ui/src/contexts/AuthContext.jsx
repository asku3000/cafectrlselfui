import React, { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiError } from "../lib/apiClient";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cafe, setCafe] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setCafe(data.cafe);
    } catch {
      setUser(null);
      setCafe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // CRITICAL: If returning from Emergent OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.access_token) localStorage.setItem("gb_token", data.access_token);
    setUser(data.user);
    await refresh();
    return data.user;
  };

  const signup = async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    if (data.access_token) localStorage.setItem("gb_token", data.access_token);
    setUser(data.user);
    setCafe(data.cafe);
    await refresh();
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("gb_token");
    setUser(null);
    setCafe(null);
  };

  return (
    <AuthCtx.Provider value={{ user, cafe, loading, login, signup, logout, refresh, setCafe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
export { formatApiError };
