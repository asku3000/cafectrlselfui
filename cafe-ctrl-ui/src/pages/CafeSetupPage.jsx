import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { formatApiError } from "../lib/apiClient";

export default function CafeSetupPage() {
  const { cafe, refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: cafe?.name || "",
    phone: cafe?.phone || "",
    address: cafe?.address || "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/cafe", { ...form, is_setup_complete: true });
      await refresh();
      toast.success("Cafe profile saved!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="uppercase-label">Step 1 of 1</div>
          <CardTitle className="text-3xl font-display">Set up your cafe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Cafe Name</Label>
            <Input value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} data-testid="setup-name"/>
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm(s => ({ ...s, phone: e.target.value }))} data-testid="setup-phone"/>
          </div>
          <div>
            <Label>Address</Label>
            <Textarea value={form.address} onChange={e => setForm(s => ({ ...s, address: e.target.value }))} data-testid="setup-address"/>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={save} disabled={busy} className="flex-1" data-testid="setup-save-btn">
              {busy ? "Saving..." : "Save & Continue"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Next, set up game types, rate cards, and resources from the dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
