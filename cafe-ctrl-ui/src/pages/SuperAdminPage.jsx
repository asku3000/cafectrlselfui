import React, { useEffect, useState } from "react";
import { api, formatApiError, fmtMoney } from "../lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { Sun, MoonStars, SignOut, Buildings, Users, Receipt, Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [cafes, setCafes] = useState([]);

useEffect(() => {
    // 1. Define the function
    const fetchDashboardData = async () => {
      try {
        const [s, c] = await Promise.all([
          api.get("/super-admin/stats"), 
          api.get("/super-admin/cafes")
        ]);
        setStats(s.data); 
        setCafes(c.data);
      } catch(err) {
        console.error("Failed to load cafes:", err);
        toast.error("Could not load cafes from server.");
      }
    };

    // 2. Actually execute it!
    fetchDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Lightning size={22} weight="fill" className="text-primary"/>
            <span className="font-display font-extrabold text-xl">CafeCtrl</span>
            <span className="ml-3 uppercase-label">Super Console</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button size="icon" variant="ghost" onClick={() => navigate("/change-password")}><Receipt size={18}/></Button>
            <Button size="icon" variant="ghost" onClick={toggle} data-testid="sa-theme-toggle">
              {theme === "dark" ? <Sun size={18}/> : <MoonStars size={18}/>}
            </Button>
            <Button size="icon" variant="ghost" onClick={async () => { await logout(); navigate("/login"); }} data-testid="sa-logout">
              <SignOut size={18}/>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        <div>
          <div className="uppercase-label">Overview</div>
          <h1 className="text-5xl font-display font-extrabold">All Cafes</h1>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI icon={Buildings} label="Total Cafes" value={stats.total_cafes || 0}/>
          <KPI icon={Users} label="Total Users" value={stats.total_users || 0}/>
          <KPI icon={Lightning} label="Sessions" value={stats.total_sessions || 0}/>
          <KPI icon={Receipt} label="Revenue" value={fmtMoney(stats.total_revenue)}/>
        </div>
        <Card>
          <CardHeader><CardTitle className="font-display">Cafes</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left uppercase-label border-b border-border"><th className="py-2">Name</th><th>Phone</th><th>Setup</th><th>Users</th><th>Sessions</th></tr></thead>
              <tbody>
                {cafes.map(c => (
                  <tr key={c.id} className="border-b border-border" data-testid={`sa-cafe-${c.id}`}>
                    <td className="py-3 font-semibold">{c.name}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.is_setup_complete ? <span className="text-emerald-500">✓</span> : <span className="text-amber-500">pending</span>}</td>
                    <td className="font-mono">{c.users_count}</td>
                    <td className="font-mono">{c.sessions_count}</td>
                  </tr>
                ))}
                {cafes.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">No cafes registered yet.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function KPI({ icon: Icon, label, value }) {
  return (
    <Card className="hover-lift">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="uppercase-label">{label}</div>
            <div className="text-3xl font-display font-extrabold mt-2 font-mono">{value}</div>
          </div>
          <Icon size={28} weight="duotone" className="text-primary"/>
        </div>
      </CardContent>
    </Card>
  );
}
