import React, { useEffect, useState } from "react";
import { api, formatApiError, fmtMoney, fmtDateTime, fmtDuration, minutesBetween } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import DatePicker from "../components/DatePicker";
import ReceiptPrint, { buildReceiptText } from "../components/Receipt";
import { Printer, WhatsappLogo, ArrowSquareOut } from "@phosphor-icons/react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";

const COLORS = ["hsl(217 91% 60%)", "hsl(38 92% 50%)", "hsl(152 60% 45%)", "hsl(280 70% 60%)"];

export default function ReportsPage() {
  const { cafe } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [auditDate, setAuditDate] = useState(new Date().toISOString().slice(0, 10));
  const [daily, setDaily] = useState(null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [monthly, setMonthly] = useState(null);
  const [audit, setAudit] = useState([]);
  const [billOpen, setBillOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  const openBill = (s) => { setSelectedSession(s); setBillOpen(true); };
  const printSelected = () => { window.print(); };
  const shareSelected = () => {
    if (!selectedSession) return;
    const text = buildReceiptText(selectedSession, cafe);
    const phone = (selectedSession?.customer_phone || "").replace(/\D/g, "");
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const loadDaily = async () => {
    try { const { data } = await api.get(`/reports/daily?date=${date}`); setDaily(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const loadMonthly = async () => {
    try { const { data } = await api.get(`/reports/monthly?year=${year}&month=${month}`); setMonthly(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  const loadAudit = async () => {
    try { 
      const url = `/audit?date=${auditDate}&limit=200`;
      const { data } = await api.get(url); 
      setAudit(data); 
    } catch (e) { 
      toast.error(formatApiError(e)); 
    }
  };
 
  useEffect(() => { loadDaily(); }, [date]);
  useEffect(() => { loadMonthly(); }, [year, month]);
   // Change the dependency array from [] to [auditDate]
  useEffect(() => { 
    loadAudit(); 
  }, [auditDate]);
  const dailyByMode = Object.entries(daily?.by_mode || {}).map(([k, v]) => ({ name: k.toUpperCase(), value: v }));
  const monthlyDays = Object.entries(monthly?.by_day || {}).sort().map(([k, v]) => ({ day: k.slice(8), amount: v }));
  const monthlyGames = Object.entries(monthly?.by_game_type || {}).map(([k, v]) => ({ name: k, value: v }));

  return (
    <div className="space-y-6" data-testid="reports-root">
      <div>
        <div className="uppercase-label">Insights</div>
        <h1 className="text-4xl font-display font-extrabold">Reports</h1>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily" data-testid="tab-daily">Daily</TabsTrigger>
          <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <div className="flex gap-2 items-center">
            <span className="uppercase-label">Date</span>
            <DatePicker value={date} onChange={setDate} data-testid="daily-date-input"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6"><div className="uppercase-label">Total Revenue</div><div className="text-3xl font-display font-extrabold mt-2 font-mono">{fmtMoney(daily?.total)}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="uppercase-label">Bills</div><div className="text-3xl font-display font-extrabold mt-2 font-mono">{daily?.count || 0}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="uppercase-label">Modes</div>
              <div className="flex gap-3 mt-2 flex-wrap">{["cash","upi","card"].map(m => <span key={m} className="text-sm font-mono"><span className="text-muted-foreground uppercase tracking-widest text-[0.6rem] mr-1">{m}</span>{fmtMoney(daily?.by_mode?.[m] || 0)}</span>)}</div>
            </CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display">Bills</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left uppercase-label border-b border-border"><th className="py-2">Customer</th><th>Time</th><th>Total</th><th>Modes</th><th></th></tr></thead>
                <tbody>
                  {(daily?.sessions || []).map(s => (
                    <tr
                      key={s.id}
                      className="border-b border-border cursor-pointer hover:bg-secondary/40 transition-colors"
                      onClick={() => openBill(s)}
                      data-testid={`daily-row-${s.id}`}
                    >
                      <td className="py-2 font-semibold">{s.customer_name}</td>
                      <td>{fmtDateTime(s.billed_at)}</td>
                      <td className="font-mono">{fmtMoney(s.bill_total)}</td>
                      <td className="font-mono text-xs">{(s.payments || []).map(p => `${p.mode}:${p.amount}`).join(", ")}</td>
                      <td className="text-right text-muted-foreground"><ArrowSquareOut size={16}/></td>
                    </tr>
                  ))}
                  {(!daily?.sessions || daily.sessions.length === 0) && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">No bills.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="font-display">Game-wise revenue</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                {Object.keys(daily?.by_game_type || {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data.</p>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={Object.entries(daily.by_game_type).map(([k, v]) => ({ name: k, value: v }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label={(e) => `${e.name}: ₹${e.value}`}>
                        {Object.keys(daily.by_game_type).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}/>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-display">Snacks &amp; accessories revenue</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                {Object.keys(daily?.by_item || {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items sold today.</p>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={Object.entries(daily.by_item).map(([k, v]) => ({ name: k, value: v.revenue }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label={(e) => `${e.name}: ₹${e.value}`}>
                        {Object.keys(daily.by_item).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}/>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display">Snacks &amp; accessories — by item</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left uppercase-label border-b border-border"><th className="py-2">Item</th><th>Type</th><th>Qty</th><th>Revenue</th></tr></thead>
                <tbody>
                  {Object.entries(daily?.by_item || {}).sort((a,b) => b[1].revenue - a[1].revenue).map(([name, rec]) => (
                    <tr key={name} className="border-b border-border" data-testid={`item-stat-${name}`}>
                      <td className="py-2 font-semibold">{name}</td>
                      <td className="capitalize text-muted-foreground">{rec.type}</td>
                      <td className="font-mono">{rec.qty}</td>
                      <td className="font-mono">{fmtMoney(rec.revenue)}</td>
                    </tr>
                  ))}
                  {Object.keys(daily?.by_item || {}).length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No items sold.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display">Items timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {(daily?.items_timeline || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No items added today.</p>
              ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-2">
                  {daily.items_timeline.map((it, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0" data-testid={`timeline-item-${i}`}>
                      <div className="text-xs text-muted-foreground font-mono w-32 shrink-0">{fmtDateTime(it.added_at)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-semibold">{it.name}</span>
                          <span className="text-muted-foreground"> × {it.qty}</span>
                          <span className={`ml-2 text-[0.6rem] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${it.type === "inventory" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>{it.type}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {it.customer_name} · {it.resource_name}
                        </div>
                      </div>
                      <div className="font-mono text-sm">{fmtMoney(it.total)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="uppercase-label">Period</span>
            <Input type="number" value={month} onChange={e => setMonth(Number(e.target.value))} className="w-20" data-testid="monthly-month-input"/>
            <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24" data-testid="monthly-year-input"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6"><div className="uppercase-label">Revenue</div><div className="text-3xl font-display font-extrabold mt-2 font-mono">{fmtMoney(monthly?.total)}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="uppercase-label">Bills</div><div className="text-3xl font-display font-extrabold mt-2 font-mono">{monthly?.count || 0}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="uppercase-label">Modes</div>
              <div className="flex gap-3 mt-2 flex-wrap">{Object.entries(monthly?.by_mode || {}).map(([k,v]) => <span key={k} className="text-sm font-mono"><span className="text-muted-foreground uppercase tracking-widest text-[0.6rem] mr-1">{k}</span>{fmtMoney(v)}</span>)}</div>
            </CardContent></Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="font-display">Revenue by day</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                <ResponsiveContainer><BarChart data={monthlyDays}><XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11}/><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}/><Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}/><Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="font-display">Revenue by game</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={monthlyGames} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label={(e) => `${e.name}: ₹${e.value}`}>
                      {monthlyGames.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}/>
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="font-display">Snacks &amp; accessories revenue</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                {Object.keys(monthly?.by_item || {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items sold this month.</p>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={Object.entries(monthly.by_item).map(([k, v]) => ({ name: k, value: v.revenue }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label={(e) => `${e.name}: ₹${e.value}`}>
                        {Object.keys(monthly.by_item).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}/>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="font-display">Game vs Items by day</CardTitle></CardHeader>
              <CardContent style={{ height: 280 }}>
                {(() => {
                  const days = Array.from(new Set([
                    ...Object.keys(monthly?.by_game_day || {}),
                    ...Object.keys(monthly?.by_item_day || {}),
                  ])).sort();
                  const data = days.map((d) => ({
                    day: d.slice(8),
                    Games: monthly?.by_game_day?.[d] || 0,
                    Items: monthly?.by_item_day?.[d] || 0,
                  }));
                  return data.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
                    <ResponsiveContainer>
                      <BarChart data={data}>
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11}/>
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}/>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}/>
                        <Bar dataKey="Games" stackId="a" fill="hsl(var(--chart-1))" radius={[0,0,0,0]}/>
                        <Bar dataKey="Items" stackId="a" fill="hsl(var(--chart-2))" radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="font-display">Top items this month</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="text-left uppercase-label border-b border-border"><th className="py-2">Item</th><th>Type</th><th>Qty</th><th>Revenue</th></tr></thead>
                <tbody>
                  {Object.entries(monthly?.by_item || {}).sort((a,b) => b[1].revenue - a[1].revenue).map(([name, rec]) => (
                    <tr key={name} className="border-b border-border" data-testid={`monthly-item-${name}`}>
                      <td className="py-2 font-semibold">{name}</td>
                      <td className="capitalize text-muted-foreground">{rec.type}</td>
                      <td className="font-mono">{rec.qty}</td>
                      <td className="font-mono">{fmtMoney(rec.revenue)}</td>
                    </tr>
                  ))}
                  {Object.keys(monthly?.by_item || {}).length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No items sold.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          {/* ---> NEW UI FIX: Date Picker for the Audit Tab <--- */}
          <div className="flex gap-2 items-center">
            <span className="uppercase-label">Date</span>
            <DatePicker value={auditDate} onChange={setAuditDate} data-testid="audit-date-input"/>
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display">Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {audit.map(a => (
                  <div key={a.id} className="flex gap-4 border-l-2 border-primary/30 pl-4 py-1">
                    <div className="text-xs text-muted-foreground font-mono w-44">{fmtDateTime(a.created_at)}</div>
                    <div>
                      <div className="text-sm"><span className="font-semibold">{a.user_name}</span> <span className="text-muted-foreground">({a.user_role})</span></div>
                      <div className="text-sm font-mono">{a.action} {a.target && <span className="text-muted-foreground">→ {a.target.slice(0, 8)}</span>}</div>
                    </div>
                  </div>
                ))}
                {audit.length === 0 && <p className="text-muted-foreground">No activity.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="bill-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">
              Bill — {selectedSession?.customer_name}
            </DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{fmtDateTime(selectedSession.billed_at)}</span>
                <span>Operator: {selectedSession.operator_name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedSession.customer_phone || "—"} · Receipt #{selectedSession.id.slice(0, 8).toUpperCase()}
              </div>

              <div className="border border-border rounded-md p-4 space-y-3 font-mono">
                {(selectedSession.bill_breakdown?.games || []).map((g) => (
                  <div key={g.game_session_id} className="border-b border-border pb-2 last:border-0">
                    <div className="flex justify-between font-bold">
                      <span>{g.resource_name} <span className="text-muted-foreground font-normal">({g.game_type_name})</span></span>
                      <span>{fmtMoney(g.subtotal)}</span>
                    </div>
                    <div className="text-[0.7rem] text-muted-foreground">
                      {fmtDateTime(g.start_time)} → {fmtDateTime(g.end_time)} · {fmtDuration(minutesBetween(g.start_time, g.end_time))} · {g.charge?.weekday}
                    </div>
                    {(g.charge?.applied_grouped || []).map((s, i) => (
                      <div key={i} className="flex justify-between text-xs ml-3 mt-1">
                        <span>{s.duration}min × {s.count} <span className="text-muted-foreground">@ {fmtMoney(s.price)}</span></span>
                        <span>{fmtMoney(s.subtotal)}</span>
                      </div>
                    ))}
                    {(g.items || []).map((it) => (
                      <div key={it.id} className="flex justify-between text-xs ml-3">
                        <span>+ <span className="capitalize text-muted-foreground">[{it.type}]</span> {it.name} × {it.qty}</span>
                        <span>{fmtMoney(it.total)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="space-y-1 pt-2 border-t border-border">
                  <div className="flex justify-between"><span>Game charges</span><span>{fmtMoney(selectedSession.bill_breakdown?.games_total)}</span></div>
                  <div className="flex justify-between"><span>Items</span><span>{fmtMoney(selectedSession.bill_breakdown?.items_total)}</span></div>
                  <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(selectedSession.bill_breakdown?.subtotal)}</span></div>
                  {selectedSession.bill_breakdown?.adjustment !== 0 && (
                    <div className="flex justify-between"><span>Adjustment</span><span>{fmtMoney(selectedSession.bill_breakdown?.adjustment)}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                    <span>TOTAL</span><span>{fmtMoney(selectedSession.bill_total)}</span>
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t border-border">
                  {(selectedSession.payments || []).map((p, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="uppercase tracking-widest">{p.mode}</span>
                      <span>{fmtMoney(p.amount)}</span>
                    </div>
                  ))}
                </div>
                {selectedSession.notes && (
                  <div className="text-[0.7rem] text-muted-foreground italic pt-2 border-t border-border">
                    Note: {selectedSession.notes}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {selectedSession && (
              <Link to={`/sessions/${selectedSession.id}`} className="contents">
                <Button variant="outline" data-testid="bill-detail-open-session">Open session</Button>
              </Link>
            )}
            <Button variant="outline" onClick={shareSelected} data-testid="bill-detail-whatsapp"><WhatsappLogo size={16}/> WhatsApp</Button>
            <Button onClick={printSelected} data-testid="bill-detail-print"><Printer size={16}/> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedSession && <ReceiptPrint session={selectedSession} cafe={cafe} />}
    </div>
  );
}
