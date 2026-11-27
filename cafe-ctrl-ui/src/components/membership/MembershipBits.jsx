import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError, fmtPaise, fmtDate, todayISO, addDaysISO, newRequestId, parseHundredths, hundredthsToInput } from "../../lib/apiClient";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import DatePicker from "../DatePicker";
import { Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

const STATUS_STYLE = {
  ACTIVE: "bg-emerald-500/15 text-emerald-500",
  SCHEDULED: "bg-sky-500/15 text-sky-500",
  EXPIRED: "bg-muted text-muted-foreground",
  SUSPENDED: "bg-amber-500/15 text-amber-500",
  CLOSED: "bg-destructive/15 text-destructive",
};

export function CardStatusBadge({ status }) {
  return (
    <span className={`text-[0.65rem] uppercase tracking-widest font-bold px-2 py-1 rounded ${STATUS_STYLE[status] || "bg-muted"}`}
          data-testid="card-status">
      {status}
    </span>
  );
}

export function PlanChip({ name, color, badge }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color || "#3B82F6" }} />
      <span className="truncate">{name}</span>
      {badge && <span className="text-[0.55rem] uppercase tracking-widest font-bold px-1 rounded bg-secondary">{badge}</span>}
    </span>
  );
}

const MODES = [{ v: "cash", l: "Cash" }, { v: "upi", l: "UPI" }, { v: "card", l: "Card" }];

// "upi 600 + cash 400" style text for a payment breakdown [{mode, amount_paise}]
export function describePayments(parts, fallbackMode) {
  if (Array.isArray(parts) && parts.length > 0) {
    return parts.map(p => `${String(p.mode).toUpperCase()} ${fmtPaise(p.amount_paise)}`).join(" + ");
  }
  return fallbackMode ? String(fallbackMode).toUpperCase() : "";
}

/**
 * Sell a new card (card == null) or recharge an existing one.
 * The price can be split across cash / UPI / card; the lines must add up to the plan price exactly.
 * Recharging forfeits the remaining balance: the operator must see and confirm the amount, and the server re-checks it.
 */
export function SellCardDialog({ open, onOpenChange, card = null, onDone }) {
  const isRecharge = !!card;
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      customer_name: "", customer_phone: "", plan_id: card?.plan_id || "",
      payments: [{ mode: "cash", amount: "" }],
      start_date: todayISO(), note: "", request_id: newRequestId(), confirmForfeit: false,
    });
    api.get("/membership/plans")
      .then(({ data }) => setPlans(data.filter(p => p.is_active)))
      .catch(e => toast.error(formatApiError(e)));
  }, [open, card?.id]);

  const plan = useMemo(() => plans.find(p => p.id === form?.plan_id), [plans, form?.plan_id]);

  // Each time the dialog opens or the plan changes, start with one line for the full price
  useEffect(() => {
    if (!plan) return;
    setForm(f => f && ({ ...f, payments: [{ mode: f.payments[0]?.mode || "cash", amount: hundredthsToInput(plan.load_amount_paise) }] }));
  }, [plan?.id, form?.request_id]);

  const forfeit = isRecharge ? card.total_balance_paise : 0;

  if (!form) return null;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const price = plan?.load_amount_paise || 0;
  const lines = form.payments.map(p => ({ ...p, paise: p.amount === "" ? 0 : parseHundredths(p.amount) }));
  const lineError = lines.some(l => l.paise == null) ? "Enter valid amounts (max 2 decimals)"
    : lines.some(l => l.paise <= 0) ? "Each amount must be more than zero (remove empty lines)" : null;
  const paidSum = lines.reduce((a, l) => a + (l.paise || 0), 0);
  const mismatch = plan && !lineError && paidSum !== price;
  const startError = form.start_date < todayISO() ? "Start date can't be before today" : null;

  const setLine = (i, patch) => setForm(f => ({ ...f, payments: f.payments.map((p, j) => j === i ? { ...p, ...patch } : p) }));
  const removeLine = (i) => setForm(f => ({ ...f, payments: f.payments.filter((_, j) => j !== i) }));
  const addLine = () => setForm(f => {
    const used = new Set(f.payments.map(p => p.mode));
    const mode = (MODES.find(m => !used.has(m.v)) || MODES[0]).v;
    const remaining = Math.max(0, price - paidSum);
    return { ...f, payments: [...f.payments, { mode, amount: remaining ? hundredthsToInput(remaining) : "" }] };
  });
  // Puts whatever is still unpaid on the last line
  const fillRemaining = () => setForm(f => {
    const others = lines.slice(0, -1).reduce((a, l) => a + (l.paise || 0), 0);
    const last = Math.max(0, price - others);
    return { ...f, payments: f.payments.map((p, j) => j === f.payments.length - 1 ? { ...p, amount: hundredthsToInput(last) } : p) };
  });

  const submit = async () => {
    if (saving) return;
    if (!isRecharge && (!form.customer_name.trim() || !form.customer_phone.trim())) return toast.error("Name and phone are required");
    if (!plan) return toast.error("Choose a plan");
    if (lineError) return toast.error(lineError);
    if (mismatch) return toast.error(`Payments add up to ${fmtPaise(paidSum)}, but the plan price is ${fmtPaise(price)}`);
    if (startError) return toast.error(startError);
    if (forfeit > 0 && !form.confirmForfeit) return toast.error("Confirm the balance that will be forfeited");
    try {
      setSaving(true);
      const body = {
        plan_id: form.plan_id,
        payments: lines.map(l => ({ mode: l.mode, amount_paise: l.paise })),
        start_date: form.start_date,
        note: form.note, request_id: form.request_id,
      };
      const { data } = isRecharge
        ? await api.post(`/membership/cards/${card.id}/recharge`, { ...body, expected_forfeit_paise: forfeit })
        : await api.post("/membership/cards", { ...body, customer_name: form.customer_name, customer_phone: form.customer_phone });
      toast.success(isRecharge ? `Recharged ${data.card_number}` : `Card ${data.card_number} issued to ${data.customer_name}`);
      onOpenChange(false);
      onDone?.(data);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const canSubmit = !saving && plan && !lineError && !mismatch && !startError && !(forfeit > 0 && !form.confirmForfeit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{isRecharge ? `Recharge ${card.card_number}` : "Sell membership card"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {!isRecharge && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Customer name</Label><Input value={form.customer_name} onChange={e => set("customer_name", e.target.value)} data-testid="sell-name"/></div>
              <div><Label>Phone</Label><Input inputMode="tel" value={form.customer_phone} onChange={e => set("customer_phone", e.target.value)} data-testid="sell-phone"/></div>
            </div>
          )}
          {isRecharge && (
            <div className="text-sm text-muted-foreground">{card.customer_name} · {card.customer_phone}</div>
          )}
          <div>
            <Label>Plan</Label>
            <Select value={form.plan_id} onValueChange={v => set("plan_id", v)}>
              <SelectTrigger data-testid="sell-plan"><SelectValue placeholder="Choose a plan"/></SelectTrigger>
              <SelectContent>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — pay {fmtPaise(p.load_amount_paise)}, gets {fmtPaise(p.total_value_paise)} · {p.validity_days}d
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {plans.length === 0 && <div className="text-xs text-muted-foreground mt-1">No plans on sale. An admin can add them under Membership Plans.</div>}
          </div>

          {plan && (
            <div className="space-y-2" data-testid="sell-payments">
              <Label>Payment received</Label>
              {form.payments.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Select value={p.mode} onValueChange={v => setLine(i, { mode: v })}>
                    <SelectTrigger className="w-28" data-testid={`sell-pay-mode-${i}`}><SelectValue/></SelectTrigger>
                    <SelectContent>{MODES.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input inputMode="decimal" placeholder="Amount (₹)" value={p.amount}
                         onChange={e => setLine(i, { amount: e.target.value })} data-testid={`sell-pay-amount-${i}`}/>
                  {form.payments.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(i)} title="Remove line" data-testid={`sell-pay-remove-${i}`}>
                      <Trash size={16}/>
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 flex-wrap">
                <Button type="button" size="sm" variant="outline" onClick={addLine} data-testid="sell-pay-add"><Plus size={14}/> Add split</Button>
                {mismatch && form.payments.length > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={fillRemaining} data-testid="sell-pay-fill">Fill remaining</Button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Receiving <span className="font-mono">{fmtPaise(paidSum)}</span> of <span className="font-mono">{fmtPaise(price)}</span>
                {lineError && <span className="text-destructive ml-2">{lineError}</span>}
                {mismatch && <span className="text-destructive ml-2">
                  {paidSum < price ? `${fmtPaise(price - paidSum)} still to collect` : `${fmtPaise(paidSum - price)} too much`}
                </span>}
              </div>
            </div>
          )}

          <div>
            <Label>Membership starts</Label>
            <div className="mt-1">
              <DatePicker value={form.start_date} minDate={todayISO()} onChange={v => set("start_date", v || todayISO())}
                          className="w-full sm:w-56" data-testid="sell-start"/>
            </div>
            {startError && <div className="text-xs text-destructive mt-1">{startError}</div>}
          </div>

          {plan && (
            <div className="rounded-md bg-secondary px-3 py-2 text-sm space-y-0.5" data-testid="sell-summary">
              <div>Collect <b>{fmtPaise(plan.load_amount_paise)}</b> → card gets <b>{fmtPaise(plan.total_value_paise)}</b> ({fmtPaise(plan.bonus_amount_paise)} bonus)</div>
              <div className="text-muted-foreground">Valid {fmtDate(form.start_date)} → {fmtDate(addDaysISO(form.start_date, plan.validity_days - 1))}
                {form.start_date !== todayISO() && " · can't be used before the start date"}</div>
            </div>
          )}
          {forfeit > 0 && (
            <label className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.confirmForfeit} onChange={e => set("confirmForfeit", e.target.checked)} data-testid="sell-confirm-forfeit"/>
              <span>The remaining balance of <b>{fmtPaise(forfeit)}</b> (paid {fmtPaise(card.paid_balance_paise)} + bonus {fmtPaise(card.bonus_balance_paise)}) will be <b>forfeited</b>. Balances don't carry forward.</span>
            </label>
          )}
          <div><Label>Note (optional)</Label><Input value={form.note} maxLength={500} onChange={e => set("note", e.target.value)} data-testid="sell-note"/></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit} data-testid="sell-submit">
            {saving ? "Saving…" : isRecharge ? "Recharge" : "Sell card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
