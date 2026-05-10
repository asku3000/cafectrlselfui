import React, { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiError } from "../lib/apiClient";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cafe, setCafe] = useState(null);
  const [loading, setLoading] = useState(true);

  // This intercepts any changes to your user state
  const setTrackedUser = (newVal) => {
    if (newVal === null && user !== null) {
      // If something tries to wipe an active session, print the culprit!
      console.warn("🚨 [TRAP] SOMETHING JUST WIPED THE USER STATE TO NULL!");
      console.trace("Here is the exact file and line that caused it:");
    }
    setUser(newVal);
  };

  const refresh = async () => {
    // 1. Immediately check for the token BEFORE doing anything
    const token = localStorage.getItem("gb_token");
    
    if (!token) {
      console.log("🛑 [AUTH] No token found in storage. Skipping /me check.");
      setTrackedUser(null); // ✅ Fixed: Using trap
      setCafe(null);
      setLoading(false);
      return; 
    }

    try {
      console.log("🔄 [AUTH] Token found! Verifying session with /me...");
      const { data } = await api.get("/auth/me");
      
      const fetchedUser = data.user ? data.user : data;
      setTrackedUser(fetchedUser); // ✅ Fixed: Using trap
      setCafe(data.cafe || fetchedUser.cafe || null);
      
    } catch (err) {
      console.error("❌ [AUTH] /me verification failed:", err.response?.status);
      
      // 2. THE FIX: Only wipe the user if the server EXPLICITLY rejects our token (401)
      if (err.response?.status === 401) {
        console.warn("🗑️ [AUTH] Token is invalid or expired. Wiping session.");
        localStorage.removeItem("gb_token");
        setTrackedUser(null); // ✅ Fixed: Using trap
        setCafe(null);
      } else {
        console.warn("⚠️ [AUTH] /me failed, but keeping session active just in case.");
      }
      
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, []);

  const login = async (email, password) => {
    console.log("🚀 [AUTH] Logging in...");
    const { data } = await api.post("/auth/login", { email, password });
    
    console.log("📦 [AUTH] Login Response:", data);

    // EXACT match to your JSON response
    if (data.access_token) {
      console.log("🔑 [AUTH] Token received! Saving to localStorage...");
      localStorage.setItem("gb_token", data.access_token);
      
      // Inject token directly into Axios for the very next call
      api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
    } else {
      console.error("🚨 [AUTH] No access_token found in login response!");
    }

    const loggedInUser = data.user;
    setTrackedUser(loggedInUser); // Trap is here
    setCafe(data.cafe || null);
    
    // We don't need to call refresh() here anymore because we just set the exact user data!
    return loggedInUser; 
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("gb_token");
    delete api.defaults.headers.common['Authorization'];
    setTrackedUser(null); // Trap is here
    setCafe(null);
  };

  return (
    <AuthCtx.Provider value={{ user, cafe, loading, login, signup: () => {}, logout, refresh, setCafe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
export { formatApiError };