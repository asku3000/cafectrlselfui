import React from "react";
import { Button } from "./ui/button";
import { GoogleLogo } from "@phosphor-icons/react";

/**
 * Continue-with-Google button. Redirects to Emergent OAuth flow.
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
export default function GoogleSignInButton({ label = "Continue with Google", className = "", ...rest }) {
  const onClick = () => {
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={`w-full justify-center gap-2 ${className}`}
      data-testid={rest["data-testid"] || "google-signin-btn"}
    >
      <GoogleLogo size={18} weight="bold" />
      {label}
    </Button>
  );
}
