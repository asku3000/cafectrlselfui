import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError, fmtPaise, fmtDate, fmtDateTime } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, MagnifyingGlass, IdentificationCard, CaretUp, CaretDown, Hourglass, BatteryLow } from "@phosphor-icons/react";
import { toast } from "sonner";
import { CardStatusBadge, PlanChip, SellCardDialog } from "../components/membership/MembershipBits";

const STATUSES = [
  { v: "ACTIVE", l: "Active" }, { v: "SCHEDULED", l: "Scheduled" }, { v: "SUSPENDED", l: "Suspended" },
  { v: "EXPIRED", l: "Expired" }, { v: "CLOSED", l: "Closed" }, { v: "ALL", l: "All statuses" },
];

// Sortable columns: key -> value getter (null/undefined always sort last)
const COLUMNS = [
  { key: "card_number", label: "Card", get: c => c.card_number },
  { key: "customer_name", label: "Customer", get: c => c.customer_name?.toLowerCase() },
  { key: "plan_name", label: "Plan", get: c => c.plan_name?.toLowerCase() },
  { key: "paid", label: "Paid", get: c => c.paid_balance_paise, right: true },
  { key: "bonus", label: "Bonus", get: c => c.bonus_balance_paise, right: true },
  { key: "total", label: "Total", get: c => c.total_balance_paise, right: true },
  { key: "expiry", label: "Valid till", get: c => c.expiry_date },
  { key: "days", label: "Days left", get: c => (c.status === "ACTIVE" ? c.days_remaining : null), right: true },
  { key: "last_used", label: "Last used", get: c => c.last_used_at },
  { key: "status", label: "Status", get: c => c.status },
];

export default function MembershipsPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [summary, setSummary] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellOpen, setSellOpen] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [planId, setPlanId] = useState("all");
  const [expiring, setExpiring] = useState(false);
  const [low, setLow] = useState(false);
  const [sort, setSort] = useState({ key: "expiry", dir: "asc" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.get("/membership/plans").then(({ data }) => setPlans(data)).catch(e => toast.error(formatApiError(e)));
  }, []);

  useEffect(() => {
    api.get("/membership/cards/summary").then(({ data }) => setSummary(data)).catch(e => toast.error(formatApiError(e)));
  }, [refreshKey]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const params = { status };
        if (q.trim()) params.q = q.trim();
        if (planId !== "all") params.plan_id = planId;
        if (expiring) params.expiring_within_days = 7;
        if (low) params.low_balance = true;
        const { data } = await api.get("/membership/cards", { params });
        setCards(data);
      } catch (e) { toast.error(formatApiError(e)); }
      finally { setLoading(false); }
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, status, planId, expiring, low, refreshKey]);

  const sorted = useMemo(() => {
    const col = COLUMNS.find(c => c.key === sort.key) || COLUMNS[0];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...cards].sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [cards, sort]);

  const toggleSort = (key) => setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  // The quick filters only make sense for active cards
  const quick = (setter, value) => { setter(value); if (value) setStatus("ACTIVE"); };
  const filtered = q.trim() || status !== "ACTIVE" || planId !== "all" || expiring || low;
  const clearFilters = () => { setQ(""); setStatus("ACTIVE"); setPlanId("all"); setExpiring(false); setLow(false); };

  return (
    <div className="space-y-6" data-testid="memberships-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Customers</div>
          <h1 className="text-4xl font-display font-extrabold">Memberships</h1>
          <p className="text-muted-foreground mt-2">Prepaid cards: who holds them, what's left on them, and when they run out.</p>
        </div>
        <Button onClick={() => setSellOpen(true)} data-testid="sell-card-btn"><Plus size={18}/> Sell card</Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="memberships-summary">
          <Tile label="Active members" value={summary.active_cards}
                sub={`${summary.active_customers} customer${summary.active_customers === 1 ? "" : "s"}${summary.scheduled_cards ? ` · ${summary.scheduled_cards} scheduled` : ""}${summary.suspended_cards ? ` · ${summary.suspended_cards} suspended` : ""}`}/>
          <Tile label="Outstanding balance" value={fmtPaise(summary.outstanding_total_paise)} sub="What you owe card holders"/>
          <Tile label="Paid balance" value={fmtPaise(summary.outstanding_paid_paise)} sub="Customers' money still on cards"/>
          <Tile label="Bonus balance" value={fmtPaise(summary.outstanding_bonus_paise)} sub="Bonus value still on cards"/>
        </div>
      )}
      {summary?.pending_forfeit_paise > 0 && (
        <div className="text-sm text-muted-foreground">
          {fmtPaise(summary.pending_forfeit_paise)} on expired cards will be forfeited tonight (not counted above).
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input className="pl-9" placeholder="Name, phone or card number" value={q} onChange={e => setQ(e.target.value)} data-testid="memberships-search"/>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" data-testid="filter-status"><SelectValue/></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={planId} onValueChange={setPlanId}>
          <SelectTrigger className="w-40" data-testid="filter-plan"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}{p.is_active ? "" : " (off sale)"}</SelectItem>)}
          </SelectContent>
        </Select>
        <Chip active={expiring} onClick={() => quick(setExpiring, !expiring)} testid="filter-expiring">
          <Hourglass size={14}/> Expiring in 7 days{summary ? ` (${summary.expiring_7d})` : ""}
        </Chip>
        <Chip active={low} onClick={() => quick(setLow, !low)} testid="filter-low">
          <BatteryLow size={14}/> Low balance{summary ? ` (${summary.low_balance})` : ""}
        </Chip>
        {filtered && <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="filter-clear">Clear</Button>}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                {COLUMNS.map(col => (
                  <th key={col.key} className={`px-4 py-3 whitespace-nowrap ${col.right ? "text-right" : ""}`}>
                    <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 uppercase tracking-widest hover:text-foreground"
                            data-testid={`sort-${col.key}`}>
                      {col.label}
                      {sort.key === col.key && (sort.dir === "asc" ? <CaretUp size={10} weight="bold"/> : <CaretDown size={10} weight="bold"/>)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.id} onClick={() => navigate(`/memberships/${c.id}`)}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary cursor-pointer" data-testid={`card-row-${c.id}`}>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">{c.card_number}</td>
                  <td className="px-4 py-3"><div className="font-medium">{c.customer_name}</div><div className="text-xs text-muted-foreground">{c.customer_phone}</div></td>
                  <td className="px-4 py-3"><PlanChip name={c.plan_name} color={c.plan_color} badge={c.plan_badge}/></td>
                  <td className="px-4 py-3 text-right font-mono">{fmtPaise(c.paid_balance_paise)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtPaise(c.bonus_balance_paise)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${c.low_balance ? "text-amber-500" : ""}`}>{fmtPaise(c.total_balance_paise)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(c.expiry_date)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${c.status === "ACTIVE" && c.days_remaining <= 7 ? "text-amber-500 font-bold" : ""}`}>
                    {c.status === "ACTIVE" ? c.days_remaining : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{c.last_used_at ? fmtDateTime(c.last_used_at) : "Never"}</td>
                  <td className="px-4 py-3"><CardStatusBadge status={c.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && cards.length === 0 && (
            <div className="p-6 flex items-center gap-3 text-muted-foreground">
              <IdentificationCard size={28} weight="duotone"/> {filtered ? "No cards match these filters." : "No active membership cards."}
            </div>
          )}
        </CardContent>
      </Card>

      <SellCardDialog open={sellOpen} onOpenChange={setSellOpen}
                      onDone={(c) => { setRefreshKey(k => k + 1); navigate(`/memberships/${c.id}`); }} />
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="uppercase-label">{label}</div>
        <div className="font-display font-extrabold text-2xl sm:text-3xl mt-1 font-mono">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Chip({ active, onClick, children, testid }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid} aria-pressed={active}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm transition-colors ${
              active ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:bg-secondary"}`}>
      {children}
    </button>
  );
}
