import React, { useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { fmtMoney } from "../lib/apiClient";
import { useAuth } from "../contexts/AuthContext";
import { Lightning, ChartBar, Users, Receipt } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export default function DashboardPage() {
  const { user, cafe } = useAuth();
  const [today, setToday] = useState({ total: 0, count: 0, by_mode: {}, sessions: [] });
  const [active, setActive] = useState([]);
  const [resources, setResources] = useState([]);

  const load = async () => {
    try {
      if (user?.role === "CAFE_ADMIN" || user?.permissions?.includes("reports")) {
        const todayStr = new Date().toISOString().split('T')[0]; 
        
        // Pass the date as a query parameter
        const { data } = await api.get(`/reports/daily?date=${todayStr}`);
        setToday(data);
      }
      const a = await api.get("/sessions/active").catch(() => ({ data: [] }));
      setActive(a.data || []);
      const r = await api.get("/resources").catch(() => ({ data: [] }));
      setResources(r.data || []);
    } catch {}
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const activeGames = active.reduce((acc, s) => acc + s.games.filter(g => g.status === "active").length, 0);

  return (
    <div className="space-y-8" data-testid="dashboard-root">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="uppercase-label">Dashboard</div>
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight">Hi, {user?.name?.split(" ")[0]}.</h1>
          <p className="text-muted-foreground mt-2">{cafe?.name}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/sessions"><Button data-testid="dashboard-go-sessions"><Lightning size={18} weight="fill" /> Open Sessions</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Today's Revenue" value={fmtMoney(today.total)} icon={Receipt} accent="text-primary" tid="kpi-revenue"/>
        <KPI label="Bills Today" value={today.count} icon={ChartBar} accent="text-emerald-500" tid="kpi-bills"/>
        <KPI label="Active Customers" value={active.length} icon={Users} accent="text-amber-500" tid="kpi-active"/>
        <KPI label="Active Games" value={activeGames} icon={Lightning} accent="text-blue-500" tid="kpi-active-games"/>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Resources</CardTitle></CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No resources yet. <Link to="/resources" className="text-primary underline">Add resources</Link> after creating game types and rate cards.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {resources.map(r => (
                <div key={r.id} className={`rounded-md border p-3 ${r.active ? "border-primary bg-primary/5" : "border-border"}`} data-testid={`dash-resource-${r.id}`}>
                  <div className="font-semibold">{r.name}</div>
                  <div className={`text-xs uppercase tracking-widest mt-1 ${r.active ? "text-primary" : "text-muted-foreground"}`}>
                    {r.active ? `In use • ${r.active.customer_name}` : "Available"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display">Payment mix today</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          {["cash", "upi", "card"].map(m => (
            <div key={m} className="border border-border rounded-md p-4">
              <div className="uppercase-label">{m}</div>
              <div className="text-2xl font-display font-bold mt-1 font-mono">{fmtMoney(today.by_mode?.[m] || 0)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, icon: Icon, accent, tid }) {
  return (
    <Card className="hover-lift" data-testid={tid}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="uppercase-label">{label}</div>
            <div className="text-3xl font-display font-extrabold mt-2 font-mono">{value}</div>
          </div>
          <Icon size={28} weight="duotone" className={accent}/>
        </div>
      </CardContent>
    </Card>
  );
}
