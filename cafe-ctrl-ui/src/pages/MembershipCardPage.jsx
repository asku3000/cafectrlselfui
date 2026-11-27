import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatApiError, fmtPaise, fmtDate, fmtDateTime, parseHundredths, addDaysISO, todayISO } from "../lib/apiClient";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { ArrowLeft, ArrowsClockwise, PlusMinus, CalendarPlus, Pause, Play, XCircle, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import { CardStatusBadge, PlanChip, SellCardDialog, describePayments } from "../components/membership/MembershipBits";
import DatePicker from "../components/DatePicker";

const TYPE_LABEL = {
  LOAD: "Card sold", RECHARGE: "Recharge", BONUS: "Bonus", BILL_DEBIT: "Bill payment", REVERSAL: "Reversal",
  ADJUSTMENT: "Manual adjustment", EXPIRY_FORFEIT: "Expired (forfeit)", RECHARGE_FORFEIT: "Forfeit on recharge",
  CLOSE_FORFEIT: "Forfeit on close", EXPIRY_EXTENDED: "Expiry extended", START_DATE_CHANGED: "Start date changed", SUSPENDED: "Suspended",
  REACTIVATED: "Reactivated", CLOSED: "Closed",
};

export default function MembershipCardPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "CAFE_ADMIN";
  const [data, setData] = useState(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [action, setAction] = useState(null); // "adjust" | "extend" | "SUSPEND" | "REACTIVATE" | "CLOSE"

  const load = async () => {
    try { const { data } = await api.get(`/membership/cards/${id}`); setData(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, [id]);

  if (!data) return <div className="text-muted-foreground">Loading…</div>;
  const c = data.card;
  const closed = c.status === "CLOSED";

  return (
    <div className="space-y-6" data-testid="card-detail-root">
      <Link to="/memberships" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft size={16}/> Back to memberships</Link>

      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <div className="uppercase-label font-mono">{c.card_number}</div>
          <h1 className="text-4xl font-display font-extrabold">{c.customer_name}</h1>
          <p className="text-muted-foreground mt-1">{c.customer_phone} · sold {fmtDateTime(c.issued_at)}{c.issued_by_name ? ` by ${c.issued_by_name}` : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <CardStatusBadge status={c.status}/>
          {!closed && c.status !== "SUSPENDED" && <Button onClick={() => setRechargeOpen(true)} data-testid="recharge-btn"><ArrowsClockwise size={16}/> Recharge</Button>}
          {isAdmin && !closed && (
            <>
              <Button variant="outline" onClick={() => setAction("adjust")} data-testid="adjust-btn"><PlusMinus size={16}/> Adjust</Button>
              {c.status !== "EXPIRED" && <Button variant="outline" onClick={() => setAction("start")} data-testid="start-date-btn"><CalendarPlus size={16}/> Change start</Button>}
              <Button variant="outline" onClick={() => setAction("extend")} data-testid="extend-btn"><CalendarPlus size={16}/> Extend</Button>
              {c.status === "SUSPENDED"
                ? <Button variant="outline" onClick={() => setAction("REACTIVATE")} data-testid="reactivate-btn"><Play size={16}/> Reactivate</Button>
                : c.status !== "EXPIRED" && <Button variant="outline" onClick={() => setAction("SUSPEND")} data-testid="suspend-btn"><Pause size={16}/> Suspend</Button>}
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setAction("CLOSE")} data-testid="close-btn"><XCircle size={16}/> Close</Button>
            </>
          )}
        </div>
      </div>

      {!data.reconciled && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm flex items-center gap-2">
          <Warning size={18}/> This card's balance doesn't match its ledger. Please report this; don't adjust it manually.
        </div>
      )}
      {c.pending_forfeit_paise > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Expired on {fmtDate(c.expiry_date)}. The remaining {fmtPaise(c.pending_forfeit_paise)} will be forfeited tonight unless an admin extends the expiry.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total balance" value={fmtPaise(c.total_balance_paise)} accent={c.low_balance ? "text-amber-500" : ""} sub={c.low_balance ? "Low balance" : null}/>
        <Stat label="Paid balance" value={fmtPaise(c.paid_balance_paise)}/>
        <Stat label="Bonus balance" value={fmtPaise(c.bonus_balance_paise)}/>
        <Stat label="Valid" value={`${fmtDate(c.start_date)} → ${fmtDate(c.expiry_date)}`} small
              sub={c.status === "ACTIVE" ? `${c.days_remaining} day${c.days_remaining === 1 ? "" : "s"} left` : c.status === "SCHEDULED" ? "Not started yet" : null}/>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Current plan</CardTitle></CardHeader>
        <CardContent className="text-sm flex flex-wrap gap-x-8 gap-y-2">
          <PlanChip name={c.plan_name} color={c.plan_color} badge={c.plan_badge}/>
          <span>Paid {fmtPaise(c.plan_load_amount_paise)}</span>
          <span>Bonus {fmtPaise(c.plan_bonus_amount_paise)}{c.plan_bonus_type === "PERCENT" ? ` (${c.plan_bonus_value / 100}%)` : ""}</span>
          <span>{c.plan_validity_days} days</span>
          <span className="text-muted-foreground">Bought {fmtDateTime(c.period_purchased_at)}</span>
          {c.last_used_at && <span className="text-muted-foreground">Last used {fmtDateTime(c.last_used_at)}</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display">Bills &amp; sessions</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {(data.sessions || []).length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">This card hasn't been used on any session yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3">Started</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Bill</th><th className="px-4 py-3 text-right">Paid from card</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map(s => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-secondary" data-testid={`linked-session-${s.id}`}>
                    <td className="px-4 py-2 whitespace-nowrap"><Link className="underline" to={`/sessions/${s.id}`}>{fmtDateTime(s.created_at)}</Link></td>
                    <td className="px-4 py-2">{s.customer_name}{s.currently_tagged && s.status === "active" && <span className="ml-2 text-[0.6rem] uppercase tracking-widest font-bold text-primary">running</span>}</td>
                    <td className="px-4 py-2 capitalize">{s.status}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.status === "billed" || s.status === "voided" ? fmtPaise(Math.round((s.bill_total || 0) * 100)) : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.card_paid_paise ? fmtPaise(s.card_paid_paise) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display">History</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">When</th><th className="px-4 py-3">What</th>
                <th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Bonus</th>
                <th className="px-4 py-3 text-right">Balance after</th><th className="px-4 py-3">By</th><th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.map(e => (
                <tr key={e.id} className="border-b border-border/60 last:border-0" data-testid={`ledger-${e.id}`}>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDateTime(e.created_at)}</td>
                  <td className="px-4 py-2 whitespace-nowrap font-medium">{TYPE_LABEL[e.entry_type] || e.entry_type}</td>
                  <td className="px-4 py-2 text-right font-mono"><Signed v={e.paid_portion_paise}/></td>
                  <td className="px-4 py-2 text-right font-mono"><Signed v={e.bonus_portion_paise}/></td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPaise(e.balance_after_paise)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{e.user_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {[e.plan_name && `Plan ${e.plan_name}`, e.payment_mode && `via ${describePayments(e.payment_breakdown, e.payment_mode)}`, e.note].filter(Boolean).join(" · ")}
                    {e.session_id && <> · <Link className="underline" to={`/sessions/${e.session_id}`}>bill</Link></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SellCardDialog open={rechargeOpen} onOpenChange={setRechargeOpen} card={c} onDone={load}/>
      <AdminActionDialog action={action} card={c} onClose={() => setAction(null)} onDone={load}/>
    </div>
  );
}

function Signed({ v }) {
  if (!v) return <span className="text-muted-foreground">—</span>;
  return <span className={v > 0 ? "text-emerald-500" : "text-destructive"}>{v > 0 ? "+" : ""}{fmtPaise(v)}</span>;
}

function Stat({ label, value, sub, accent = "", small }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="uppercase-label">{label}</div>
        <div className={`font-display font-extrabold mt-1 ${small ? "text-lg" : "text-3xl"} ${accent}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

const ACTION_TITLE = {
  adjust: "Manual adjustment", extend: "Extend expiry", start: "Change start date", SUSPEND: "Suspend card", REACTIVATE: "Reactivate card", CLOSE: "Close card",
};

function AdminActionDialog({ action, card, onClose, onDone }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!action) return;
    setForm({
      direction: "CREDIT", paid: "", bonus: "", reason: "",
      new_expiry_date: addDaysISO(card.expiry_date > todayISO() ? card.expiry_date : todayISO(), 30),
      new_start_date: card.start_date,
    });
  }, [action, card.id]);

  if (!action) return null;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (saving) return;
    if (!form.reason?.trim()) return toast.error("A reason is required");
    let url, body;
    if (action === "adjust") {
      const paid = form.paid === "" ? 0 : parseHundredths(form.paid);
      const bonus = form.bonus === "" ? 0 : parseHundredths(form.bonus);
      if (paid == null || bonus == null || paid < 0 || bonus < 0) return toast.error("Enter valid amounts (max 2 decimals)");
      if (paid + bonus === 0) return toast.error("Enter an amount");
      url = "adjust"; body = { direction: form.direction, paid_paise: paid, bonus_paise: bonus, reason: form.reason };
    } else if (action === "extend") {
      url = "extend"; body = { new_expiry_date: form.new_expiry_date, reason: form.reason };
    } else if (action === "start") {
      if (form.new_start_date === card.start_date) return toast.error("Pick a different start date");
      url = "start-date"; body = { new_start_date: form.new_start_date, reason: form.reason };
    } else {
      url = "status"; body = { action, reason: form.reason };
    }
    try {
      setSaving(true);
      await api.post(`/membership/cards/${card.id}/${url}`, body);
      toast.success(`${ACTION_TITLE[action]} done`);
      onClose(); onDone();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!action} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{ACTION_TITLE[action]} — {card.card_number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {action === "adjust" && (
            <>
              <Select value={form.direction} onValueChange={v => set("direction", v)}>
                <SelectTrigger data-testid="adjust-direction"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="CREDIT">Credit (add to card)</SelectItem><SelectItem value="DEBIT">Debit (take from card)</SelectItem></SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Paid balance (₹)</Label><Input inputMode="decimal" value={form.paid} onChange={e => set("paid", e.target.value)} placeholder="0" data-testid="adjust-paid"/></div>
                <div><Label>Bonus balance (₹)</Label><Input inputMode="decimal" value={form.bonus} onChange={e => set("bonus", e.target.value)} placeholder="0" data-testid="adjust-bonus"/></div>
              </div>
              <div className="text-xs text-muted-foreground">Now: paid {fmtPaise(card.paid_balance_paise)} · bonus {fmtPaise(card.bonus_balance_paise)}</div>
            </>
          )}
          {action === "extend" && (
            <div>
              <Label>New last valid day (currently {fmtDate(card.expiry_date)})</Label>
              <Input type="date" min={addDaysISO(card.expiry_date, 1)} value={form.new_expiry_date} onChange={e => set("new_expiry_date", e.target.value)} data-testid="extend-date"/>
              {card.status === "EXPIRED" && card.pending_forfeit_paise === 0 && (
                <div className="text-xs text-amber-500 mt-1">This card's balance was already forfeited; it will be reactivated with a zero balance.</div>
              )}
            </div>
          )}
          {action === "start" && (() => {
            const bought = String(card.period_purchased_at || "").slice(0, 10) || todayISO();
            const shift = Math.round((new Date(`${form.new_start_date}T00:00:00`) - new Date(`${card.start_date}T00:00:00`)) / 86400000);
            const newExpiry = form.new_start_date ? addDaysISO(card.expiry_date, shift) : card.expiry_date;
            return (
              <div className="space-y-2">
                <Label>New start date (currently {fmtDate(card.start_date)})</Label>
                <div><DatePicker value={form.new_start_date} minDate={bought} onChange={v => set("new_start_date", v)} className="w-full sm:w-56" data-testid="start-date-input"/></div>
                <div className="text-xs text-muted-foreground">
                  Valid {fmtDate(form.new_start_date)} → {fmtDate(newExpiry)}. The expiry moves by the same number of days, so the card keeps its full validity.
                  It can't start before the day it was bought ({fmtDate(bought)}).
                </div>
              </div>
            );
          })()}
          {action === "CLOSE" && card.total_balance_paise > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              Closing forfeits the remaining <b>{fmtPaise(card.total_balance_paise)}</b>. This can't be undone.
            </div>
          )}
          <div><Label>Reason (required)</Label><Input value={form.reason || ""} maxLength={500} onChange={e => set("reason", e.target.value)} data-testid="action-reason"/></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} variant={action === "CLOSE" ? "destructive" : "default"} data-testid="action-submit">{saving ? "Saving…" : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
