import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

const PERMS = [
  { key: "sessions", label: "Manage Sessions" },
  { key: "billing", label: "Bill / Checkout" },
  { key: "reports", label: "View Reports" },
  { key: "inventory", label: "Manage Inventory" },
];

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", name: "", permissions: ["sessions", "billing"] });

  const load = async () => { try { const { data } = await api.get("/staff"); setStaff(data); } catch (e) { toast.error(formatApiError(e)); } };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ email: "", password: "", name: "", permissions: ["sessions","billing"] }); setOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, permissions: u.permissions || [], email: u.email, password: "", is_active: u.is_active }); setOpen(true); };

  const togglePerm = (k) => setForm(f => ({ ...f, permissions: f.permissions.includes(k) ? f.permissions.filter(p => p !== k) : [...f.permissions, k] }));

  const save = async () => {
    try {
      if (editing) {
        const payload = { name: form.name, permissions: form.permissions, is_active: form.is_active };
        if (form.password) payload.new_password = form.password;
        await api.put(`/staff/${editing.id}`, payload);
      } else {
        if (!form.email || !form.password) return toast.error("Email & password required");
        await api.post("/staff", { name: form.name, email: form.email, password: form.password, permissions: form.permissions });
      }
      setOpen(false); load(); toast.success("Saved");
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const remove = async (id) => { try { await api.delete(`/staff/${id}`); load(); } catch (e) { toast.error(formatApiError(e)); } };

  return (
    <div className="space-y-6" data-testid="staff-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Cafe</div>
          <h1 className="text-4xl font-display font-extrabold">Staff</h1>
          <p className="text-muted-foreground mt-2">Operators with section-level permissions.</p>
        </div>
        <Button onClick={openNew} data-testid="staff-new-btn"><Plus size={18}/> Add Operator</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.map(u => (
          <Card key={u.id} className="hover-lift" data-testid={`staff-${u.id}`}>
            <CardHeader>
              <CardTitle className="font-display flex justify-between items-start">
                <span>{u.name}</span>
                <span className={`text-[0.65rem] uppercase tracking-widest font-bold ${u.is_active ? "text-emerald-500" : "text-destructive"}`}>{u.is_active ? "Active" : "Disabled"}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">{u.email}</div>
              <div className="flex flex-wrap gap-1 mt-3">
                {(u.permissions || []).map(p => <span key={p} className="text-[0.65rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-secondary text-secondary-foreground">{p}</span>)}
              </div>
              <div className="flex justify-end gap-1 mt-3">
                <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><PencilSimple size={16}/></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(u.id)}><Trash size={16}/></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {staff.length === 0 && <p className="text-muted-foreground col-span-full">No operators yet.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Operator" : "New Operator"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="staff-name-input"/></div>
            <div><Label>Email</Label><Input type="email" value={form.email} disabled={!!editing} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="staff-email-input"/></div>
            <div><Label>{editing ? "New Password (leave blank to keep)" : "Password"}</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} data-testid="staff-password-input"/></div>
            {editing && (
              <div className="flex items-center gap-2">
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} data-testid="staff-active-switch"/>
                <Label>Account active</Label>
              </div>
            )}
            <div>
              <Label className="mb-2 block">Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {PERMS.map(p => (
                  <label key={p.key} className="flex items-center gap-2 border border-border rounded-md p-2 cursor-pointer">
                    <Checkbox checked={form.permissions.includes(p.key)} onCheckedChange={() => togglePerm(p.key)} data-testid={`staff-perm-${p.key}`}/>
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="staff-save-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
