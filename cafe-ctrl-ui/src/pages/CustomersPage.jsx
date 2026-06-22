import React, { useEffect, useState } from "react";
import { api, formatApiError, fmtMoney, fmtDateTime, fmtDuration, minutesBetween} from "../lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { User, Phone, Notebook, Clock, CheckCircle, Receipt, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

export default function CustomersPage() {
  const [activeTab, setActiveTab] = useState("directory"); 
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // --- NEW: Pagination State ---
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Data pools
  const [customers, setCustomers] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  
  // Drill-down inspection modals state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [activeReceipt, setActiveReceipt] = useState(null);
  
  // Debt settlement processing state
  const [settleTarget, setSettleTarget] = useState(null);
  const [settleSplits, setSettleSplits] = useState([{ mode: "upi", amount: 0 }]);
  const [settleNotes, setSettleNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "directory") {
        // UPDATED: Pass page and size parameters
        const { data } = await api.get(`/customers?page=${currentPage}&size=10`);
        
        // Handles both the new paginated map response or legacy flat list
        if (data && data.data) {
          setCustomers(data.data);
          setTotalPages(data.totalPages);
          setTotalItems(data.totalItems);
        } else {
          setCustomers(data || []);
          setTotalItems(data?.length || 0);
          setTotalPages(1);
        }
      } else {
        const { data } = await api.get("/customers/pending");
        setPendingList(data);
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const openSettleModal = (debtObj) => {
    setSettleTarget(debtObj);
    setSettleSplits([{ mode: "upi", amount: debtObj.amount }]);
    setSettleNotes("");
  };

  // UPDATED: Added currentPage to the dependency array so it re-fetches when page changes
  useEffect(() => { loadData(); }, [activeTab, currentPage]);

  const viewCustomerProfile = async (cust) => {
    try {
      const { data } = await api.get(`/customers/history?name=${encodeURIComponent(cust.name)}&phone=${cust.phone || ""}`);
      setCustomerHistory(data);
      setSelectedCustomer(cust);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const viewPendingBill = async (sessionId) => {
    try {
      const { data } = await api.get(`/sessions/${sessionId}`);
      setActiveReceipt(data);
    } catch (e) {
      toast.error(formatApiError(e) || "Could not load the original bill.");
    }
  };

  const executeSettlement = async () => {
    try {
      const filteredSplits = settleSplits.filter(p => Number(p.amount) > 0);
      
      // Bodyguard 1: Did they enter numbers?
      if (filteredSplits.length === 0) return toast.error("Enter at least one payment value");

      // Bodyguard 2: Does the math equal the exact debt?
      const totalAssigned = filteredSplits.reduce((sum, p) => sum + Number(p.amount), 0);
      if (Math.abs(totalAssigned - settleTarget.amount) > 0.01) {
        return toast.error(`Split math mismatch! You must assign exactly ${fmtMoney(settleTarget.amount)}`);
      }

      await api.post(`/pending-payments/${settleTarget.id}/clear`, { 
        payments: filteredSplits,
        notes: settleNotes 
      });

      toast.success("Debt settlement accounted and pushed to daily collection!");
      setSettleTarget(null);
      loadData();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const filteredDirectory = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label">Management Hub</div>
        <h1 className="text-4xl font-display font-extrabold">Customers & Accounts</h1>
      </div>

      {/* Tabs Menu Navigation Bar */}
      <div className="flex border-b border-border gap-6">
        <button 
          onClick={() => { setActiveTab("directory"); setSearchQuery(""); setCurrentPage(0); }}
          className={`pb-3 text-sm font-bold tracking-tight transition-all ${activeTab === "directory" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Customer Directory
        </button>
        <button 
          onClick={() => { setActiveTab("pending"); setSearchQuery(""); }}
          className={`pb-3 text-sm font-bold tracking-tight transition-all ${activeTab === "pending" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Outstanding Balances
        </button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Fetching structural records...</div>
      ) : activeTab === "directory" ? (
        /* TAB 1: CUSTOMER DIRECTORY SYSTEM LAYOUT */
        <div className="space-y-4">
          <Input 
            placeholder="Filter current page profiles by name or phone..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
          <Card className="border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="py-3 px-4">Customer profile</th>
                      <th className="py-3 px-4">Phone contact</th>
                      <th className="py-3 px-4 text-center">Lounge Visits</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredDirectory.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-semibold text-base flex items-center gap-2">
                          <User size={18} className="text-primary" /> {c.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">{c.phone || "—"}</td>
                        <td className="py-3 px-4 text-center font-bold">{c.totalVisits}</td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="outline" onClick={() => viewCustomerProfile(c)}>
                            <Notebook size={14} /> View History
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* NEW: Pagination Controls Footer */}
              <div className="flex items-center justify-between p-4 border-t border-border bg-muted/10">
                <span className="text-sm text-muted-foreground">
                  Page <span className="font-bold text-foreground">{currentPage + 1}</span> of {Math.max(1, totalPages)}
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-muted text-xs">
                    {totalItems} Total Records
                  </span>
                </span>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    disabled={currentPage === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      ) : (
        /* TAB 2: PENDING RECOVERY LEDGER CONTROL MATRIX */
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Debtor Account</th>
                    <th className="py-3 px-4">Origination Date</th>
                    <th className="py-3 px-4 text-right">Balance Owed</th>
                    <th className="py-3 px-4 text-center">Settlement Operation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {pendingList.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="py-3 px-4">
                        <div className="font-bold">{p.customerName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{p.customerPhone || "—"}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{fmtDateTime(p.createdAt)}</td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-amber-500">{fmtMoney(p.amount)}</td>
                      
                      <td className="py-3 px-4 text-center flex items-center justify-center gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          title="View Original Bill"
                          onClick={() => viewPendingBill(p.sessionId)}
                        >
                          <Receipt size={18} className="text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          onClick={() => openSettleModal(p)}
                        >
                          <CheckCircle size={14} /> Collect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: CUSTOMER TIMELINE HISTORY DRILLDOWN INSPECTOR */}
      <Dialog open={!!selectedCustomer} onOpenChange={v => !v && setSelectedCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display font-extrabold">Gaming History Logs</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="border border-border rounded-md p-4 bg-muted/30 flex gap-6 text-sm">
                <div className="flex items-center gap-1"><User size={16} className="text-primary"/> <b>{selectedCustomer.name}</b></div>
                <div className="flex items-center gap-1"><Phone size={16}/> <span className="font-mono">{selectedCustomer.phone || "—"}</span></div>
              </div>
              
              <div className="space-y-3">
                <div className="uppercase-label text-xs font-bold text-muted-foreground">Session Timeline Entries</div>
                {customerHistory.map(h => (
                  <div 
                    key={h.id} 
                    onClick={() => navigate(`/sessions/${h.id}`)}
                    className="border border-border rounded-md p-4 flex justify-between items-center bg-card hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-bold flex items-center gap-2 group-hover:text-primary transition-colors">
                        <Clock size={14}/> Billed Session
                        <span className={`text-[0.6rem] px-1.5 py-0.5 rounded uppercase font-bold tracking-widest ${h.status === 'billed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{h.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{fmtDateTime(h.created_at)} · Handled by {h.operator_name}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold">{fmtMoney(h.bill_total || 0)}</span>
                      {h.bill_breakdown && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={(e) => { 
                            e.stopPropagation();
                            setActiveReceipt(h); 
                          }}
                        >
                          <Receipt size={18} className="text-muted-foreground hover:text-primary"/>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

     {/* MODAL 2: SIMPLIFIED RECEIPT SUMMARY DIALOG */}
      <Dialog open={!!activeReceipt} onOpenChange={v => !v && setActiveReceipt(null)}>
        <DialogContent className="max-w-sm" data-testid="bill-detail-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">
              Bill Summary — {activeReceipt?.customer_name}
            </DialogTitle>
          </DialogHeader>
          
          {activeReceipt && (
            <div className="space-y-5 text-sm mt-2">
              <div className="flex justify-between text-[0.7rem] text-muted-foreground border-b border-border pb-3">
                <div className="space-y-0.5">
                  <div>{fmtDateTime(activeReceipt.billed_at || activeReceipt.created_at)}</div>
                  <div className="font-mono">Receipt #{activeReceipt.id.slice(0, 8).toUpperCase()}</div>
                </div>
                <div className="text-right space-y-0.5">
                  <div>Op: {activeReceipt.operator_name}</div>
                  <div className="font-mono">{activeReceipt.customer_phone || "—"}</div>
                </div>
              </div>

              <div className="bg-muted/40 p-6 rounded-lg text-center space-y-1 border border-border">
                <div className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Grand Total</div>
                <div className="text-4xl font-display font-bold text-primary">
                  {fmtMoney(activeReceipt.bill_breakdown?.grand_total || activeReceipt.bill_total || 0)}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[0.65rem] uppercase tracking-widest font-bold text-muted-foreground border-b border-border pb-1">
                  Settlement Ledger
                </div>
                {(activeReceipt.payments || []).map((p, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="uppercase tracking-wider font-medium">{p.mode}</span>
                    <span className="font-mono">{fmtMoney(p.amount)}</span>
                  </div>
                ))}
                {(!activeReceipt.payments || activeReceipt.payments.length === 0) && (
                  <div className="text-xs text-amber-500 italic">No payment splits recorded.</div>
                )}
              </div>

              {activeReceipt.notes && (
                <div className="text-[0.7rem] text-muted-foreground italic pt-2 border-t border-border">
                  Note: {activeReceipt.notes}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            {activeReceipt && (
              <Link to={`/sessions/${activeReceipt.id}`} className="w-full sm:w-auto">
                <Button className="w-full" data-testid="bill-detail-open-session">
                  Open Session
                </Button>
              </Link>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: MULTI-SPLIT DEBT SETTLEMENT PORTAL */}
      <Dialog open={!!settleTarget} onOpenChange={v => !v && setSettleTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              Settle Account — {settleTarget?.customerName}
            </DialogTitle>
          </DialogHeader>

          {settleTarget && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="flex justify-between items-center p-3 bg-muted/40 rounded-lg border border-border font-mono">
                <span className="text-muted-foreground uppercase text-xs">Total Outstanding</span>
                <span className="text-lg font-bold text-amber-500">{fmtMoney(settleTarget.amount)}</span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Collection Split</Label>
                {settleSplits.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Select value={p.mode} onValueChange={v => setSettleSplits(ps => ps.map((x, j) => j === i ? { ...x, mode: v } : x))}>
                      <SelectTrigger className="w-32" data-testid={`settle-mode-${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="pending">Pending (Carry Fwd)</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input 
                      type="number" 
                      min={0}
                      value={p.amount} 
                      onChange={e => setSettleSplits(ps => ps.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                      className="font-mono font-bold"
                    />

                    {settleSplits.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => setSettleSplits(ps => ps.filter((_, j) => j !== i))}>
                        <Trash size={16} className="text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button size="sm" variant="outline" className="w-full border-dashed mt-1" onClick={() => setSettleSplits(ps => [...ps, { mode: "cash", amount: 0 }])}>
                  <Plus size={14} className="mr-1" /> Add split
                </Button>

                {/* Operator Math Helper */}
                {(() => {
                  const paySum = settleSplits.reduce((a, p) => a + Number(p.amount || 0), 0);
                  const isBalanced = Math.abs(paySum - settleTarget.amount) < 0.01;
                  const realPaid = settleSplits.filter(x => x.mode !== "pending").reduce((a, p) => a + Number(p.amount || 0), 0);
                  const newDebt = settleSplits.filter(x => x.mode === "pending").reduce((a, p) => a + Number(p.amount || 0), 0);

                  return (
                    <div className="pt-2">
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>Assigned: <b className="font-mono text-foreground">{fmtMoney(paySum)}</b> / {fmtMoney(settleTarget.amount)}</span>
                        {!isBalanced && <span className="text-destructive font-bold animate-pulse">Unbalanced</span>}
                      </div>

                      {isBalanced && (
                        <div className="mt-2.5 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs flex justify-between font-medium text-emerald-600">
                          <span>Collecting Today: <b>{fmtMoney(realPaid)}</b></span>
                          <span>New tab balance: <b>{fmtMoney(newDebt)}</b></span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <Input 
                placeholder="Settlement notes (e.g. 'Promised rest on Friday')" 
                value={settleNotes} 
                onChange={e => setSettleNotes(e.target.value)} 
              />
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setSettleTarget(null)}>Cancel</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white" 
              onClick={executeSettlement}
              disabled={!settleTarget || Math.abs(settleSplits.reduce((a, p) => a + Number(p.amount || 0), 0) - settleTarget.amount) > 0.01}
            >
              Post Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}