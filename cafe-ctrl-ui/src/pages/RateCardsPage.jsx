import React, { useEffect, useState } from "react";
import { api, formatApiError, fmtMoney } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash, PencilSimple, Copy, UsersThree, X } from "@phosphor-icons/react";

const DAYS = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

// Build a prices dict ({"1": x, "2": y}) from either:
//  - new shape: it.prices already a dict
//  - legacy {duration, price} (single price treated as price for the lowest player_count)
//  - bare number (same)
function pricesFromAny(it, playerCounts) {
  const out = {};
  if (it && typeof it === "object" && it.prices && typeof it.prices === "object") {
    playerCounts.forEach((pc) => {
      const v = it.prices[String(pc)] ?? it.prices[pc];
      out[String(pc)] = Number(v ?? 0) || 0;
    });
    return out;
  }
  const legacyPrice = (it && typeof it === "object" && "price" in it) ? Number(it.price) || 0 : Number(it ?? 0) || 0;
  playerCounts.forEach((pc, i) => {
    out[String(pc)] = i === 0 ? legacyPrice : 0;
  });
  return out;
}

// Normalize any shape into [{duration, prices: {<pc>: number}}, ...]
function toSlabObjs(v, defaultDuration = 30, playerCounts = [1]) {
  if (Array.isArray(v)) {
    if (!v.length) return [{ duration: defaultDuration, prices: pricesFromAny({}, playerCounts) }];
    return v.map((it) => ({
      duration: Number(it?.duration) || defaultDuration,
      prices: pricesFromAny(it, playerCounts),
    }));
  }
  return [{ duration: defaultDuration, prices: pricesFromAny(v, playerCounts) }];
}

// Infer which player_counts an existing card has from its first slab (for editing legacy cards)
function inferPlayerCounts(card) {
  const arr = Array.isArray(card?.player_counts) ? card.player_counts.filter((n) => Number.isFinite(Number(n))).map(Number) : [];
  if (arr.length) return Array.from(new Set(arr)).sort((a, b) => a - b);
  // try first slab's prices keys
  for (const day of DAYS) {
    const slabs = card?.weekday_prices?.[day.key];
    if (Array.isArray(slabs) && slabs[0] && typeof slabs[0] === "object" && slabs[0].prices && typeof slabs[0].prices === "object") {
      const keys = Object.keys(slabs[0].prices).map((k) => parseInt(k, 10)).filter((n) => Number.isFinite(n));
      if (keys.length) return Array.from(new Set(keys)).sort((a, b) => a - b);
    }
  }
  return [1];
}

export default function RateCardsPage() {
  const [cards, setCards] = useState([]);
  const [gameTypes, setGameTypes] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [accessories, setAccessories] = useState([]);
  const [accForm, setAccForm] = useState({ name: "", price: "" });

  function emptyForm() {
    const pcs = [1];
    return {
      name: "", game_type_id: "", billing_interval_minutes: 30, grace_minutes: 5,
      player_counts: pcs,
      weekday_prices: Object.fromEntries(DAYS.map((d) => [d.key, [{ duration: 30, prices: pricesFromAny({}, pcs) }]])),
    };
  }

  const load = async () => {
    try {
      const [c, g, a] = await Promise.all([api.get("/rate-cards"), api.get("/game-types"), api.get("/accessories")]);
      setCards(c.data); setGameTypes(g.data); setAccessories(a.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (c) => {
    setEditing(c);
    const interval = c.billing_interval_minutes || 30;
    const pcs = inferPlayerCounts(c);
    setForm({
      ...c,
      player_counts: pcs,
      weekday_prices: Object.fromEntries(DAYS.map((d) => [d.key, toSlabObjs(c.weekday_prices?.[d.key], interval, pcs)])),
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (!form.game_type_id) return toast.error("Select a game type");
      if (!form.player_counts.length) return toast.error("Add at least one player count");
      const pcs = form.player_counts;
      const payload = {
        name: form.name,
        game_type_id: form.game_type_id,
        billing_interval_minutes: Number(form.billing_interval_minutes),
        grace_minutes: Number(form.grace_minutes),
        player_counts: pcs.map((n) => Number(n)),
        weekday_prices: Object.fromEntries(
          Object.entries(form.weekday_prices).map(([k, arr]) => [
            k,
            (arr || []).map((s) => ({
              duration: Number(s.duration) || 0,
              prices: Object.fromEntries(pcs.map((pc) => [String(pc), Number(s.prices?.[String(pc)]) || 0])),
            })),
          ])
        ),
      };
      if (editing) await api.put(`/rate-cards/${editing.id}`, payload);
      else await api.post("/rate-cards", payload);
      setOpen(false); load(); toast.success("Saved");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    try { await api.delete(`/rate-cards/${id}`); load(); toast.success("Deleted"); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const updateSlabDuration = (day, idx, val) => {
    setForm((f) => ({
      ...f,
      weekday_prices: {
        ...f.weekday_prices,
        [day]: f.weekday_prices[day].map((s, i) => (i === idx ? { ...s, duration: val } : s)),
      },
    }));
  };
  const updateSlabPrice = (day, idx, pc, val) => {
    setForm((f) => ({
      ...f,
      weekday_prices: {
        ...f.weekday_prices,
        [day]: f.weekday_prices[day].map((s, i) =>
          i === idx ? { ...s, prices: { ...s.prices, [String(pc)]: val } } : s
        ),
      },
    }));
  };
  const addSlab = (day) => {
    setForm((f) => ({
      ...f,
      weekday_prices: {
        ...f.weekday_prices,
        [day]: [...(f.weekday_prices[day] || []), { duration: 30, prices: pricesFromAny({}, f.player_counts) }],
      },
    }));
  };
  const removeSlab = (day, idx) => {
    setForm((f) => {
      const arr = (f.weekday_prices[day] || []).filter((_, i) => i !== idx);
      return {
        ...f,
        weekday_prices: {
          ...f.weekday_prices,
          [day]: arr.length ? arr : [{ duration: 30, prices: pricesFromAny({}, f.player_counts) }],
        },
      };
    });
  };
  const copyDayToWeekdays = (day) => {
    const arr = JSON.parse(JSON.stringify(form.weekday_prices[day] || []));
    setForm((f) => ({
      ...f,
      weekday_prices: { ...f.weekday_prices, mon: arr, tue: arr, wed: arr, thu: arr, fri: arr },
    }));
    toast(`Copied ${day.toUpperCase()} to weekdays`);
  };
  const copyDayToAll = (day) => {
    const arr = JSON.parse(JSON.stringify(form.weekday_prices[day] || []));
    setForm((f) => ({
      ...f,
      weekday_prices: Object.fromEntries(DAYS.map((d) => [d.key, JSON.parse(JSON.stringify(arr))])),
    }));
    toast(`Copied ${day.toUpperCase()} to all 7 days`);
  };

  // Player-count helpers
  const addPlayerCount = () => {
    setForm((f) => {
      const existing = f.player_counts.map(Number);
      const next = (Math.max(0, ...existing) || 0) + 1;
      if (existing.includes(next)) return f;
      const newPCs = [...existing, next].sort((a, b) => a - b);
      const newWP = Object.fromEntries(
        Object.entries(f.weekday_prices).map(([k, arr]) => [
          k,
          (arr || []).map((s) => ({ ...s, prices: { ...s.prices, [String(next)]: 0 } })),
        ])
      );
      return { ...f, player_counts: newPCs, weekday_prices: newWP };
    });
  };
  const removePlayerCount = (pc) => {
    setForm((f) => {
      if (f.player_counts.length <= 1) {
        toast.error("Keep at least one player level");
        return f;
      }
      const newPCs = f.player_counts.filter((x) => Number(x) !== Number(pc));
      const newWP = Object.fromEntries(
        Object.entries(f.weekday_prices).map(([k, arr]) => [
          k,
          (arr || []).map((s) => {
            const { [String(pc)]: _drop, ...rest } = s.prices || {};
            return { ...s, prices: rest };
          }),
        ])
      );
      return { ...f, player_counts: newPCs, weekday_prices: newWP };
    });
  };

  const addAccessory = async () => {
    if (!accForm.name || !accForm.price) return;
    try { await api.post("/accessories", { name: accForm.name, price: Number(accForm.price) });
      setAccForm({ name: "", price: "" }); load(); toast.success("Accessory added"); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const removeAccessory = async (id) => {
    try { await api.delete(`/accessories/${id}`); load(); } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="ratecards-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Setup</div>
          <h1 className="text-4xl font-display font-extrabold">Rate Cards</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Configure levels per day with their own duration and a price per <b>number of players</b>.
            Example for PS5: 1P 30m → ₹100, 1P 60m → ₹150, 2P 30m → ₹170, 2P 60m → ₹250.
            The bill engine picks the cheapest combination that covers total play time.
          </p>
        </div>
        <Button onClick={openNew} data-testid="ratecard-new-btn"><Plus size={18} weight="bold" /> New Rate Card</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cards.map((c) => {
          const gt = gameTypes.find((g) => g.id === c.game_type_id);
          const pcs = inferPlayerCounts(c);
          return (
            <Card key={c.id} className="hover-lift" data-testid={`ratecard-${c.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="uppercase-label">{gt?.name || "—"}</div>
                    <CardTitle className="font-display text-2xl">{c.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)} data-testid={`ratecard-edit-${c.id}`}><PencilSimple size={18} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash size={18} /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-3 flex items-center gap-2 flex-wrap">
                  <span>Billing every {c.billing_interval_minutes} min · {c.grace_minutes} min grace</span>
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-bold">
                    <UsersThree size={12} weight="fill"/> {pcs.join(" / ")} player{pcs.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {DAYS.map((d) => {
                    const slabs = toSlabObjs(c.weekday_prices?.[d.key], c.billing_interval_minutes, pcs);
                    return (
                      <div key={d.key} className="flex items-start gap-2 text-xs">
                        <span className="uppercase-label w-10 mt-1">{d.label}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {slabs.map((s, i) => (
                            <span key={i} className="bg-secondary/60 rounded px-2 py-0.5 font-mono">
                              {s.duration}m → {pcs.map((pc) => `${pc}p:${fmtMoney(s.prices[String(pc)] || 0)}`).join(" · ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {cards.length === 0 && <p className="text-muted-foreground col-span-full">No rate cards yet.</p>}
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Accessories (flat-priced add-ons)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Accessory name" value={accForm.name} onChange={(e) => setAccForm((s) => ({ ...s, name: e.target.value }))} className="max-w-xs" data-testid="acc-name-input" />
            <Input placeholder="Price" type="number" value={accForm.price} onChange={(e) => setAccForm((s) => ({ ...s, price: e.target.value }))} className="max-w-[120px]" data-testid="acc-price-input" />
            <Button onClick={addAccessory} data-testid="acc-add-btn">Add</Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {accessories.map((a) => (
              <div key={a.id} className="border border-border rounded-md p-3 flex justify-between items-center" data-testid={`acc-${a.id}`}>
                <div>
                  <div className="font-semibold">{a.name}</div>
                  <div className="font-mono text-sm">{fmtMoney(a.price)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeAccessory(a.id)}><Trash size={16} /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit" : "New"} Rate Card</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} data-testid="rc-name-input" />
              </div>
              <div>
                <Label>Game Type</Label>
                <Select value={form.game_type_id} onValueChange={(v) => setForm((f) => ({ ...f, game_type_id: v }))}>
                  <SelectTrigger data-testid="rc-gametype-select"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{gameTypes.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Billing Interval (min) <span className="text-xs text-muted-foreground">— smallest unit / fallback</span></Label>
                <Input type="number" value={form.billing_interval_minutes} onChange={(e) => setForm((f) => ({ ...f, billing_interval_minutes: e.target.value }))} data-testid="rc-interval-input" />
              </div>
              <div>
                <Label>Grace Minutes</Label>
                <Input type="number" value={form.grace_minutes} onChange={(e) => setForm((f) => ({ ...f, grace_minutes: e.target.value }))} data-testid="rc-grace-input" />
              </div>
            </div>

            <div className="border border-border rounded-md p-3 bg-secondary/30">
              <Label className="mb-2 flex items-center gap-2"><UsersThree size={16} weight="bold"/> Player counts (levels)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Operators pick the number of players when starting a session. Each level here will get its own price column below.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                {form.player_counts.map((pc) => (
                  <span key={pc} className="inline-flex items-center gap-1 bg-primary/15 text-primary rounded-full px-3 py-1 text-sm font-bold" data-testid={`rc-pc-chip-${pc}`}>
                    {pc} player{pc > 1 ? "s" : ""}
                    {form.player_counts.length > 1 && (
                      <button type="button" onClick={() => removePlayerCount(pc)} className="hover:bg-primary/20 rounded-full p-0.5" data-testid={`rc-pc-remove-${pc}`}>
                        <X size={12} weight="bold"/>
                      </button>
                    )}
                  </span>
                ))}
                <Button size="sm" variant="outline" onClick={addPlayerCount} data-testid="rc-pc-add">
                  <Plus size={12}/> Add player level
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Levels per day (duration → price per player count)</Label>
              <p className="text-xs text-muted-foreground mb-3">
                The bill engine picks the cheapest combination of these levels that covers the total play time for the chosen player count.
              </p>
              <div className="space-y-3">
                {DAYS.map((d) => {
                  const slabs = form.weekday_prices[d.key] || [];
                  return (
                    <div key={d.key} className="border border-border rounded-md p-3" data-testid={`rc-row-${d.key}`}>
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div className="uppercase-label">{d.label}</div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => copyDayToWeekdays(d.key)} title="Copy to Mon-Fri" data-testid={`rc-copy-week-${d.key}`}>
                            <Copy size={12} /> Wk
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyDayToAll(d.key)} title="Copy to all 7 days" data-testid={`rc-copy-all-${d.key}`}>
                            All
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {slabs.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 flex-wrap bg-secondary/40 rounded-md px-2 py-2">
                            <span className="text-[0.65rem] uppercase font-bold tracking-widest text-muted-foreground shrink-0">L{i + 1}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Input type="number" value={s.duration} onChange={(e) => updateSlabDuration(d.key, i, e.target.value)} className="w-20 h-8" data-testid={`rc-dur-${d.key}-${i}`} placeholder="min" />
                              <span className="text-[0.7rem] text-muted-foreground">min →</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {form.player_counts.map((pc) => (
                                <div key={pc} className="flex items-center gap-1">
                                  <span className="text-[0.65rem] uppercase font-bold tracking-widest text-muted-foreground">{pc}P</span>
                                  <Input
                                    type="number"
                                    value={s.prices?.[String(pc)] ?? 0}
                                    onChange={(e) => updateSlabPrice(d.key, i, pc, e.target.value)}
                                    className="w-20 h-8"
                                    placeholder="₹"
                                    data-testid={`rc-price-${d.key}-${i}-${pc}`}
                                  />
                                </div>
                              ))}
                            </div>
                            {slabs.length > 1 && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeSlab(d.key, i)} data-testid={`rc-rm-${d.key}-${i}`}>
                                <Trash size={12} />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => addSlab(d.key)} data-testid={`rc-add-${d.key}`}>
                          <Plus size={12} /> Level
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="rc-save-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}