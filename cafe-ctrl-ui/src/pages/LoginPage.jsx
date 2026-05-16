import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatApiError } from "../contexts/AuthContext";
import { api } from "../lib/apiClient"; 
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { toast } from "sonner";
import { Lightning, ArrowLeft } from "@phosphor-icons/react";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function LoginPage() {
  const { login, user } = useAuth(); 
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  // 1. Redirect Listener
  useEffect(() => {
    if (user) {
      console.log("🟢 [LOGIN PAGE] State synced! Redirecting safely...");
      const safeRole = user.role?.toUpperCase();
      
      if (safeRole === "SUPER_ADMIN") {
        navigate("/super-admin");
      } else if (safeRole === "CAFE_ADMIN") {
        navigate("/dashboard");
      } else {
        navigate("/sessions");
      }
    }
  }, [user, navigate]);

  // 2. Standard Login Form Handler
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      console.log("🎯 [LOGIN] User object returned:", u);
      toast.success(`Welcome, ${u.name}!`);
    } catch (err) {
      console.error("💥 [LOGIN ERROR]:", err);
      toast.error(formatApiError(err));
    } finally { 
      setBusy(false); 
    }
  };

  // 3. Forgot Password API Call Handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      if (data.devResetLink) {
        console.log("------------------------------------------------");
        console.log("🔑 [DEV ONLY] PASSWORD RESET LINK:");
        console.log(data.devResetLink);
        console.log("------------------------------------------------");
      }
      toast.success(data.message || "Recovery link generated in backend console!, Press F12 to view.");
      setForgotMode(false); // Switch back to login form input view
    } catch (err) {
      toast.error(formatApiError(err) || "Failed to process recovery request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary to-blue-700 p-10 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-white/15 backdrop-blur flex items-center justify-center">
            <Lightning size={22} weight="fill" />
          </div>
          <div className="font-display font-extrabold text-2xl">CafeCtrl</div>
        </div>
        <div>
          <div className="uppercase-label text-white/70 mb-3">For Gaming Cafes</div>
          <h1 className="text-4xl xl:text-5xl font-display font-extrabold leading-tight tracking-tight">
            Operate every minute.<br/>Bill every second.
          </h1>
          <p className="mt-5 text-white/80 max-w-md">
            Track live sessions, build rate cards, manage operators, and close
            bills with split payments — built for small gaming cafes.
          </p>
        </div>
        <div className="text-white/60 text-sm">© CafeCtrl</div>
      </div>
      
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border">
          <CardContent className="pt-8">
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <Lightning size={22} weight="fill" className="text-primary" />
              <span className="font-display font-extrabold text-xl">CafeCtrl</span>
            </div>

            {forgotMode ? (
              /* FORGOT PASSWORD FORM VIEW */
              <div>
                <button 
                  onClick={() => setForgotMode(false)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </button>
                <div className="uppercase-label mb-2">Account Recovery</div>
                <h2 className="text-3xl font-display font-bold mb-4">Admin Reset</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Enter your registered email address. If verified as a Cafe Administrator, a temporary secure reset link will generate in your backend terminal logs.
                </p>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <Label htmlFor="reset-email">Admin Email Address</Label>
                    <Input 
                      id="reset-email" 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Generating recovery token..." : "Generate Reset Link"}
                  </Button>
                </form>
              </div>
            ) : (
              /* STANDARD SIGN IN FORM VIEW */
              <div>
                <div className="uppercase-label mb-2">Sign in</div>
                <h2 className="text-3xl font-display font-bold mb-6">Welcome back</h2>
                <form onSubmit={submit} className="space-y-4" data-testid="login-form">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="login-email-input"/>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        onClick={() => setForgotMode(true)}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required data-testid="login-password-input"/>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy} data-testid="login-submit-btn">
                    {busy ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 uppercase tracking-widest text-muted-foreground font-bold">or</span>
                  </div>
                </div>
                <GoogleSignInButton label="Continue with Google" data-testid="login-google-btn" />
                <div className="mt-6 text-sm text-muted-foreground text-center">
                  New cafe owner?{" "}
                  <Link to="/signup" className="text-primary font-semibold hover:underline" data-testid="goto-signup-link">
                    Create your account
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}