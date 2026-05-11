import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiError, fmtMoney, fmtDateTime, fmtDuration, minutesBetween, toLocalInput, fromLocalInput } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, StopCircle, Receipt, Trash, ArrowLeft, ForkKnife, Printer, WhatsappLogo, XCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import ReceiptPrint, { buildReceiptText } from "../components/Receipt";
import DateTimePicker from "../components/DateTimePicker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cafe } = useAuth();
  const [sess, setSess] = useState(null);
  const [resources, setResources] = useState([]);
  const [rateCards, setRateCards] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [bill, setBill] = useState(null);

  const [addGameOpen, setAddGameOpen] = useState(false);
  const [endGameOpen, setEndGameOpen] = useState(null);
  const [billingOpen, setBillingOpen] = useState(false);

  const [newGame, setNewGame] = useState({ resource_id: "", player_count: 1, start_time: toLocalInput() });
  const [endTime, setEndTime] = useState(toLocalInput());
  const [adjustment, setAdjustment] = useState(0);
  const [payments, setPayments] = useState([{ mode: "cash", amount: 0 }]);
  const [notes, setNotes] = useState("");
  const [itemPick, setItemPick] = useState({ open: false, gameId: null, type: "inventory", ref_id: "", qty: 1 });

  const canBill = user?.role === "CAFE_ADMIN" || user?.permissions?.includes("billing");

  const load = async () => {
    try {
      const [s, r, inv, acc, rc] = await Promise.all([
        api.get(`/sessions/${id}`),
        api.get("/resources"),
        api.get("/inventory"),
        api.get("/accessories"),
        api.get("/rate-cards"),
      ]);
      setSess(s.data); setResources(r.data); setInventory(inv.data); setAccessories(acc.data); setRateCards(rc.data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [id]);

  const playerCountsFor = (rid) => {
    const r = resources.find((x) => x.id === rid);
    if (!r) return [1];
    const rc = rateCards.find((c) => c.id === r.rate_card_id);
    const pcs = Array.isArray(rc?.player_counts) ? rc.player_counts.map(Number).filter((n) => Number.isFinite(n)) : [];
    return pcs.length ? Array.from(new Set(pcs)).sort((a, b) => a - b) : [1];
  };

  const previewBill = async () => {
    try { const { data } = await api.get(`/sessions/${id}/bill`); setBill(data); setBillingOpen(true); setAdjustment(0); setPayments([{ mode: "cash", amount: data.grand_total }]); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const addGame = async () => {
    try {
      if (!newGame.resource_id) return toast.error("Pick a resource");
      await api.post(`/sessions/${id}/games`, {
        resource_id: newGame.resource_id,
        player_count: Number(newGame.player_count) || 1,
        start_time: fromLocalInput(newGame.start_time),
      });
      setAddGameOpen(false); load(); toast.success("Game added");
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const endGame = async () => {
    try {
      await api.post(`/sessions/${id}/games/${endGameOpen}/end`, { end_time: fromLocalInput(endTime) });
      setEndGameOpen(null); load(); toast.success("Game soft-closed");
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const addItem = async () => {
    try {
      if (!itemPick.ref_id) return;
      await api.post(`/sessions/${id}/games/${itemPick.gameId}/items`, { type: itemPick.type, ref_id: itemPick.ref_id, qty: Number(itemPick.qty) });
      setItemPick({ open: false, gameId: null, type: "inventory", ref_id: "", qty: 1 });
      load(); toast.success("Item added");
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const removeItem = async (gameId, itemId, itemName) => {
    try { await api.delete(`/sessions/${id}/games/${gameId}/items/${itemId}`); load(); toast.success(`Removed ${itemName}`); } catch (e) { toast.error(formatApiError(e)); }
  };

  const recalcBill = () => {
    if (!bill) return null;
    const grand = +(bill.subtotal + Number(adjustment || 0)).toFixed(2);
    return { ...bill, adjustment: Number(adjustment || 0), grand_total: grand };
  };
  const recomputed = recalcBill();
  const paySum = payments.reduce((a, p) => a + Number(p.amount || 0), 0);

  const checkout = async () => {
    try {
      const filtered = payments.filter(p => Number(p.amount) > 0);
      await api.post(`/sessions/${id}/checkout`, { adjustment: Number(adjustment || 0), payments: filtered, notes });
      toast.success("Bill closed!");
      setBillingOpen(false);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const cancelSession = async () => {
    try {
      await api.post(`/sessions/${id}/cancel`);
      toast.success("Session cancelled");
      navigate("/sessions");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const printReceipt = () => { window.print(); };

  const shareWhatsApp = () => {
    const text = buildReceiptText(sess, cafe);
    const phone = (sess?.customer_phone || "").replace(/\D/g, "");
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!sess) return <div className="text-muted-foreground">Loading…</div>;

  const isBilled = sess.status === "billed";
  const isCancelled = sess.status === "cancelled";
  const isAdmin = user?.role === "CAFE_ADMIN";
  const totalMins = sess.games.reduce((a, g) => a + minutesBetween(g.start_time, g.end_time || new Date()), 0);
  const availableResources = resources.filter(r => !r.active && !sess.games.some(g => g.status === "active" && g.resource_id === r.id));

  return (
    <div className="space-y-6" data-testid="session-detail-root">
      <Link to="/sessions" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft size={16}/> Back to sessions</Link>
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Customer Session</div>
          <h1 className="text-4xl font-display font-extrabold">{sess.customer_name}</h1>
          <p className="text-muted-foreground mt-1">{sess.customer_phone || "—"} · started {fmtDateTime(sess.created_at)} · operator {sess.operator_name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isBilled && !isCancelled && <Button variant="outline" onClick={() => { setNewGame({ resource_id: "", player_count: 1, start_time: toLocalInput() }); setAddGameOpen(true); }} data-testid="add-game-btn"><Plus size={16}/> Add Game</Button>}
          {!isBilled && !isCancelled && canBill && <Button onClick={previewBill} data-testid="bill-btn"><Receipt size={16}/> Bill</Button>}
          {!isBilled && !isCancelled && isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive" data-testid="cancel-session-btn"><XCircle size={16}/> Cancel</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will discard the session for <b>{sess.customer_name}</b> without billing. This cannot be undone. Use only when an entry was started by mistake or the customer left without playing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="cancel-confirm-no">Keep session</AlertDialogCancel>
                  <AlertDialogAction onClick={cancelSession} data-testid="cancel-confirm-yes">Yes, cancel</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isBilled && (
            <>
              <Button variant="outline" onClick={printReceipt} data-testid="print-receipt-btn"><Printer size={16}/> Print</Button>
              <Button variant="outline" onClick={shareWhatsApp} data-testid="share-whatsapp-btn"><WhatsappLogo size={16}/> WhatsApp</Button>
              <span className="px-3 py-2 rounded-md bg-emerald-500/15 text-emerald-500 font-bold uppercase tracking-widest text-xs">Billed · {fmtMoney(sess.bill_total)}</span>
            </>
          )}
          {isCancelled && <span className="px-3 py-2 rounded-md bg-destructive/15 text-destructive font-bold uppercase tracking-widest text-xs">Cancelled</span>}
        </div>
      </div>

      <div className="space-y-4">
        {sess.games.map(g => (
          <Card key={g.id} data-testid={`game-${g.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <div className="uppercase-label">{g.game_type_name}</div>
                  <CardTitle className="font-display text-2xl">{g.resource_name}</CardTitle>
                  <div className="text-sm text-muted-foreground mt-1 font-mono">
                    {fmtDateTime(g.start_time)} → {g.end_time ? fmtDateTime(g.end_time) : "now"} · {fmtDuration(minutesBetween(g.start_time, g.end_time || new Date()))}
                  </div>
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-bold" data-testid={`game-players-${g.id}`}>
                      {(g.player_count || 1)} player{(g.player_count || 1) > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`text-[0.65rem] uppercase tracking-widest font-bold px-2 py-1 rounded ${
                    g.status === "active" ? "bg-primary/15 text-primary" :
                    g.status === "soft_closed" ? "bg-amber-500/15 text-amber-500" :
                    "bg-emerald-500/15 text-emerald-500"
                  }`}>{g.status}</span>
                  {!isBilled && g.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => { setEndGameOpen(g.id); setEndTime(toLocalInput()); }} data-testid={`end-${g.id}`}><StopCircle size={14}/> End</Button>
                  )}
                  {!isBilled && (
                    <Button size="sm" variant="outline" onClick={() => setItemPick({ open: true, gameId: g.id, type: "inventory", ref_id: "", qty: 1 })} data-testid={`add-item-${g.id}`}><ForkKnife size={14}/> Add Item</Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {g.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No snacks/accessories.</p>
              ) : (
                <ul className="space-y-1.5">
                  {g.items.map(it => (
                    <li key={it.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border/50 last:border-0" data-testid={`item-row-${it.id}`}>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`text-[0.6rem] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded shrink-0 ${it.type === "inventory" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>{it.type}</span>
                        <span className="truncate"><span className="font-medium">{it.name}</span> <span className="text-muted-foreground">× {it.qty}</span></span>
                      </div>
                      <span className="font-mono shrink-0">{fmtMoney(it.total)}</span>
                      {!isBilled && !isCancelled && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                          onClick={() => removeItem(g.id, it.id, it.name)}
                          title="Remove item"
                          data-testid={`remove-item-${it.id}`}
                        >
                          <Trash size={16} weight="bold" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isBilled && sess.bill_breakdown && (
        <Card>
          <CardHeader><CardTitle className="font-display">Bill</CardTitle></CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            <Row label="Game charges" value={fmtMoney(sess.bill_breakdown.games_total)} />
            <Row label="Items" value={fmtMoney(sess.bill_breakdown.items_total)} />
            <Row label="Subtotal" value={fmtMoney(sess.bill_breakdown.subtotal)} />
            <Row label="Adjustment" value={fmtMoney(sess.bill_breakdown.adjustment)} />
            <Row label="Total" value={fmtMoney(sess.bill_breakdown.grand_total)} bold />
            <div className="pt-3 border-t border-border space-y-1">
              {sess.payments.map((p, i) => <Row key={i} label={p.mode.toUpperCase()} value={fmtMoney(p.amount)} />)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Game */}
      <Dialog open={addGameOpen} onOpenChange={setAddGameOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add another game</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Resource</Label>
              <Select value={newGame.resource_id} onValueChange={v => {
                const pcs = playerCountsFor(v);
                setNewGame(f => ({ ...f, resource_id: v, player_count: pcs[0] || 1 }));
              }}>
                <SelectTrigger data-testid="add-game-res"><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>{availableResources.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Number of Players</Label>
              <Select value={String(newGame.player_count)} onValueChange={v => setNewGame(f => ({ ...f, player_count: Number(v) }))}>
                <SelectTrigger data-testid="add-game-players"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {playerCountsFor(newGame.resource_id).map(pc => (
                    <SelectItem key={pc} value={String(pc)}>{pc} player{pc > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Time</Label>
              <DateTimePicker value={newGame.start_time} onChange={(v) => setNewGame((f) => ({ ...f, start_time: v }))} data-testid="add-game-start"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGameOpen(false)}>Cancel</Button>
            <Button onClick={addGame} data-testid="add-game-save">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Game */}
      <Dialog open={!!endGameOpen} onOpenChange={(v) => !v && setEndGameOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">End game</DialogTitle></DialogHeader>
          <div>
            <Label>End Time</Label>
            <DateTimePicker value={endTime} onChange={setEndTime} data-testid="end-time-input"/>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndGameOpen(null)}>Cancel</Button>
            <Button onClick={endGame} data-testid="end-time-save">Soft Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item */}
      <Dialog open={itemPick.open} onOpenChange={(v) => setItemPick(s => ({ ...s, open: v }))}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={itemPick.type === "inventory" ? "default" : "outline"} onClick={() => setItemPick(s => ({ ...s, type: "inventory", ref_id: "" }))} data-testid="item-tab-inv">Snacks/Drinks</Button>
              <Button size="sm" variant={itemPick.type === "accessory" ? "default" : "outline"} onClick={() => setItemPick(s => ({ ...s, type: "accessory", ref_id: "" }))} data-testid="item-tab-acc">Accessories</Button>
            </div>
            <div>
              <Label>{itemPick.type === "inventory" ? "Item" : "Accessory"}</Label>
              <Select value={itemPick.ref_id} onValueChange={v => setItemPick(s => ({ ...s, ref_id: v }))}>
                <SelectTrigger data-testid="item-pick-select"><SelectValue placeholder="Select"/></SelectTrigger>
                <SelectContent>
                  {(itemPick.type === "inventory" ? inventory : accessories).map(it => (
                    <SelectItem key={it.id} value={it.id}>{it.name} — {fmtMoney(it.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} value={itemPick.qty} onChange={e => setItemPick(s => ({ ...s, qty: e.target.value }))} data-testid="item-qty-input"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemPick({ open: false, gameId: null, type: "inventory", ref_id: "", qty: 1 })}>Cancel</Button>
            <Button onClick={addItem} data-testid="item-add-save">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Billing */}
      <Dialog open={billingOpen} onOpenChange={setBillingOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-display">Final Bill — {sess.customer_name}</DialogTitle></DialogHeader>
          {recomputed && (
            <div className="space-y-4">
              <div className="border border-border rounded-md p-4 space-y-2 font-mono text-sm">
                {recomputed.games.map(g => (
                  <div key={g.game_session_id} className="border-b border-border pb-2 last:border-0">
                    <div className="flex justify-between font-bold"><span>{g.resource_name} ({g.game_type_name})</span><span>{fmtMoney(g.subtotal)}</span></div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(g.charge.billable_minutes)}min billable ({g.charge.weekday}) · {(g.charge.player_count || 1)} player{(g.charge.player_count || 1) > 1 ? "s" : ""} · {fmtMoney(g.charge.amount)}
                    </div>
                    {(g.charge.applied_grouped || []).map((s, i) => (
                      <div key={i} className="flex justify-between text-[0.7rem] ml-3">
                        <span>{s.duration}min × {s.count} <span className="text-muted-foreground">@ {fmtMoney(s.price)}</span></span>
                        <span className="font-mono">{fmtMoney(s.subtotal)}</span>
                      </div>
                    ))}
                    {g.items.map(it => (
                      <div key={it.id} className="flex justify-between text-xs ml-2">
                        <span>+ {it.name} × {it.qty}</span><span>{fmtMoney(it.total)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <Row label="Subtotal" value={fmtMoney(recomputed.subtotal)} />
                <div className="flex items-center justify-between gap-2">
                  <Label>Adjustment (+/-)</Label>
                  <Input type="number" value={adjustment} onChange={e => setAdjustment(e.target.value)} className="w-32" data-testid="bill-adjustment-input"/>
                </div>
                <Row label="GRAND TOTAL" value={fmtMoney(recomputed.grand_total)} bold />
              </div>
              <div className="space-y-2">
                <Label>Payment split</Label>
                {payments.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Select value={p.mode} onValueChange={v => setPayments(ps => ps.map((x, j) => j === i ? { ...x, mode: v } : x))}>
                      <SelectTrigger className="w-32" data-testid={`pay-mode-${i}`}><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent>
                    </Select>
                    <Input type="number" value={p.amount} onChange={e => setPayments(ps => ps.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} data-testid={`pay-amount-${i}`}/>
                    {payments.length > 1 && <Button size="icon" variant="ghost" onClick={() => setPayments(ps => ps.filter((_, j) => j !== i))}><Trash size={16}/></Button>}
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setPayments(ps => [...ps, { mode: "upi", amount: 0 }])} data-testid="add-payment-btn"><Plus size={14}/> Add split</Button>
                <div className="text-xs text-muted-foreground">
                  Paying: <span className="font-mono">{fmtMoney(paySum)}</span> · Required: <span className="font-mono">{fmtMoney(recomputed.grand_total)}</span>
                  {Math.abs(paySum - recomputed.grand_total) > 0.01 && <span className="text-destructive ml-2">amount mismatch</span>}
                </div>
              </div>
              <Input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} data-testid="bill-notes-input"/>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBillingOpen(false)}>Cancel</Button>
            <Button onClick={checkout} disabled={!recomputed || Math.abs(paySum - recomputed.grand_total) > 0.01} data-testid="checkout-btn">
              Close Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptPrint session={sess} cafe={cafe} />
    </div>
  );
}

function Row({ label, value, bold }) {
  return <div className={`flex justify-between ${bold ? "font-bold text-base" : ""}`}><span>{label}</span><span>{value}</span></div>;
}