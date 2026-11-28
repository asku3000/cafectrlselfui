import React, { useEffect, useState } from "react";
import { api, formatApiError, fmtPaise, parseHundredths, hundredthsToInput } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Plus, PencilSimple, IdentificationCard, ClockCounterClockwise } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const DEFAULT_COLOR = "#3B82F6";
const EMPTY_FORM = {
  name: "", load: "", bonus_type: "FIXED", bonus: "0", validity_days: "30",
  color: DEFAULT_COLOR, badge: "", sort_order: "0", description: "", is_active: true,
};

// Bonus preview using the same rule as the backend: FIXED = paise, PERCENT = basis points, half-up.
function previewBonus(loadPaise, type, value) {
  if (loadPaise == null || value == null || value <= 0) return 0;
  if (type === "FIXED") return value;
  return Math.floor((loadPaise * value + 5000) / 10000);
}

export default function MembershipPlansPage() {
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([api.get("/membership/plans"), api.get("/membership/settings")]);
      setPlans(p.data);
      setSettings(s.data);
      setSettingsForm({
        deduction_order: s.data.deduction_order,
        low_balance: hundredthsToInput(s.data.low_balance_threshold_paise),
        card_number_prefix: s.data.card_number_prefix,
      });
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sort_order: String(plans.length) });
    setOpen(true);
  };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      load: hundredthsToInput(p.load_amount_paise),
      bonus_type: p.bonus_type,
      bonus: hundredthsToInput(p.bonus_value),
      validity_days: String(p.validity_days),
      color: p.color || DEFAULT_COLOR,
      badge: p.badge || "",
      sort_order: String(p.sort_order ?? 0),
      description: p.description || "",
      is_active: p.is_active,
    });
    setOpen(true);
  };

  const loadPaise = parseHundredths(form.load);
  const bonusValue = parseHundredths(form.bonus);
  const bonusPreview = previewBonus(loadPaise, form.bonus_type, bonusValue);

  const save = async () => {
    if (saving) return;
    if (!form.name.trim()) return toast.error("Plan name is required");
    if (loadPaise == null || loadPaise <= 0) return toast.error("Enter a valid load amount (max 2 decimals)");
    if (bonusValue == null || bonusValue < 0) return toast.error("Enter a valid bonus (max 2 decimals)");
    const validity = parseInt(form.validity_days, 10);
    if (!Number.isInteger(validity) || validity < 1) return toast.error("Validity must be at least 1 day");

    const payload = {
      name: form.name.trim(),
      load_amount_paise: loadPaise,
      bonus_type: form.bonus_type,
      bonus_value: bonusValue,
      validity_days: validity,
      color: form.color,
      badge: form.badge,
      sort_order: parseInt(form.sort_order, 10) || 0,
      description: form.description,
      is_active: form.is_active,
    };
    try {
      setSaving(true);
      if (editing) await api.put(`/membership/plans/${editing.id}`, payload);
      else await api.post("/membership/plans", payload);
      setOpen(false);
      load();
      toast.success(editing ? "Plan updated — cards already sold keep their original terms" : "Plan created");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const toggleActive = async (p) => {
    try {
      await api.patch(`/membership/plans/${p.id}/active`, { active: !p.is_active });
      load();
      toast.success(p.is_active ? `${p.name} deactivated — existing cards keep working` : `${p.name} is on sale again`);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const saveSettings = async () => {
    const threshold = parseHundredths(settingsForm.low_balance);
    if (threshold == null || threshold < 0) return toast.error("Enter a valid low-balance amount");
    try {
      await api.put("/membership/settings", {
        deduction_order: settingsForm.deduction_order,
        low_balance_threshold_paise: threshold,
        card_number_prefix: settingsForm.card_number_prefix,
      });
      load();
      toast.success("Membership settings saved");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="membership-plans-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Setup</div>
          <h1 className="text-4xl font-display font-extrabold">Membership Plans</h1>
          <p className="text-muted-foreground mt-2">Prepaid plans customers can buy. Editing a plan never changes cards already sold.</p>
        </div>
        <Button onClick={openNew} data-testid="plan-new-btn"><Plus size={18}/> New Plan</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(p => (
          <Card key={p.id} className={`hover-lift overflow-hidden ${p.is_active ? "" : "opacity-60"}`} data-testid={`plan-${p.id}`}>
            <div className="h-1.5" style={{ background: p.color || DEFAULT_COLOR }} />
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-xl">{p.name}</span>
                    {p.badge && (
                      <span className="text-[0.6rem] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ background: p.color || DEFAULT_COLOR }}>{p.badge}</span>
                    )}
                  </div>
                  {!p.is_active && <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mt-1">Not on sale</div>}
                </div>
                <div className="flex shrink-0">
                  <Button size="icon" variant="ghost" asChild title="History" data-testid={`plan-history-${p.id}`}>
                    <Link to={`/audit-log?entity_type=MEMBERSHIP_PLAN&entity_id=${p.id}`}><ClockCounterClockwise size={18}/></Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`plan-edit-${p.id}`}><PencilSimple size={18}/></Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Pay" value={fmtPaise(p.load_amount_paise)} />
                <Stat label={p.bonus_type === "PERCENT" ? `Bonus ${hundredthsToInput(p.bonus_value)}%` : "Bonus"} value={fmtPaise(p.bonus_amount_paise)} />
                <Stat label="Gets" value={fmtPaise(p.total_value_paise)} strong />
              </div>
              <div className="text-sm text-muted-foreground">Valid {p.validity_days} day{p.validity_days > 1 ? "s" : ""}</div>
              {p.description && <p className="text-sm whitespace-pre-line">{p.description}</p>}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm">On sale</span>
                <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} data-testid={`plan-active-${p.id}`} />
              </div>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="pt-6 flex items-center gap-3 text-muted-foreground">
              <IdentificationCard size={28} weight="duotone"/> No plans yet. Create your first one, e.g. "Silver — pay ₹1000, get 10% extra, valid 90 days".
            </CardContent>
          </Card>
        )}
      </div>

      {settingsForm && (
        <Card>
          <CardHeader><CardTitle className="font-display">Membership settings</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Card payments use first</Label>
              <Select value={settingsForm.deduction_order} onValueChange={v => setSettingsForm(f => ({ ...f, deduction_order: v }))}>
                <SelectTrigger data-testid="settings-deduction-order"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID_FIRST">Paid balance, then bonus</SelectItem>
                  <SelectItem value="BONUS_FIRST">Bonus balance, then paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Low-balance warning at (₹)</Label>
              <Input inputMode="decimal" value={settingsForm.low_balance} onChange={e => setSettingsForm(f => ({ ...f, low_balance: e.target.value }))} data-testid="settings-low-balance"/>
            </div>
            <div>
              <Label>Card number prefix</Label>
              <Input value={settingsForm.card_number_prefix} maxLength={10}
                     onChange={e => setSettingsForm(f => ({ ...f, card_number_prefix: e.target.value.toUpperCase() }))} data-testid="settings-prefix"/>
              <div className="text-xs text-muted-foreground mt-1">New cards look like {settingsForm.card_number_prefix || "MC"}-000123</div>
            </div>
            <div className="md:col-span-3 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">
                {settings?.updated_by_name ? `Last changed by ${settings.updated_by_name}` : "Using default settings"}
              </span>
              <Button onClick={saveSettings} data-testid="settings-save-btn">Save settings</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{editing ? `Edit ${editing.name}` : "New membership plan"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div><Label>Name</Label><Input value={form.name} maxLength={60} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Silver" data-testid="plan-name"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Customer pays (₹)</Label><Input inputMode="decimal" value={form.load} onChange={e => setForm(f => ({ ...f, load: e.target.value }))} data-testid="plan-load"/></div>
              <div><Label>Validity (days)</Label><Input inputMode="numeric" value={form.validity_days} onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))} data-testid="plan-validity"/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bonus type</Label>
                <Select value={form.bonus_type} onValueChange={v => setForm(f => ({ ...f, bonus_type: v }))}>
                  <SelectTrigger data-testid="plan-bonus-type"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed amount (₹)</SelectItem>
                    <SelectItem value="PERCENT">Percentage of load (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{form.bonus_type === "PERCENT" ? "Bonus (%)" : "Bonus (₹)"}</Label>
                <Input inputMode="decimal" value={form.bonus} onChange={e => setForm(f => ({ ...f, bonus: e.target.value }))} data-testid="plan-bonus"/>
              </div>
            </div>
            <div className="rounded-md bg-secondary px-3 py-2 text-sm" data-testid="plan-preview">
              {loadPaise != null && loadPaise > 0
                ? <>Customer pays <b>{fmtPaise(loadPaise)}</b>, card gets <b>{fmtPaise(loadPaise + bonusPreview)}</b> ({fmtPaise(bonusPreview)} bonus)</>
                : "Enter the load amount to see what the customer gets."}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Colour</Label>
                <Input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value.toUpperCase() }))} className="h-10 p-1" data-testid="plan-color"/>
              </div>
              <div><Label>Badge</Label><Input value={form.badge} maxLength={40} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} placeholder="Popular" data-testid="plan-badge"/></div>
              <div><Label>Sort order</Label><Input inputMode="numeric" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} data-testid="plan-sort"/></div>
            </div>
            <div><Label>Description / perks</Label><Textarea value={form.description} maxLength={1000} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} data-testid="plan-description"/></div>
            <label className="flex items-center justify-between">
              <span className="text-sm">On sale</span>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} data-testid="plan-form-active"/>
            </label>
            {editing && <p className="text-xs text-muted-foreground">Changes apply only to cards sold from now on.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} data-testid="plan-save-btn">{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, strong }) {
  return (
    <div className="rounded-md bg-secondary/60 py-2">
      <div className="text-[0.6rem] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      <div className={`font-mono text-sm ${strong ? "font-bold" : ""}`}>{value}</div>
    </div>
  );
}
