import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "../lib/apiClient";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Lightning, ShieldCheck } from "@phosphor-icons/react";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match!");
    }
    if (!token) {
      return toast.error("Missing password reset verification token.");
    }

    setBusy(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, newPassword });
      toast.success(data.message || "Password updated successfully! Redirecting...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      toast.error(formatApiError(err) || "Failed to update security credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="flex items-center gap-2 mb-8">
        <Lightning size={28} weight="fill" className="text-primary" />
        <span className="font-display font-extrabold text-2xl tracking-tight">CafeCtrl</span>
      </div>
      
      <Card className="w-full max-w-md border-border">
        <CardContent className="pt-8">
          <div className="flex items-center gap-3 text-emerald-500 mb-2">
            <ShieldCheck size={24} weight="duotone" />
            <div className="uppercase-label">Identity Confirmed</div>
          </div>
          <h2 className="text-3xl font-display font-bold mb-6">Create New Password</h2>
          
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <Label htmlFor="new-pass">New Password</Label>
              <Input 
                id="new-pass" 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="confirm-pass">Confirm New Password</Label>
              <Input 
                id="confirm-pass" 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Updating account entries..." : "Reset Security Password"}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-xs">
            <Link to="/login" className="text-muted-foreground hover:text-primary underline">
              Return safely to Authorization portal
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}