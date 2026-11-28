import React, { useEffect, useState } from "react";
import PageState from "../async/PageState";
import { api, fmtPaise, fmtDate, todayISO } from "../../lib/apiClient";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import DatePicker from "../DatePicker";
import { toast } from "sonner";

const firstOfMonth = () => `${todayISO().slice(0, 8)}01`;

/** Membership sales, usage and forfeits over a date range, straight from the card ledger. */
export default function MembershipReport() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!from || !to) return;
    if (to < from) { toast.error("'To' must be on or after 'From'"); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.get("/membership/reports", { params: { from, to } })
      .then(({ data }) => { if (!cancelled) { setData(data); setError(null); } })
      .catch(e => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, retryKey]);

  const preset = (f, t) => { setFrom(f); setTo(t); };

  return (
    <div className="space-y-4" data-testid="membership-report">
      <div className="flex flex-wrap items-end gap-3">
        <div><div className="uppercase-label mb-1">From</div><DatePicker value={from} onChange={setFrom} data-testid="mreport-from"/></div>
        <div><div className="uppercase-label mb-1">To</div><DatePicker value={to} onChange={setTo} data-testid="mreport-to"/></div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => preset(todayISO(), todayISO())}>Today</Button>
          <Button size="sm" variant="ghost" onClick={() => preset(firstOfMonth(), todayISO())}>This month</Button>
          <Button size="sm" variant="ghost" onClick={() => preset(todayISO(-29), todayISO())}>Last 30 days</Button>
        </div>
        {loading && data && <span className="text-xs text-muted-foreground animate-pulse">loading…</span>}
      </div>

      <PageState loading={loading} error={error} data={data ?? undefined} isEmpty={false} onRetry={() => setRetryKey(k => k + 1)} skeletonRows={4}>
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Collected from card sales" value={fmtPaise(data.collected_paise)}
                  sub={`${data.new_cards} new card${data.new_cards === 1 ? "" : "s"} · ${data.recharges} recharge${data.recharges === 1 ? "" : "s"}`}/>
            <Tile label="Bonus given" value={fmtPaise(data.bonus_given_paise)} sub="Extra value added on top of sales"/>
            <Tile label="Consumed on bills" value={fmtPaise(data.consumed.total_paise)}
                  sub={`Paid ${fmtPaise(data.consumed.paid_paise)} · bonus ${fmtPaise(data.consumed.bonus_paise)} · ${data.bills_paid} bill${data.bills_paid === 1 ? "" : "s"}`}/>
            <Tile label="Expired / forfeited" value={fmtPaise(data.forfeited_total.total_paise)}
                  sub={`Paid ${fmtPaise(data.forfeited_total.paid_paise)} · bonus ${fmtPaise(data.forfeited_total.bonus_paise)}`}/>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="font-display">Collected by payment mode</CardTitle></CardHeader>
              <CardContent className="space-y-1 font-mono text-sm">
                {Object.keys(data.collected_by_mode).length === 0 && <p className="text-muted-foreground font-sans">No card sales in this period.</p>}
                {Object.entries(data.collected_by_mode).map(([mode, paise]) => (
                  <div key={mode} className="flex justify-between"><span className="uppercase">{mode}</span><span>{fmtPaise(paise)}</span></div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="font-display">Consumed vs expired</CardTitle></CardHeader>
              <CardContent className="space-y-1 font-mono text-sm">
                <Line label="Used on bills" v={data.consumed}/>
                <Line label="Expired" v={data.expired}/>
                <Line label="Forfeited on recharge" v={data.forfeited_on_recharge}/>
                <Line label="Forfeited on close" v={data.forfeited_on_close}/>
                {data.adjustments_net.total_paise !== 0 && <Line label="Manual adjustments (net)" v={data.adjustments_net}/>}
                <p className="text-xs text-muted-foreground font-sans pt-2">A reversed bill is subtracted on the day it was reversed.</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="font-display">Sales by plan · {fmtDate(data.from)} – {fmtDate(data.to)}</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {data.by_plan.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No cards sold or recharged in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3">Plan</th><th className="px-4 py-3 text-right">New cards</th><th className="px-4 py-3 text-right">Recharges</th>
                      <th className="px-4 py-3 text-right">Collected</th><th className="px-4 py-3 text-right">Bonus given</th><th className="px-4 py-3">By mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_plan.map(p => (
                      <tr key={p.plan_id} className="border-b border-border/60 last:border-0" data-testid={`mreport-plan-${p.plan_id}`}>
                        <td className="px-4 py-2 font-medium">{p.plan_name}</td>
                        <td className="px-4 py-2 text-right font-mono">{p.new_cards}</td>
                        <td className="px-4 py-2 text-right font-mono">{p.recharges}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold">{fmtPaise(p.collected_paise)}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmtPaise(p.bonus_given_paise)}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground font-mono">
                          {Object.entries(p.by_mode).map(([m, v]) => `${m.toUpperCase()} ${fmtPaise(v)}`).join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
      </PageState>
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="uppercase-label">{label}</div>
        <div className="text-3xl font-display font-extrabold mt-2 font-mono">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Line({ label, v }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="font-sans">{label}</span>
      <span>{fmtPaise(v.total_paise)} <span className="text-xs text-muted-foreground">(paid {fmtPaise(v.paid_paise)} · bonus {fmtPaise(v.bonus_paise)})</span></span>
    </div>
  );
}
