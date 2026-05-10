import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, formatApiError } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { Lightning } from "@phosphor-icons/react";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    cafe_name: "", phone: "", address: "",
  });
  const [busy, setBusy] = useState(false);
  const onChange = (k) => (e) => setForm(s => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signup(form);
      toast.success("Account created!");
      navigate("/setup");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-2xl border-border">
        <CardContent className="pt-8">
          <div className="flex items-center gap-2 mb-6">
            <Lightning size={22} weight="fill" className="text-primary" />
            <span className="font-display font-extrabold text-xl">CafeCtrl</span>
          </div>
          <div className="uppercase-label mb-2">Get started</div>
          <h2 className="text-3xl font-display font-bold mb-6">Create your cafe account</h2>
          <GoogleSignInButton label="Continue with Google" data-testid="signup-google-btn" />
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-3 uppercase tracking-widest text-muted-foreground font-bold">or with email</span>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Your Name</Label>
                <Input value={form.name} onChange={onChange("name")} required data-testid="signup-name-input"/>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={onChange("email")} required data-testid="signup-email-input"/>
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={onChange("password")} required data-testid="signup-password-input" minLength={6}/>
              </div>
              <div>
                <Label>Cafe Name</Label>
                <Input value={form.cafe_name} onChange={onChange("cafe_name")} required data-testid="signup-cafe-input"/>
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={onChange("phone")} data-testid="signup-phone-input"/>
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Textarea value={form.address} onChange={onChange("address")} data-testid="signup-address-input"/>
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full" data-testid="signup-submit-btn">
              {busy ? "Creating..." : "Create Account"}
            </Button>
          </form>
          <div className="mt-6 text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline" data-testid="goto-login-link">Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
