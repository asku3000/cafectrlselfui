import React from "react";
import { fmtMoney, fmtDateTime, fmtDuration, minutesBetween } from "../lib/apiClient";

/**
 * A printable, self-contained receipt. Visible only on print (or when forceVisible).
 * Use window.print() to trigger system dialog; the @media print rules show only this.
 */
export default function Receipt({ session, cafe, forceVisible = false }) {
  if (!session || session.status !== "billed") return null;
  const bill = session.bill_breakdown || {};
  return (
    <div className={`receipt-print ${forceVisible ? "force-visible" : ""}`} data-testid="receipt-print">
      <style>{`
        .receipt-print { display: none; }
        .receipt-print.force-visible { display: block; }
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body * { visibility: hidden !important; }
          .receipt-print, .receipt-print * { visibility: visible !important; }
          .receipt-print {
            display: block !important;
            position: absolute; left: 0; top: 0;
            width: 80mm;
            color: #000; background: #fff;
            font-family: 'JetBrains Mono', Courier, monospace;
            font-size: 11px; line-height: 1.5;
            padding: 0;
          }
        }
        .receipt-print .r-line { display: flex; justify-content: space-between; }
        .receipt-print .r-divider { border-top: 1px dashed #000; margin: 6px 0; }
        .receipt-print h2 { text-align: center; font-size: 16px; margin: 0 0 4px 0; font-weight: 800; }
        .receipt-print .center { text-align: center; }
        .receipt-print .b { font-weight: 700; }
      `}</style>
      <h2>{cafe?.name || "CafeCtrl"}</h2>
      {cafe?.phone && <div className="center">{cafe.phone}</div>}
      {cafe?.address && <div className="center">{cafe.address}</div>}
      <div className="r-divider" />
      <div className="r-line"><span>Receipt</span><span>#{session.id.slice(0, 8).toUpperCase()}</span></div>
      <div className="r-line"><span>Date</span><span>{fmtDateTime(session.billed_at)}</span></div>
      <div className="r-line"><span>Customer</span><span>{session.customer_name}</span></div>
      {session.customer_phone && <div className="r-line"><span>Phone</span><span>{session.customer_phone}</span></div>}
      <div className="r-line"><span>Cashier</span><span>{session.operator_name}</span></div>
      <div className="r-divider" />
      {(bill.games || []).map((g) => (
        <div key={g.game_session_id} style={{ marginBottom: 6 }}>
          <div className="b">{g.resource_name} — {g.game_type_name}</div>
          <div style={{ fontSize: 10 }}>
            {fmtDuration(minutesBetween(g.start_time, g.end_time))} billable · {(g.charge?.player_count || 1)}P
          </div>
          {(g.charge.applied_grouped || []).map((s, i) => (
            <div className="r-line" key={i} style={{ fontSize: 10 }}>
              <span>  {s.duration}min × {s.count}</span><span>{fmtMoney(s.subtotal)}</span>
            </div>
          ))}
          <div className="r-line"><span>  Game charge</span><span>{fmtMoney(g.charge.amount)}</span></div>
          {(g.items || []).map((it) => (
            <div className="r-line" key={it.id}>
              <span>  {it.name} × {it.qty}</span><span>{fmtMoney(it.total)}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="r-divider" />
      <div className="r-line"><span>Subtotal</span><span>{fmtMoney(bill.subtotal)}</span></div>
      {bill.adjustment !== 0 && <div className="r-line"><span>Adjustment</span><span>{fmtMoney(bill.adjustment)}</span></div>}
      <div className="r-line b" style={{ fontSize: 13, marginTop: 4 }}><span>TOTAL</span><span>{fmtMoney(bill.grand_total)}</span></div>
      <div className="r-divider" />
      {(session.payments || []).map((p, i) => (
        <div className="r-line" key={i}><span>{p.mode.toUpperCase()}</span><span>{fmtMoney(p.amount)}</span></div>
      ))}
      <div className="r-divider" />
      {session.notes && <div style={{ fontSize: 10 }}>Note: {session.notes}</div>}
      <div className="center" style={{ marginTop: 8 }}>Thank you! Play on. ⚡</div>
    </div>
  );
}

/** Build plain-text receipt suitable for WhatsApp / SMS */
export function buildReceiptText(session, cafe) {
  if (!session) return "";
  const bill = session.bill_breakdown || {};
  const L = [];
  L.push(`*${cafe?.name || "CafeCtrl"}*`);
  if (cafe?.phone) L.push(cafe.phone);
  L.push(`Receipt #${session.id.slice(0, 8).toUpperCase()}`);
  L.push(`Date: ${fmtDateTime(session.billed_at)}`);
  L.push(`Customer: ${session.customer_name}`);
  L.push("─────────────");
  (bill.games || []).forEach((g) => {
    L.push(`${g.resource_name} (${g.game_type_name}) · ${(g.charge?.player_count || 1)}P`);
    L.push(`  ${fmtDuration(minutesBetween(g.start_time, g.end_time))} → ${fmtMoney(g.charge.amount)}`);
    (g.items || []).forEach((it) => L.push(`  + ${it.name} × ${it.qty} = ${fmtMoney(it.total)}`));
  });
  L.push("─────────────");
  L.push(`Subtotal: ${fmtMoney(bill.subtotal)}`);
  if (bill.adjustment !== 0) L.push(`Adjustment: ${fmtMoney(bill.adjustment)}`);
  L.push(`*TOTAL: ${fmtMoney(bill.grand_total)}*`);
  (session.payments || []).forEach((p) => L.push(`${p.mode.toUpperCase()}: ${fmtMoney(p.amount)}`));
  L.push("");
  L.push("Thank you! Play on. ⚡");
  return L.join("\n");
}