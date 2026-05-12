import React from "react";
import { fmtMoney, fmtDateTime, fmtDuration, minutesBetween } from "../lib/apiClient";

export default function Receipt({ session, cafe, bill: liveBill, forceVisible = false }) {
  if (!session) return null;
  
  // 1. Identify the source of truth (Use liveBill if we are in the 'Billing' modal)
  const bill = liveBill || session.bill_breakdown || {};
  
  // Use games from the bill specifically because they contain the 'charge' calculation
  // If no bill games exist yet, fallback to session games
  const gamesList = (bill && bill.games && bill.games.length > 0) ? bill.games : session.games;

  if (!forceVisible && session.status !== "billed") return null;

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
      <div className="r-divider" />
      <div className="r-line"><span>Receipt</span><span>#{session.id.slice(0, 8).toUpperCase()}</span></div>
      <div className="r-line"><span>Date</span><span>{fmtDateTime(session.billed_at || session.created_at)}</span></div>
      <div className="r-line"><span>Customer</span><span>{session.customer_name}</span></div>
      <div className="r-divider" />

      {gamesList.map((g, idx) => {
        // Find the amount regardless of whether the key is 'charge.amount' or 'subtotal'
        const amount = g.charge?.amount || g.subtotal || 0;
        const pCount = g.charge?.player_count || g.player_count || 1;

        return (
          <div key={idx} style={{ marginBottom: 6 }}>
            <div className="b">{g.resource_name} — {g.game_type_name}</div>
            <div className="r-line">
              <span>{pCount}P · {fmtDuration(minutesBetween(g.start_time, g.end_time || new Date()))}</span>
              <span>{fmtMoney(amount)}</span>
            </div>
            {(g.items || []).map((it) => (
              <div className="r-line" key={it.id} style={{ fontSize: 10, paddingLeft: 8 }}>
                <span>{it.name} x{it.qty}</span><span>{fmtMoney(it.total)}</span>
              </div>
            ))}
          </div>
        );
      })}

      <div className="r-divider" />
      <div className="r-line"><span>Subtotal</span><span>{fmtMoney(bill.subtotal || 0)}</span></div>
      {bill.adjustment !== 0 && (
        <div className="r-line"><span>Adjustment</span><span>{fmtMoney(bill.adjustment || 0)}</span></div>
      )}
      <div className="r-line b" style={{ fontSize: 13 }}><span>TOTAL</span><span>{fmtMoney(bill.grand_total || 0)}</span></div>
      <div className="r-divider" />
      
      {(bill.payments || session.payments || []).map((p, i) => (
        <div className="r-line" key={i}><span>{p.mode.toUpperCase()}</span><span>{fmtMoney(p.amount)}</span></div>
      ))}
      <div className="center" style={{ marginTop: 8 }}>Thank you! Play on. ⚡</div>
    </div>
  );
}

export function buildReceiptText(session, cafe, liveBill) {
  if (!session) return "";
  const bill = liveBill || session.bill_breakdown || {};
  const gamesList = (bill && bill.games && bill.games.length > 0) ? bill.games : session.games;
  
  const L = [];
  L.push(`*${cafe?.name || "CafeCtrl"}*`);
  L.push(`Receipt #${session.id.slice(0, 8).toUpperCase()}`);
  L.push(`Customer: ${session.customer_name}`);
  L.push("─────────────");

  gamesList.forEach((g) => {
    const amount = g.charge?.amount || g.subtotal || 0;
    L.push(`${g.resource_name} (${g.game_type_name})`);
    L.push(`  ${fmtMoney(amount)} [${g.player_count || 1}P]`);
    (g.items || []).forEach(it => L.push(`  + ${it.name} x${it.qty}: ${fmtMoney(it.total)}`));
  });

  L.push("─────────────");
  L.push(`Subtotal: ${fmtMoney(bill.subtotal || 0)}`);
  if (bill.adjustment) L.push(`Adjustment: ${fmtMoney(bill.adjustment)}`);
  L.push(`*TOTAL: ${fmtMoney(bill.grand_total || 0)}*`);
  
  const payments = bill.payments || session.payments || [];
  payments.forEach(p => L.push(`${p.mode.toUpperCase()}: ${fmtMoney(p.amount)}`));
  
  return L.join("\n");
}