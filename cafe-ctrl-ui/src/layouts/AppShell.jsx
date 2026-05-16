import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Button } from "../components/ui/button";
import {
  HouseSimple, GameController, ClockCounterClockwise, Receipt, ChartBar,
  Users, Package, Storefront, SignOut, Sun, MoonStars, Gear, Lightning,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: HouseSimple, roles: ["CAFE_ADMIN", "OPERATOR"], perm: null },
  { to: "/sessions", label: "Live Sessions", icon: Lightning, roles: ["CAFE_ADMIN", "OPERATOR"], perm: "sessions" },
  { to: "/game-types", label: "Game Types", icon: GameController, roles: ["CAFE_ADMIN"] },
  { to: "/rate-cards", label: "Rate Cards", icon: Receipt, roles: ["CAFE_ADMIN"] },
  { to: "/resources", label: "Resources", icon: ClockCounterClockwise, roles: ["CAFE_ADMIN"] },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["CAFE_ADMIN", "OPERATOR"], perm: "inventory" },
  { to: "/staff", label: "Staff", icon: Users, roles: ["CAFE_ADMIN"] },
  { to: "/reports", label: "Reports", icon: ChartBar, roles: ["CAFE_ADMIN", "OPERATOR"], perm: "reports" },
  { to: "/cafe-profile", label: "Cafe Profile", icon: Storefront, roles: ["CAFE_ADMIN"] },
  { to: "/customers", label: "Customers", icon: Users, roles: ["CAFE_ADMIN", "OPERATOR"] },
];

const SUPER_NAV = [
  { to: "/super-admin", label: "Overview", icon: HouseSimple },
];

export default function AppShell() {
  const { user, cafe, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  if (!user) return null;

  const items = user.role === "SUPER_ADMIN" ? SUPER_NAV : NAV.filter(it => {
    if (!it.roles.includes(user.role)) return false;
    if (user.role === "OPERATOR" && it.perm && !user.permissions?.includes(it.perm)) return false;
    return true;
  });

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 hidden md:flex flex-col border-r border-border bg-card" data-testid="app-sidebar">
        <div className="px-6 py-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <Lightning size={20} weight="fill" className="text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-extrabold text-lg leading-tight">CafeCtrl</div>
              <div className="uppercase-label">{user.role === "SUPER_ADMIN" ? "Super Console" : (cafe?.name || "Setup")}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <Icon size={18} weight="duotone" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => navigate("/change-password")} data-testid="nav-change-password">
            <Gear size={18} weight="duotone" /> Change Password
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={toggle} data-testid="theme-toggle">
            {theme === "dark" ? <Sun size={18} weight="duotone" /> : <MoonStars size={18} weight="duotone" />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={async () => { await logout(); navigate("/login"); }} data-testid="logout-btn">
            <SignOut size={18} weight="duotone" /> Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Lightning size={20} weight="fill" className="text-primary" />
            <span className="font-display font-extrabold">CafeCtrl</span>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={toggle} data-testid="theme-toggle-mobile">
              {theme === "dark" ? <Sun size={18} /> : <MoonStars size={18} />}
            </Button>
            <Button size="icon" variant="ghost" onClick={async () => { await logout(); navigate("/login"); }}>
              <SignOut size={18} />
            </Button>
          </div>
        </header>
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
