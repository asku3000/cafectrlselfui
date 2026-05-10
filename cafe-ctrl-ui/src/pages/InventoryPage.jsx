import React, { useEffect, useState } from "react";
import { api, formatApiError, fmtMoney } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

const CATEGORIES = ["snack", "drink", "other"];

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "cafe_admin";
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category: "snack", price: 0, stock: 0 });

  const load = async () => { try { const { data } = await api.get("/inventory"); setItems(data); } catch (e) { toast.error(formatApiError(e)); } };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", category: "snack", price: 0, stock: 0 }); setOpen(true); };
  const openEdit = (it) => { setEditing(it); setForm({ ...it }); setOpen(true); };

  const save = async () => {
    try {
      const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
      if (editing) await api.put(`/inventory/${editing.id}`, payload);
      else await api.post("/inventory", payload);
      setOpen(false); load(); toast.success("Saved");
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const remove = async (id) => { try { await api.delete(`/inventory/${id}`); load(); } catch (e) { toast.error(formatApiError(e)); } };

  return (
    <div className="space-y-6" data-testid="inventory-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Cafe</div>
          <h1 className="text-4xl font-display font-extrabold">Inventory</h1>
          <p className="text-muted-foreground mt-2">Snacks, drinks, and other items sold during sessions.</p>
        </div>
        {isAdmin && <Button onClick={openNew} data-testid="inv-new-btn"><Plus size={18}/> Add Item</Button>}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left uppercase-label border-b border-border">
                  <th className="py-3">Name</th><th>Category</th><th>Price</th><th>Stock</th>{isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} className="border-b border-border" data-testid={`inv-${it.id}`}>
                    <td className="py-3 font-semibold">{it.name}</td>
                    <td className="capitalize">{it.category}</td>
                    <td className="font-mono">{fmtMoney(it.price)}</td>
                    <td className="font-mono">{it.stock}</td>
                    {isAdmin && (
                      <td className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(it)}><PencilSimple size={16}/></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(it.id)}><Trash size={16}/></Button>
                      </td>
                    )}
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">No inventory yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit" : "New"} Inventory</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="inv-name-input"/></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="inv-cat-select"><SelectValue/></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} data-testid="inv-price-input"/></div>
              <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} data-testid="inv-stock-input"/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} data-testid="inv-save-btn">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
