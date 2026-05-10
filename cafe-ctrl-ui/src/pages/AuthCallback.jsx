import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "../lib/apiClient";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Lightning } from "@phosphor-icons/react";

/**
 * AuthCallback — handles `#session_id=...` returning from Emergent OAuth.
 * Exchanges session_id for our app JWT via /api/auth/google.
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    const sessionId = m ? decodeURIComponent(m[1]) : null;
    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }
    (async () => {
      try {
        const { data } = await api.post("/auth/google", { session_id: sessionId });
        if (data.access_token) localStorage.setItem("gb_token", data.access_token);
        // Strip the fragment from URL
        window.history.replaceState({}, "", window.location.pathname);
        await refresh();
        toast.success(data.is_new ? `Welcome, ${data.user.name}! Set up your cafe.` : `Welcome back, ${data.user.name}!`);
        const role = data.user.role;
        if (role === "SUPER_ADMIN") navigate("/super-admin", { replace: true });
        else if (role === "CAFE_ADMIN") {
          if (data.cafe && !data.cafe.is_setup_complete) navigate("/setup", { replace: true });
          else navigate("/dashboard", { replace: true });
        } else {
          navigate("/sessions", { replace: true });
        }
      } catch (err) {
        toast.error(formatApiError(err));
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, refresh]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Lightning size={32} weight="fill" className="text-primary animate-pulse" />
      <p className="text-muted-foreground text-sm">Signing you in…</p>
    </div>
  );
}
