import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api, formatApiError } from "../lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";

export default function CafeProfilePage() {
  const { cafe, refresh } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  useEffect(() => { if (cafe) setForm({ name: cafe.name, phone: cafe.phone || "", address: cafe.address || "" }); }, [cafe]);
  const save = async () => {
    try { await api.put("/cafe", form); refresh(); toast.success("Saved"); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  return (
    <div className="max-w-2xl space-y-6" data-testid="cafe-profile-root">
      <div>
        <div className="uppercase-label">Cafe</div>
        <h1 className="text-4xl font-display font-extrabold">Profile</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="cafe-name-input"/></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} data-testid="cafe-phone-input"/></div>
          <div><Label>Address</Label><Textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} data-testid="cafe-address-input"/></div>
          <Button onClick={save} data-testid="cafe-save-btn">Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
