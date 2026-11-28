import React, { useState } from "react";
import AsyncForm, { SubmitButton } from "../components/async/AsyncForm";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api, withIdempotency } from "../lib/apiClient";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";

export default function CafeSetupPage() {
  const { cafe, refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: cafe?.name || "",
    phone: cafe?.phone || "",
    address: cafe?.address || "",
  });

  const save = async ({ idempotencyKey }) => {
    await api.put("/cafe", { ...form, is_setup_complete: true }, withIdempotency(idempotencyKey));
    await refresh();
    toast.success("Cafe profile saved!");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="uppercase-label">Step 1 of 1</div>
          <CardTitle className="text-3xl font-display">Set up your cafe</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncForm onSubmit={save} lockKey="cafe-save" idempotent className="space-y-4">
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
            <SubmitButton className="flex-1" data-testid="setup-save-btn">Save &amp; Continue</SubmitButton>
          </div>
          <p className="text-sm text-muted-foreground">
            Next, set up game types, rate cards, and resources from the dashboard.
          </p>
          </AsyncForm>
        </CardContent>
      </Card>
    </div>
  );
}
