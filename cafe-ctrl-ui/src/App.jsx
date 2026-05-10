import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "@/App.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "sonner";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import CafeSetupPage from "./pages/CafeSetupPage";
import DashboardPage from "./pages/DashboardPage";
import GameTypesPage from "./pages/GameTypesPage";
import RateCardsPage from "./pages/RateCardsPage";
import ResourcesPage from "./pages/ResourcesPage";
import InventoryPage from "./pages/InventoryPage";
import StaffPage from "./pages/StaffPage";
import SessionsListPage from "./pages/SessionsListPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import ReportsPage from "./pages/ReportsPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import CafeProfilePage from "./pages/CafeProfilePage";
import AuthCallback from "./pages/AuthCallback";
import AppShell from "./layouts/AppShell";
console.log("APP.JS IS LOADED");
// function Protected({ roles, perm, children }) {
//   const { user, loading } = useAuth();
//   const location = useLocation();
//   if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
//   if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
//   if (roles && !roles.includes(user.role)) return <Navigate to="/" replace/>;
//   if (perm && user.role === "operator" && !user.permissions?.includes(perm)) return <Navigate to="/sessions" replace/>;
//   return children;
// }

function Protected({ roles, perm, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading Gateway…</div>;

  if (!user) {
    console.error("⛔ [GATEKEEPER] REFUSED: User object is null! Kicking to login.");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force uppercase comparison just in case
  const safeUserRole = user.role?.toUpperCase();

  if (roles && !roles.includes(safeUserRole)) {
    console.error(`⛔ [GATEKEEPER] REFUSED: Role mismatch! User has '${safeUserRole}', Route requires [${roles}]`);
    return <Navigate to="/login" replace/>; // Kick to login so we can see it happen
  }

  console.log("✅ [GATEKEEPER] ACCESS GRANTED for role:", safeUserRole);
  return children;
}

function RootRedirect() {
  const { user, cafe, loading } = useAuth();
 //REMOVE THIS BEFORE DEPLOYMENT - DEBUGGING PURPOSES ONLY
  console.log("--- Redirect Diagnostic ---");
  console.log("Loading:", loading);
  console.log("User Object:", user);
  console.log("Cafe Object:", cafe);
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace/>;
  if (user.role === "SUPER_ADMIN") return <Navigate to="/super-admin" replace/>;
  if (user.role === "CAFE_ADMIN" && cafe && !cafe.is_setup_complete) return <Navigate to="/setup" replace/>;
  if (user.role === "CAFE_ADMIN") return <Navigate to="/dashboard" replace/>;
  return <Navigate to="/sessions" replace/>;
}

function App() {
  console.log("APP COMPONENT IS RENDERING");
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster richColors position="top-right" />
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback/>}/>
            <Route path="/" element={<RootRedirect/>}/>
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/signup" element={<SignupPage/>}/>
            <Route path="/setup" element={<Protected roles={["CAFE_ADMIN"]}><CafeSetupPage/></Protected>}/>
            <Route path="/super-admin" element={<Protected roles={["SUPER_ADMIN"]}><SuperAdminPage/></Protected>}/>

            <Route element={<Protected roles={["CAFE_ADMIN", "OPERATOR"]}><AppShell/></Protected>}>
              <Route path="/dashboard" element={<DashboardPage/>}/>
              <Route path="/game-types" element={<Protected roles={["CAFE_ADMIN"]}><GameTypesPage/></Protected>}/>
              <Route path="/rate-cards" element={<Protected roles={["CAFE_ADMIN"]}><RateCardsPage/></Protected>}/>
              <Route path="/resources" element={<Protected roles={["CAFE_ADMIN"]}><ResourcesPage/></Protected>}/>
              <Route path="/inventory" element={<Protected perm="inventory"><InventoryPage/></Protected>}/>
              <Route path="/staff" element={<Protected roles={["CAFE_ADMIN"]}><StaffPage/></Protected>}/>
              <Route path="/sessions" element={<Protected perm="sessions"><SessionsListPage/></Protected>}/>
              <Route path="/sessions/:id" element={<Protected perm="sessions"><SessionDetailPage/></Protected>}/>
              <Route path="/reports" element={<Protected perm="reports"><ReportsPage/></Protected>}/>
              <Route path="/cafe-profile" element={<Protected roles={["CAFE_ADMIN"]}><CafeProfilePage/></Protected>}/>
              <Route path="/change-password" element={<ChangePasswordPage/>}/>
            </Route>

            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
