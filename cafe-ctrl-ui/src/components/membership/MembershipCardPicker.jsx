import React, { useEffect, useRef, useState } from "react";
import { api, formatApiError, fmtPaise, fmtDate } from "../../lib/apiClient";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { MagnifyingGlass, X, Warning, CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import { CardStatusBadge, PlanChip } from "./MembershipBits";

const BLOCK_REASON = {
  EXPIRED: (c) => `Expired on ${fmtDate(c.expiry_date)}`,
  SUSPENDED: () => "Suspended",
  CLOSED: () => "Closed",
  SCHEDULED: (c) => `Starts ${fmtDate(c.start_date)}`,
};

/** Inline summary of a tagged card: holder, plan, balance, expiry and warnings. */
export function MemberCardSummary({ card, actions = null }) {
  if (!card) return null;
  const blocked = !card.usable;
  return (
    <div className={`rounded-md border px-3 py-2.5 text-sm space-y-1.5 ${blocked ? "border-destructive/50 bg-destructive/5" : "border-primary/40 bg-primary/5"}`}
         data-testid="member-card-summary">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{card.customer_name} <span className="font-mono text-xs text-muted-foreground">{card.card_number}</span></div>
          <div className="text-xs text-muted-foreground">{card.customer_phone}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">{<CardStatusBadge status={card.status}/>}{actions}</div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <PlanChip name={card.plan_name} color={card.plan_color} badge={card.plan_badge}/>
        <span>Balance <b className="font-mono">{fmtPaise(card.total_balance_paise)}</b>
          <span className="text-muted-foreground"> (paid {fmtPaise(card.paid_balance_paise)} + bonus {fmtPaise(card.bonus_balance_paise)})</span></span>
        <span>Valid till <b>{fmtDate(card.expiry_date)}</b>{card.status === "ACTIVE" && ` · ${card.days_remaining}d left`}</span>
      </div>
      {blocked && (
        <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold">
          <Warning size={14}/> {(BLOCK_REASON[card.status] || (() => card.status))(card)}: this card can't pay bills.
        </div>
      )}
      {!blocked && card.total_balance_paise === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold"><Warning size={14}/> No balance left. The bill will need another payment mode.</div>
      )}
      {!blocked && card.total_balance_paise > 0 && card.low_balance && (
        <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold"><Warning size={14}/> Low balance</div>
      )}
    </div>
  );
}

/**
 * Optional membership card field. Search by phone, name or card number (min 2 chars).
 * Cards that can't pay (expired / suspended / scheduled) are listed but can't be picked.
 */
export default function MembershipCardPicker({ value, onChange, autoFocus = false }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/sessions/membership-cards/lookup", { params: { q: term } });
        if (!cancelled) { setResults(data); setOpen(true); }
      } catch (e) { if (!cancelled) toast.error(formatApiError(e)); }
      finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (value) {
    return (
      <MemberCardSummary card={value} actions={
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Remove card" onClick={() => onChange(null)} data-testid="member-card-clear">
          <X size={14}/>
        </Button>
      }/>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
      <Input className="pl-9 pr-9" placeholder="Search phone, name or card number" value={q} autoFocus={autoFocus}
             onChange={e => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)}
             onKeyDown={e => {
               if (e.key !== "Enter") return;
               e.preventDefault();
               const first = results.find(r => r.usable);
               if (first) { onChange(first); setQ(""); setResults([]); setOpen(false); }
             }}
             data-testid="member-card-search"/>
      {loading && <CircleNotch size={16} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>}
      {open && q.trim().length >= 2 && !loading && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg" data-testid="member-card-results">
          {results.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No matching cards</div>}
          {results.map(c => (
            <button type="button" key={c.id} disabled={!c.usable}
                    onClick={() => { onChange(c); setQ(""); setResults([]); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 border-b border-border/50 last:border-0 ${c.usable ? "hover:bg-secondary" : "opacity-60 cursor-not-allowed"}`}
                    data-testid={`member-card-option-${c.id}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{c.customer_name} <span className="font-mono text-xs text-muted-foreground">{c.card_number}</span></span>
                <span className="font-mono text-sm shrink-0">{fmtPaise(c.total_balance_paise)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="truncate">{c.customer_phone} · {c.plan_name}</span>
                {c.usable
                  ? <span className="shrink-0">till {fmtDate(c.expiry_date)}</span>
                  : <span className="shrink-0 text-destructive font-semibold">{(BLOCK_REASON[c.status] || (() => c.status))(c)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
