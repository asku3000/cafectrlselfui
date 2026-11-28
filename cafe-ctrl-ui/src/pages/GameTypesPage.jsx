import React, { useState } from "react";
import { useLoadStatus } from "../lib/async/useAsyncData";
import PageState from "../components/async/PageState";
import DeleteButton from "../components/async/DeleteButton";
import AsyncForm, { SubmitButton } from "../components/async/AsyncForm";
import { api, deleteIfExists, withIdempotency } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Plus } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function GameTypesPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");

  const fetchPage = async () => {
    const { data } = await api.get("/game-types"); setItems(data);
  };
  const { reload: load, ...status } = useLoadStatus(fetchPage);

  const add = async ({ idempotencyKey }) => {
    if (!name.trim()) return;
    await api.post("/game-types", { name }, withIdempotency(idempotencyKey));
    setName(""); load(); toast.success("Added");
  };
  const remove = async (it, idempotencyKey) => {
    const deleted = await deleteIfExists(`/game-types/${it.id}`, withIdempotency(idempotencyKey));
    load();
    toast.success(deleted ? "Removed" : `${it.name} was already removed`);
  };

  const presets = ["Pool", "PS5", "Xbox", "Air Hockey", "Foosball", "Snooker"].filter(p => !items.some(i => i.name.toLowerCase() === p.toLowerCase()));

  return (
    <div className="space-y-6" data-testid="gametypes-root">
      <div>
        <div className="uppercase-label">Setup</div>
        <h1 className="text-4xl font-display font-extrabold">Game Types</h1>
        <p className="text-muted-foreground mt-2">Define the kinds of games your cafe offers.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display">Add new</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {presets.map(p => (
              <Button key={p} size="sm" variant="outline" onClick={() => setName(p)} data-testid={`preset-${p}`}>{p}</Button>
            ))}
          </div>
          <AsyncForm onSubmit={add} lockKey="gametype-add" idempotent className="flex gap-2">
            <Input placeholder="Game type (e.g. Snooker)" value={name} onChange={e => setName(e.target.value)} data-testid="gametype-input"/>
            <SubmitButton data-testid="gametype-add-btn"><Plus size={16}/> Add</SubmitButton>
          </AsyncForm>
        </CardContent>
      </Card>
      <PageState loading={status.loading} error={status.error} data={status.loaded ? items : undefined} onRetry={load} emptyText="No game types yet." skeletonRows={3}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(it => (
          <Card key={it.id} className="hover-lift" data-testid={`gametype-${it.id}`}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{it.name}</div>
              </div>
              <DeleteButton what={`game type ${it.name}`} size={18} lockKey={`gametype:${it.id}`} onDelete={({ idempotencyKey }) => remove(it, idempotencyKey)} testId={`gametype-delete-${it.id}`} />
            </CardContent>
          </Card>
        ))}
      </div>
      </PageState>
    </div>
  );
}
