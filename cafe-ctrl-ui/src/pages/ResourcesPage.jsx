import React, { useState } from "react";
import { useLoadStatus } from "../lib/async/useAsyncData";
import PageState from "../components/async/PageState";
import { useLockHeld } from "../lib/async/actionLocks";
import DeleteButton from "../components/async/DeleteButton";
import AsyncForm, { SubmitButton } from "../components/async/AsyncForm";
import { api, deleteIfExists, withIdempotency } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function ResourcesPage() {
  const [rows, setRows] = useState([]);
  const [gts, setGts] = useState([]);
  const [rcs, setRcs] = useState([]);
  const [open, setOpen] = useState(false);
  const saving = useLockHeld("resource-save");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", game_type_id: "", rate_card_id: "" });

  const fetchPage = async () => {
    const [r, g, c] = await Promise.all([api.get("/resources"), api.get("/game-types"), api.get("/rate-cards")]);
    setRows(r.data); setGts(g.data); setRcs(c.data);
  };
  const { reload: load, ...status } = useLoadStatus(fetchPage);

  const openNew = () => { setEditing(null); setForm({ name: "", game_type_id: "", rate_card_id: "" }); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ name: r.name, game_type_id: r.game_type_id, rate_card_id: r.rate_card_id }); setOpen(true); };

  const save = async ({ idempotencyKey }) => {
    if (!form.game_type_id || !form.rate_card_id || !form.name) return toast.error("All fields required");
    if (editing) await api.put(`/resources/${editing.id}`, form, withIdempotency(idempotencyKey));
    else await api.post("/resources", form, withIdempotency(idempotencyKey));
    setOpen(false); load(); toast.success("Saved");
  };

  const remove = async (r, idempotencyKey) => {
    const deleted = await deleteIfExists(`/resources/${r.id}`, withIdempotency(idempotencyKey));
    load();
    toast.success(deleted ? "Deleted" : `${r.name} was already deleted`);
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

      <PageState loading={status.loading} error={status.error} data={status.loaded ? rows : undefined} onRetry={load} emptyText="No resources yet." skeletonRows={3}>
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
                    <DeleteButton what={r.name} size={18} lockKey={`resource:${r.id}`} onDelete={({ idempotencyKey }) => remove(r, idempotencyKey)} testId={`res-delete-${r.id}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      </PageState>

      <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit" : "New"} Resource</DialogTitle></DialogHeader>
          <AsyncForm onSubmit={save} lockKey="resource-save" idempotent className="grid gap-4">
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
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton data-testid="res-save-btn">Save</SubmitButton>
          </DialogFooter>
          </AsyncForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
