import React, { useEffect, useState } from "react";
import { api, formatApiError, fmtMoney } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Plus, Trash, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import LocalSearchableSelect from "../components/LocalSearchableSelect"; // Ensure this path is correct!

const CATEGORIES = ["snack", "drink", "ingredient", "other"];

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "CAFE_ADMIN";
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  
  // Added ingredients array to the base form state
  const [form, setForm] = useState({ 
    name: "", category: "snack", price: 0, stock: 0, is_trackable: true, ingredients: [] 
  });

  const load = async () => { 
  try { 
    const { data } = await api.get("/inventory"); 
    // Check if it's an array. If Spring Boot wrapped it in a Page, use data.content
    if (Array.isArray(data)) {
      setItems(data);
    } else if (data && Array.isArray(data.content)) {
      setItems(data.content);
    } else {
      console.error("Expected an array but got:", data);
      setItems([]); // Fallback to safe empty array
    }
  } catch (e) { 
    toast.error(formatApiError(e)); 
    setItems([]); 
  } 
};
  
  useEffect(() => { load(); }, []);

  const openNew = () => { 
    setEditing(null); 
    setForm({ name: "", category: "snack", price: 0, stock: 0, is_trackable: true, ingredients: [] }); 
    setOpen(true); 
  };
  
  const openEdit = (it) => { 
    setEditing(it); 
    setForm({ 
      ...it, 
      is_trackable: it.is_trackable !== false,
      ingredients: it.ingredients || [] 
    }); 
    setOpen(true); 
  };

  // Recipe Builder Helpers
  const addIngredient = () => {
    setForm(f => ({ ...f, ingredients: [...(f.ingredients || []), { raw_material_id: "", qty: 1 }] }));
  };

  const updateIngredient = (index, field, value) => {
    setForm(f => {
      const newIngs = [...(f.ingredients || [])];
      newIngs[index] = { ...newIngs[index], [field]: value };
      return { ...f, ingredients: newIngs };
    });
  };

  const removeIngredient = (index) => {
    setForm(f => {
      const newIngs = [...(f.ingredients || [])];
      newIngs.splice(index, 1);
      return { ...f, ingredients: newIngs };
    });
  };

  const save = async () => {
    try {
      // Map the frontend state into the payload your Java backend expects
      const payload = { 
        ...form, 
        price: Number(form.price), 
        stock: form.is_trackable ? Number(form.stock) : 0,
        ingredients: form.is_trackable ? [] : (form.ingredients || []).map(ing => ({
           raw_material_id: ing.raw_material_id,
           quantity_required: Number(ing.qty)
        }))
      };
      
      if (editing) await api.put(`/inventory/${editing.id}`, payload);
      else await api.post("/inventory", payload);
      
      setOpen(false); 
      load(); 
      toast.success("Saved");
    } catch (e) { 
      toast.error(formatApiError(e)); 
    }
  };
  
  const remove = async (id) => { 
    try { 
      await api.delete(`/inventory/${id}`); 
      load(); 
    } catch (e) { 
      toast.error(formatApiError(e)); 
    } 
  };

  // Generate the options for the Recipe Builder dropdown (only show trackable items)
  const trackableOptions = (Array.isArray(items) ? items : [])
  .filter(it => it.is_trackable !== false && it.id !== editing?.id)
  .map(it => ({ value: it.id, label: `${it.name} (${it.stock} in stock)` }));
  
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
                  <tr key={it.id} className="border-b border-border hover:bg-muted/50 transition-colors" data-testid={`inv-${it.id}`}>
                    <td className="py-3 font-semibold">
                      {it.name}
                      {it.is_trackable === false && it.ingredients?.length > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Recipe</span>
                      )}
                    </td>
                    <td className="capitalize">{it.category}</td>
                    <td className="font-mono">{fmtMoney(it.price)}</td>
                    <td className="font-mono">
                      {it.is_trackable !== false ? (
                        it.stock
                      ) : (
                        <span className="text-xl leading-none text-muted-foreground" title="Untracked Item">∞</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(it)}><PencilSimple size={16}/></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(it.id)}><Trash size={16}/></Button>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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

            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4 shadow-sm">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Track Inventory</Label>
                <p className="text-xs text-muted-foreground">
                  Disable for services or prepared menu items.
                </p>
              </div>
              <Switch
                checked={form.is_trackable}
                onCheckedChange={v => setForm(f => ({ ...f, is_trackable: v }))}
                data-testid="inv-trackable-switch"
              />
            </div>

            <div className={`grid ${form.is_trackable ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              <div><Label>Price</Label><Input type="number" min={0} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} data-testid="inv-price-input"/></div>
              
              {form.is_trackable && (
                <div><Label>Initial Stock</Label><Input type="number" min={0} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} data-testid="inv-stock-input"/></div>
              )}
            </div>

            {/* RECIPE BUILDER UI */}
            {!form.is_trackable && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/20 space-y-4">
                <div>
                  <Label className="text-base font-medium">Recipe / Ingredients</Label>
                  <p className="text-xs text-muted-foreground">
                    What raw materials should be deducted when this is sold?
                  </p>
                </div>

                {(form.ingredients || []).map((ing, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <LocalSearchableSelect 
                        options={trackableOptions} 
                        value={ing.raw_material_id}
                        onValueChange={(val) => updateIngredient(index, "raw_material_id", val)}
                        placeholder="Select raw material..."
                      />
                    </div>
                    <Input 
                      type="number" 
                      min={0.1}
                      step="0.1" 
                      className="w-24" 
                      value={ing.qty} 
                      onChange={(e) => updateIngredient(index, "qty", e.target.value)} 
                      placeholder="Qty" 
                    />
                    <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeIngredient(index)}>
                      <Trash size={16}/>
                    </Button>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addIngredient} className="w-full">
                  <Plus size={16} className="mr-2"/> Add Ingredient
                </Button>
              </div>
            )}

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