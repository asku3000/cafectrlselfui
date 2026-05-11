import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError, fmtMoney, fmtDateTime, fmtDuration, minutesBetween, toLocalInput, fromLocalInput } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Lightning, Plus, ArrowRight, BellSimple, BellSimpleSlash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { playChime, pushNotify, ensureNotificationPermission, ensureMutedFlag, setMuted } from "../lib/notifications";
import DateTimePicker from "../components/DateTimePicker";

export default function SessionsListPage() {
  const [resources, setResources] = useState([]);
  const [active, setActive] = useState([]);
  const [rateCards, setRateCards] = useState([]);
  const [openNew, setOpenNew] = useState(false);
  const [muted, setMutedState] = useState(ensureMutedFlag());
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", resource_id: "", player_count: 1, start_time: toLocalInput() });
  const notifiedRef = useRef(new Set());

  // Map resource_id -> rate card (for player_counts options)
  const rcByResource = (rid) => {
    const r = resources.find((x) => x.id === rid);
    if (!r) return null;
    return rateCards.find((c) => c.id === r.rate_card_id) || null;
  };
  const playerCountsFor = (rid) => {
    const rc = rcByResource(rid);
    const pcs = Array.isArray(rc?.player_counts) ? rc.player_counts.map(Number).filter((n) => Number.isFinite(n)) : [];
    return pcs.length ? Array.from(new Set(pcs)).sort((a, b) => a - b) : [1];
  };

  // Ask for browser-notification permission once
  useEffect(() => { ensureNotificationPermission(); }, []);

  const toggleMute = () => { const v = !muted; setMutedState(v); setMuted(v); toast(v ? "Reminders muted" : "Reminders on"); };

  const load = async () => {
    try {
      const [r, a, rc] = await Promise.all([api.get("/resources"), api.get("/sessions/active"), api.get("/rate-cards")]);
      setResources(r.data); setActive(a.data); setRateCards(rc.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  // soft notification at billing intervals
  useEffect(() => {
    const tick = setInterval(async () => {
      try {
        const rcsRes = await api.get("/rate-cards");
        const rcMap = Object.fromEntries(rcsRes.data.map(r => [r.id, r]));
        active.forEach(s => {
          s.games.filter(g => g.status === "active").forEach(g => {
            const rc = rcMap[g.rate_card_id];
            if (!rc) return;
            const interval = rc.billing_interval_minutes;
            const mins = minutesBetween(g.start_time, new Date());
            if (mins > 0 && mins % interval === 0) {
              const key = `${g.id}-${mins}`;
              if (!notifiedRef.current.has(key)) {
                notifiedRef.current.add(key);
                const title = `⏱ ${s.customer_name} — ${g.resource_name}`;
                const desc = `Reached ${mins} min · interval ${interval}m @ ${rc.name}`;
                toast(title, { description: desc });
                playChime();
                pushNotify(title, desc);
              }
            }
          });
        });
      } catch {}
    }, 30000);
    return () => clearInterval(tick);
  }, [active]);

  const openStart = (resource_id) => {
    const pcs = playerCountsFor(resource_id);
    setForm({ customer_name: "", customer_phone: "", resource_id, player_count: pcs[0] || 1, start_time: toLocalInput() });
    setOpenNew(true);
  };
  const start = async () => {
    try {
      if (!form.customer_name || !form.resource_id) return toast.error("Customer name & resource required");
      await api.post("/sessions", {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        resource_id: form.resource_id,
        player_count: Number(form.player_count) || 1,
        start_time: fromLocalInput(form.start_time),
      });
      setOpenNew(false); load(); toast.success("Session started");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="sessions-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Operations</div>
          <h1 className="text-4xl font-display font-extrabold">Live Sessions</h1>
          <p className="text-muted-foreground mt-2">Click an available resource to start a new entry.</p>
        </div>
        <Button variant="outline" onClick={toggleMute} data-testid="mute-toggle-btn">
          {muted ? <BellSimpleSlash size={16}/> : <BellSimple size={16}/>}
          {muted ? "Reminders muted" : "Reminders on"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Resources</CardTitle></CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources configured. Ask the admin to add resources.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {resources.map(r => (
                <button
                  key={r.id}
                  onClick={() => !r.active && openStart(r.id)}
                  className={`text-left rounded-md border p-4 transition-all ${r.active ? "border-primary bg-primary/10 ring-pulse" : "border-border hover:border-primary hover:bg-secondary"}`}
                  data-testid={`resource-${r.id}`}
                >
                  <div className="font-display font-bold text-lg">{r.name}</div>
                  {r.active ? (
                    <>
                      <div className="text-xs uppercase tracking-widest text-primary mt-1 font-bold">In Use</div>
                      <div className="text-sm mt-1 truncate">{r.active.customer_name}</div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">
                        {fmtDuration(minutesBetween(r.active.start_time, new Date()))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs uppercase tracking-widest text-emerald-500 mt-1 font-bold">Available</div>
                      <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Plus size={12}/> Tap to start</div>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Active customers</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <div className="space-y-2">
              {active.map(s => {
                const totalMins = s.games.reduce((acc, g) => acc + minutesBetween(g.start_time, g.end_time || new Date()), 0);
                return (
                  <Link to={`/sessions/${s.id}`} key={s.id} className="flex items-center justify-between border border-border hover:border-primary rounded-md p-3 transition-colors" data-testid={`active-${s.id}`}>
                    <div>
                      <div className="font-semibold">{s.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{s.customer_phone || "—"} · {s.games.length} game(s) · {fmtDuration(totalMins)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {s.games.map(g => `${g.resource_name}${g.status === "active" ? " ●" : ""}`).join(" · ")}
                      </div>
                    </div>
                    <ArrowRight size={20}/>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Start new session</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Customer Name</Label><Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} data-testid="new-cust-name"/></div>
            <div><Label>Phone</Label><Input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} data-testid="new-cust-phone"/></div>
            <div>
              <Label>Resource</Label>
              <Select value={form.resource_id} onValueChange={v => {
                const pcs = playerCountsFor(v);
                setForm(f => ({ ...f, resource_id: v, player_count: pcs[0] || 1 }));
              }}>
                <SelectTrigger data-testid="new-cust-resource"><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{resources.filter(r => !r.active).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Number of Players</Label>
              <Select value={String(form.player_count)} onValueChange={v => setForm(f => ({ ...f, player_count: Number(v) }))}>
                <SelectTrigger data-testid="new-cust-players"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {playerCountsFor(form.resource_id).map(pc => (
                    <SelectItem key={pc} value={String(pc)}>{pc} player{pc > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entry Time (can backdate)</Label>
              <DateTimePicker value={form.start_time} onChange={(v) => setForm((f) => ({ ...f, start_time: v }))} data-testid="new-cust-start"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button onClick={start} data-testid="new-cust-start-btn"><Lightning size={16} weight="fill"/> Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}