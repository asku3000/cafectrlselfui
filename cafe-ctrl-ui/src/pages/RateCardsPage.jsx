import React, { useEffect, useState } from "react";
import { api, formatApiError, fmtMoney } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash, PencilSimple, Copy } from "@phosphor-icons/react";

const DAYS = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

// Normalize any legacy or new shape into [{duration, price}, ...]
function toSlabObjs(v, defaultDuration = 30) {
  if (Array.isArray(v)) {
    if (!v.length) return [{ duration: defaultDuration, price: 0 }];
    return v.map((it) => {
      if (it && typeof it === "object") return { duration: Number(it.duration) || defaultDuration, price: Number(it.price) || 0 };
      return { duration: defaultDuration, price: Number(it) || 0 };
    });
  }
  if (v == null) return [{ duration: defaultDuration, price: 0 }];
  return [{ duration: defaultDuration, price: Number(v) || 0 }];
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
    return {
      name: "", game_type_id: "", billing_interval_minutes: 30, grace_minutes: 5,
      weekday_prices: Object.fromEntries(DAYS.map((d) => [d.key, [{ duration: 30, price: 0 }]])),
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
    setForm({
      ...c,
      weekday_prices: Object.fromEntries(DAYS.map((d) => [d.key, toSlabObjs(c.weekday_prices?.[d.key], interval)])),
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (!form.game_type_id) return toast.error("Select a game type");
      const payload = {
        ...form,
        billing_interval_minutes: Number(form.billing_interval_minutes),
        grace_minutes: Number(form.grace_minutes),
        weekday_prices: Object.fromEntries(
          Object.entries(form.weekday_prices).map(([k, arr]) => [
            k,
            (arr || [{ duration: 30, price: 0 }]).map((s) => ({
              duration: Number(s.duration) || 0,
              price: Number(s.price) || 0,
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

  const updateSlab = (day, idx, key, val) => {
    setForm((f) => ({
      ...f,
      weekday_prices: {
        ...f.weekday_prices,
        [day]: f.weekday_prices[day].map((s, i) => (i === idx ? { ...s, [key]: val } : s)),
      },
    }));
  };
  const addSlab = (day) => {
    setForm((f) => ({
      ...f,
      weekday_prices: { ...f.weekday_prices, [day]: [...(f.weekday_prices[day] || []), { duration: 30, price: 0 }] },
    }));
  };
  const removeSlab = (day, idx) => {
    setForm((f) => {
      const arr = (f.weekday_prices[day] || []).filter((_, i) => i !== idx);
      return { ...f, weekday_prices: { ...f.weekday_prices, [day]: arr.length ? arr : [{ duration: 30, price: 0 }] } };
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
            Add levels per day with their own duration and price (e.g. 30min ₹120, 60min ₹200).
            For a customer's total play time, the system greedily applies the largest level that fits,
            then smaller ones. Example: 1h 30m → 60min slab + 30min slab = ₹200 + ₹120 = <b>₹320</b>.
          </p>
        </div>
        <Button onClick={openNew} data-testid="ratecard-new-btn"><Plus size={18} weight="bold" /> New Rate Card</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cards.map((c) => {
          const gt = gameTypes.find((g) => g.id === c.game_type_id);
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
                <div className="text-sm text-muted-foreground mb-3">
                  Billing every {c.billing_interval_minutes} min · {c.grace_minutes} min grace
                </div>
                <div className="space-y-1.5">
                  {DAYS.map((d) => {
                    const slabs = toSlabObjs(c.weekday_prices?.[d.key], c.billing_interval_minutes);
                    return (
                      <div key={d.key} className="flex items-center gap-2 text-xs">
                        <span className="uppercase-label w-10">{d.label}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {slabs.map((s, i) => (
                            <span key={i} className="bg-secondary/60 rounded px-2 py-0.5 font-mono">
                              {s.duration}m → {fmtMoney(s.price)}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

            <div>
              <Label className="mb-2 block">Levels per day (duration → price)</Label>
              <p className="text-xs text-muted-foreground mb-3">
                For total play time, the system greedily picks the largest level that fits, then fills with smaller ones.
                If only a few minutes remain after the largest fits, the smallest level is added once (rounds up).
              </p>
              <div className="space-y-2">
                {DAYS.map((d) => {
                  const slabs = form.weekday_prices[d.key] || [];
                  return (
                    <div key={d.key} className="border border-border rounded-md p-3 flex flex-wrap items-center gap-2" data-testid={`rc-row-${d.key}`}>
                      <div className="w-12 uppercase-label">{d.label}</div>
                      <div className="flex flex-wrap gap-2 items-center flex-1 min-w-0">
                        {slabs.map((s, i) => (
                          <div key={i} className="flex items-center gap-1 bg-secondary/40 rounded-md px-2 py-1.5">
                            <span className="text-[0.65rem] uppercase font-bold tracking-widest text-muted-foreground">L{i + 1}</span>
                            <Input type="number" value={s.duration} onChange={(e) => updateSlab(d.key, i, "duration", e.target.value)} className="w-16 h-8" data-testid={`rc-dur-${d.key}-${i}`} placeholder="min" />
                            <span className="text-[0.7rem] text-muted-foreground">min →</span>
                            <Input type="number" value={s.price} onChange={(e) => updateSlab(d.key, i, "price", e.target.value)} className="w-20 h-8" data-testid={`rc-price-${d.key}-${i}`} placeholder="₹" />
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
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => copyDayToWeekdays(d.key)} title="Copy to Mon-Fri" data-testid={`rc-copy-week-${d.key}`}>
                          <Copy size={12} /> Wk
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyDayToAll(d.key)} title="Copy to all 7 days" data-testid={`rc-copy-all-${d.key}`}>
                          All
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
