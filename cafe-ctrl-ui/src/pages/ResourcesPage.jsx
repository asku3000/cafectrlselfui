import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function ResourcesPage() {
  const [rows, setRows] = useState([]);
  const [gts, setGts] = useState([]);
  const [rcs, setRcs] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", game_type_id: "", rate_card_id: "" });

  const load = async () => {
    try {
      const [r, g, c] = await Promise.all([api.get("/resources"), api.get("/game-types"), api.get("/rate-cards")]);
      setRows(r.data); setGts(g.data); setRcs(c.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", game_type_id: "", rate_card_id: "" }); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ name: r.name, game_type_id: r.game_type_id, rate_card_id: r.rate_card_id }); setOpen(true); };

  const save = async () => {
    if (!form.game_type_id || !form.rate_card_id || !form.name) return toast.error("All fields required");
    try {
      if (editing) await api.put(`/resources/${editing.id}`, form);
      else await api.post("/resources", form);
      setOpen(false); load(); toast.success("Saved");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    try { await api.delete(`/resources/${id}`); load(); toast.success("Deleted"); } catch (e) { toast.error(formatApiError(e)); }
  };

  const filteredRcs = rcs.filter(rc => !form.game_type_id || rc.game_type_id === form.game_type_id);

  return (
    <div className="space-y-6" data-testid="resources-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Setup</div>
          <h1 className="text-4xl font-display font-extrabold">Resources</h1>
          <p className="text-muted-foreground mt-2">Map each pool table, console, etc. to a rate card.</p>
        </div>
        <Button onClick={openNew} data-testid="res-new-btn"><Plus size={18}/> Add Resource</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(r => {
          const gt = gts.find(g => g.id === r.game_type_id);
          const rc = rcs.find(c => c.id === r.rate_card_id);
          return (
            <Card key={r.id} className="hover-lift" data-testid={`res-${r.id}`}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="uppercase-label">{gt?.name}</div>
                    <div className="text-xl font-display font-bold">{r.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">Rate: {rc?.name}</div>
                    {r.active && <div className="mt-2 text-xs text-primary font-semibold uppercase tracking-widest">In Use • {r.active.customer_name}</div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><PencilSimple size={18}/></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash size={18}/></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-muted-foreground col-span-full">No resources yet.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit" : "New"} Resource</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input placeholder="Pool 1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="res-name-input"/>
            </div>
            <div>
              <Label>Game Type</Label>
              <Select value={form.game_type_id} onValueChange={v => setForm(f => ({ ...f, game_type_id: v, rate_card_id: "" }))}>
                <SelectTrigger data-testid="res-gametype-select"><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{gts.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rate Card</Label>
              <Select value={form.rate_card_id} onValueChange={v => setForm(f => ({ ...f, rate_card_id: v }))}>
                <SelectTrigger data-testid="res-ratecard-select"><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{filteredRcs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="res-save-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
