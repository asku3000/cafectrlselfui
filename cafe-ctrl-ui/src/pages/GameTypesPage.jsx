import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Trash, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function GameTypesPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");

  const load = async () => {
    try { const { data } = await api.get("/game-types"); setItems(data); } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    try { await api.post("/game-types", { name }); setName(""); load(); toast.success("Added"); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const remove = async (id) => {
    try { await api.delete(`/game-types/${id}`); load(); toast.success("Removed"); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const presets = ["Pool", "PS5", "Xbox", "Air Hockey", "Foosball"].filter(p => !items.some(i => i.name.toLowerCase() === p.toLowerCase()));

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
          <div className="flex gap-2">
            <Input placeholder="Game type (e.g. Snooker)" value={name} onChange={e => setName(e.target.value)} data-testid="gametype-input"/>
            <Button onClick={add} data-testid="gametype-add-btn"><Plus size={16}/> Add</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(it => (
          <Card key={it.id} className="hover-lift" data-testid={`gametype-${it.id}`}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{it.name}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(it.id)} data-testid={`gametype-delete-${it.id}`}>
                <Trash size={18}/>
              </Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-muted-foreground col-span-full">No game types yet.</p>}
      </div>
    </div>
  );
}
