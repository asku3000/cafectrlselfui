import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatApiError, todayISO } from "../lib/apiClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import DateTimePicker from "../components/DateTimePicker";
import LocalSearchableSelect from "../components/LocalSearchableSelect";
import { ClipboardText, DownloadSimple, CaretLeft, CaretRight, MagnifyingGlass, X, Broom } from "@phosphor-icons/react";
import { toast } from "sonner";

const PAGE_SIZE = 50;
const ANY = "__any";
// Filter keys kept in the URL, so History links and browser back/forward work
const KEYS = ["from", "to", "actor_user_id", "action", "entity_type", "entity_id", "q", "outcome"];

/** UTC ISO instant from the API -> what the cafe sees (IST). */
export function fmtIst(iso, withSeconds = true) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}), hour12: false,
  });
}

const pretty = (s) => String(s || "").replaceAll("_", " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());

/** Where an entity lives in the app, if it has a page. */
function entityLink(type, id) {
  if (!id) return null;
  if (type === "SESSION") return `/sessions/${id}`;
  if (type === "MEMBERSHIP_CARD") return `/memberships/${id}`;
  if (type === "MEMBERSHIP_PLAN") return "/membership-plans";
  return null;
}

export default function AuditLogPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => Object.fromEntries(KEYS.map(k => [k, params.get(k) || ""])), [params]);
  const page = Math.max(0, parseInt(params.get("page") || "0", 10) || 0);

  const [facets, setFacets] = useState({ actions: [], entity_types: [], actors: [] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [text, setText] = useState(filters.q);
  const [entityIdText, setEntityIdText] = useState(filters.entity_id);
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api.get("/audit-log/facets").then(({ data }) => setFacets(data)).catch(e => toast.error(formatApiError(e)));
  }, []);

  // Keep the typed boxes in sync when the URL changes (History link, back button)
  useEffect(() => { setText(filters.q); setEntityIdText(filters.entity_id); }, [filters.q, filters.entity_id]);

  const queryParams = () => {
    const p = {};
    KEYS.forEach(k => { if (filters[k]) p[k] = filters[k]; });
    return p;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get("/audit-log", { params: { ...queryParams(), page, size: PAGE_SIZE } })
      .then(({ data }) => { if (!cancelled) setData(data); })
      .catch(e => { if (!cancelled) toast.error(formatApiError(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, reloadKey]);

  const setFilter = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k); });
    next.delete("page");
    setParams(next);
  };
  const setPage = (p) => {
    const next = new URLSearchParams(params);
    if (p > 0) next.set("page", String(p)); else next.delete("page");
    setParams(next);
  };
  const clearAll = () => { setText(""); setEntityIdText(""); setParams(new URLSearchParams()); };

  const today = todayISO();
  const presets = [
    { label: "Today", from: `${today}T00:00`, to: null },
    { label: "Last 24 h", from: (() => { const d = new Date(Date.now() - 864e5); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; })(), to: null },
    { label: "All", from: null, to: null },
  ];

  const exportCsv = async () => {
    if (exporting) return;
    try {
      setExporting(true);
      const res = await api.get("/audit-log/export", { params: queryParams(), responseType: "blob" });
      const name = /filename="?([^";]+)"?/.exec(res.headers["content-disposition"] || "")?.[1] || "audit-log.csv";
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      if (res.headers["x-export-truncated"] === "true") toast.warning("Export was capped at 50,000 rows. Narrow the filters to get the rest.");
      else toast.success("Exported");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setExporting(false); }
  };

  const actionOptions = facets.actions.map(a => ({ value: a, label: pretty(a) }));
  const filtered = KEYS.some(k => filters[k]);

  return (
    <div className="space-y-6" data-testid="audit-log-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Security</div>
          <h1 className="text-4xl font-display font-extrabold">Audit Log</h1>
          <p className="text-muted-foreground mt-2">Every change made in the app: who, what, when (IST) and from where.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={exporting} data-testid="audit-export-btn">
          <DownloadSimple size={16}/> {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <Label>From (IST)</Label>
              <DateTimePicker value={filters.from} onChange={v => setFilter({ from: v ? v.substring(0, 16) : "" })} data-testid="audit-from"/>
            </div>
            <div>
              <Label>To (IST)</Label>
              <DateTimePicker value={filters.to} onChange={v => setFilter({ to: v ? v.substring(0, 16) : "" })} data-testid="audit-to"/>
            </div>
            <div>
              <Label>Staff</Label>
              <Select value={filters.actor_user_id || ANY} onValueChange={v => setFilter({ actor_user_id: v === ANY ? "" : v })}>
                <SelectTrigger data-testid="audit-actor"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Anyone</SelectItem>
                  {facets.actors.map(a => <SelectItem key={a.id} value={a.id}>{a.name}{a.role ? ` (${a.role})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Action</Label>
              <div className="flex gap-1">
                <div className="flex-1 min-w-0">
                  <LocalSearchableSelect options={actionOptions} value={filters.action} placeholder="Any action"
                                         onValueChange={v => setFilter({ action: v })}/>
                </div>
                {filters.action && <Button size="icon" variant="ghost" onClick={() => setFilter({ action: "" })} title="Clear"><X size={14}/></Button>}
              </div>
            </div>
            <div>
              <Label>Entity type</Label>
              <Select value={filters.entity_type || ANY} onValueChange={v => setFilter({ entity_type: v === ANY ? "" : v })}>
                <SelectTrigger data-testid="audit-entity-type"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {facets.entity_types.map(t => <SelectItem key={t} value={t}>{pretty(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entity id</Label>
              <Input value={entityIdText} placeholder="exact id" onChange={e => setEntityIdText(e.target.value)}
                     onBlur={() => entityIdText !== filters.entity_id && setFilter({ entity_id: entityIdText.trim() })}
                     onKeyDown={e => e.key === "Enter" && setFilter({ entity_id: entityIdText.trim() })} data-testid="audit-entity-id"/>
            </div>
            <div>
              <Label>Search</Label>
              <div className="relative">
                <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <Input className="pl-8" value={text} placeholder="description, name, reason"
                       onChange={e => setText(e.target.value)}
                       onBlur={() => text !== filters.q && setFilter({ q: text.trim() })}
                       onKeyDown={e => e.key === "Enter" && setFilter({ q: text.trim() })} data-testid="audit-search"/>
              </div>
            </div>
            <div>
              <Label>Outcome</Label>
              <Select value={filters.outcome || ANY} onValueChange={v => setFilter({ outcome: v === ANY ? "" : v })}>
                <SelectTrigger data-testid="audit-outcome"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILURE">Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {presets.map(p => (
              <Button key={p.label} size="sm" variant="ghost" onClick={() => setFilter({ from: p.from || "", to: p.to || "" })}>{p.label}</Button>
            ))}
            {filtered && <Button size="sm" variant="outline" onClick={clearAll} data-testid="audit-clear"><X size={14}/> Clear filters</Button>}
            <span className="text-xs text-muted-foreground ml-auto">{loading ? "Loading…" : data ? `${data.total.toLocaleString("en-IN")} entr${data.total === 1 ? "y" : "ies"}` : ""}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">Time (IST)</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">What happened</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map(e => (
                <tr key={e.id} onClick={() => setSelected(e.id)} className="border-b border-border/60 last:border-0 hover:bg-secondary cursor-pointer align-top"
                    data-testid={`audit-row-${e.id}`}>
                  <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs">{fmtIst(e.occurred_at)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="font-medium">{e.actor_name || "—"}</div>
                    <div className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">{e.actor_type === "SYSTEM" ? "System" : e.actor_role || ""}</div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="text-[0.65rem] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-secondary">{pretty(e.action)}</span>
                    {e.entity_type && <div className="text-xs text-muted-foreground mt-1">{pretty(e.entity_type)}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div>{e.description || "—"}</div>
                    {e.reason && <div className="text-xs text-muted-foreground mt-0.5">Reason: {e.reason}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[0.65rem] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
                      e.outcome === "FAILURE" ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-500"}`}>
                      {e.outcome === "FAILURE" ? "Failed" : "OK"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && data && data.items.length === 0 && (
            <div className="p-6 flex items-center gap-3 text-muted-foreground">
              <ClipboardText size={28} weight="duotone"/> {filtered ? "No entries match these filters." : "No activity recorded yet."}
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} data-testid="audit-prev"><CaretLeft size={14}/> Newer</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {data.total_pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= data.total_pages} onClick={() => setPage(page + 1)} data-testid="audit-next">Older <CaretRight size={14}/></Button>
        </div>
      )}

      <RetentionPanel onPurged={() => setReloadKey(k => k + 1)} />

      <AuditDetailDialog id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AuditDetailDialog({ id, onClose }) {
  const [e, setE] = useState(null);

  useEffect(() => {
    if (id == null) { setE(null); return; }
    api.get(`/audit-log/${id}`).then(({ data }) => setE(data)).catch(err => { toast.error(formatApiError(err)); onClose(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const link = e ? entityLink(e.entity_type, e.entity_id) : null;
  const changes = e?.changes ? Object.entries(e.changes) : [];

  return (
    <Dialog open={id != null} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="audit-detail">
        <DialogHeader><DialogTitle className="font-display">{e ? pretty(e.action) : "Loading…"}</DialogTitle></DialogHeader>
        {e && (
          <div className="space-y-4 text-sm">
            <p className="text-base">{e.description || "—"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <Field label="When (IST)" value={fmtIst(e.occurred_at)} />
              <Field label="Result" value={e.outcome === "FAILURE" ? "Failed" : "Succeeded"} accent={e.outcome === "FAILURE" ? "text-destructive font-semibold" : ""} />
              <Field label="Who" value={`${e.actor_name || "—"}${e.actor_type === "SYSTEM" ? " (system job)" : e.actor_role ? ` (${e.actor_role})` : ""}`} />
              <Field label="Entity" value={e.entity_type ? `${pretty(e.entity_type)}${e.entity_id ? " · " + e.entity_id : ""}` : "—"} mono />
              {e.reason && <Field label="Reason" value={e.reason} wide />}
              <Field label="IP address" value={e.ip_address || "—"} mono />
              <Field label="Request id" value={e.request_id || "—"} mono />
              <Field label="Device" value={e.user_agent || "—"} wide />
            </div>
            {link && (
              <div className="flex gap-3 flex-wrap">
                <Link to={link} className="underline text-primary" onClick={onClose}>Open {pretty(e.entity_type).toLowerCase()}</Link>
                <Link to={`/audit-log?entity_type=${e.entity_type}&entity_id=${encodeURIComponent(e.entity_id)}`} className="underline" onClick={onClose}>Full history</Link>
              </div>
            )}

            {changes.length > 0 && (
              <div>
                <div className="uppercase-label mb-1">Changes</div>
                <table className="w-full text-xs border border-border rounded" data-testid="audit-diff">
                  <thead><tr className="text-left bg-secondary"><th className="px-2 py-1.5">Field</th><th className="px-2 py-1.5">Before</th><th className="px-2 py-1.5">After</th></tr></thead>
                  <tbody>
                    {changes.map(([field, pair]) => {
                      const masked = pair === "***";
                      return (
                        <tr key={field} className="border-t border-border align-top">
                          <td className="px-2 py-1.5 font-medium whitespace-nowrap">{pretty(field)}</td>
                          {masked ? (
                            <td colSpan={2} className="px-2 py-1.5 text-muted-foreground italic">changed (hidden)</td>
                          ) : (
                            <>
                              <td className="px-2 py-1.5 font-mono text-destructive break-all"><Val v={pair?.before}/></td>
                              <td className="px-2 py-1.5 font-mono text-emerald-600 break-all"><Val v={pair?.after}/></td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {e.details && Object.keys(e.details).length > 0 && (
              <div>
                <div className="uppercase-label mb-1">Details</div>
                <pre className="text-xs bg-secondary rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(e.details, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "Kept for N days" + dry run / purge now. A cafe admin's purge only covers their own cafe. */
function RetentionPanel({ onPurged }) {
  const [info, setInfo] = useState(null);
  const [preview, setPreview] = useState(null); // dry-run result shown in the confirm dialog
  const [busy, setBusy] = useState(false);

  const loadInfo = () => api.get("/audit-log/purge").then(({ data }) => setInfo(data)).catch(() => {});
  useEffect(() => { loadInfo(); }, []);

  const istDateTime = (local) => local
    ? new Date(`${local}:00+05:30`).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
    : "—";

  const dryRun = async (openConfirm) => {
    if (busy) return;
    try {
      setBusy(true);
      const { data } = await api.post("/audit-log/purge", null, { params: { dry_run: true } });
      if (openConfirm) setPreview(data);
      else toast.message(`Dry run: ${data.would_delete} entr${data.would_delete === 1 ? "y" : "ies"} older than ${istDateTime(data.cutoff_ist)} would be deleted. Nothing was deleted.`);
      onPurged(); // the dry run itself is logged
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const purgeNow = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const { data } = await api.post("/audit-log/purge", null, { params: { dry_run: false } });
      toast.success(`Deleted ${data.deleted} old entr${data.deleted === 1 ? "y" : "ies"}`);
      setPreview(null);
      loadInfo();
      onPurged();
    } catch (e) {
      toast.error(e?.response?.status === 409 ? "A purge is already running. Try again in a minute." : formatApiError(e));
    } finally { setBusy(false); }
  };

  if (!info) return null;
  return (
    <Card data-testid="audit-retention">
      <CardContent className="pt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="space-y-0.5">
          <div className="font-semibold">Entries are kept for {info.retention_days} day{info.retention_days === 1 ? "" : "s"}</div>
          <div className="text-muted-foreground">
            Entries before {istDateTime(info.cutoff_ist)} are removed automatically every day at 03:00 IST.
            {info.last_full_purge_at && <> Last automatic clean-up: {fmtIst(info.last_full_purge_at, false)}.</>}
            {" "}Bills, sessions, payments and card history are never removed.
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => dryRun(false)} data-testid="audit-dry-run">Dry run</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => dryRun(true)} data-testid="audit-purge-btn"><Broom size={14}/> Purge old entries</Button>
        </div>
      </CardContent>

      <Dialog open={!!preview} onOpenChange={v => !v && setPreview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Delete old audit entries?</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-2 text-sm">
              <p><b>{preview.would_delete.toLocaleString("en-IN")}</b> entr{preview.would_delete === 1 ? "y" : "ies"} older than <b>{istDateTime(preview.cutoff_ist)}</b> will be permanently deleted
                {preview.scope === "CAFE" ? " for this cafe" : " for all cafes"}.</p>
              <p className="text-muted-foreground">Only the activity log is affected. The clean-up itself is recorded.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
            <Button variant="destructive" onClick={purgeNow} disabled={busy || !preview || preview.would_delete === 0} data-testid="audit-purge-confirm">
              {busy ? "Deleting…" : preview?.would_delete === 0 ? "Nothing to delete" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Val({ v }) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "object") return <span className="whitespace-pre-wrap">{JSON.stringify(v, null, 1)}</span>;
  return <>{String(v)}</>;
}

function Field({ label, value, mono, wide, accent = "" }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <span className="text-muted-foreground">{label}: </span>
      <span className={`${mono ? "font-mono text-xs break-all" : ""} ${accent}`}>{value}</span>
    </div>
  );
}
