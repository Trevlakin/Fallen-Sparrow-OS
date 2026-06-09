import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PinAdminGuard } from "@/components/PinAdminGuard";
import { AppLayout } from "@/layouts/AppLayout";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { MobileHomePage } from "@/pages/MobileHome";
import { JarvisPage } from "@/pages/Jarvis";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { BriefingPage } from "@/pages/Briefing";
import { ArtistsPage } from "@/pages/Artists";
import { CustomersPage } from "@/pages/Customers";
import { AppointmentsPage } from "@/pages/Appointments";
import { PnlPage } from "@/pages/Pnl";
import { SettingsPage } from "@/pages/Settings";
import { SOPsPage } from "@/pages/SOPs";
import { TasksPage } from "@/pages/Tasks";
import { IncidentsPage } from "@/pages/Incidents";
import { StrategicNotesPage } from "@/pages/StrategicNotes";
import { ChecklistPage } from "@/pages/Checklist";
import { OfflinePage } from "@/pages/Offline";
import { InventoryPage } from "@/pages/Inventory";
import { ROICalculatorPage } from "@/pages/ROICalculator";
import { FollowupsPage } from "@/pages/Followups";

// Desktop vs mobile home: at >=768px, "/" is the full KPI dashboard; below 768px, "/"
// is the executive-assistant MobileHome. "/dashboard" always serves the full dashboard
// (including on mobile for power users). Sidebar is desktop-only; BottomNav is mobile-only.
function HomeRoute() {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <MobileHomePage />;
  }
  return <DashboardPage />;
}

function AuthenticatedApp() {
  return (
    <ProtectedRoute>
      <PinAdminGuard>
        <AppLayout />
      </PinAdminGuard>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/checklist" element={<ChecklistPage />} />
            <Route path="/sop-checklist" element={<ChecklistPage />} />
            <Route path="/offline" element={<OfflinePage />} />
            <Route element={<AuthenticatedApp />}>
              <Route index element={<HomeRoute />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="jarvis" element={<JarvisPage />} />
              <Route path="brain-dump" element={<Navigate to="/jarvis" replace />} />
              <Route
                path="briefing"
                element={
                  <ProtectedRoute
                    roles={["OWNER", "MANAGER"]}
                    redirectTo="/jarvis"
                  >
                    <BriefingPage />
                  </ProtectedRoute>
                }
              />
              <Route path="artists" element={<ArtistsPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route
                path="sops"
                element={
                  <ProtectedRoute
                    roles={["OWNER", "MANAGER"]}
                    redirectTo="/jarvis"
                  >
                    <SOPsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="operations"
                element={<Navigate to="/sops" replace />}
              />
              <Route path="inventory" element={<InventoryPage />} />
              <Route
                path="tasks"
                element={
                  <ProtectedRoute
                    roles={["OWNER", "MANAGER"]}
                    redirectTo="/jarvis"
                  >
                    <TasksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="incidents"
                element={
                  <ProtectedRoute
                    roles={["OWNER", "MANAGER"]}
                    redirectTo="/jarvis"
                  >
                    <IncidentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="strategic-notes"
                element={
                  <ProtectedRoute
                    roles={["OWNER", "MANAGER"]}
                    redirectTo="/jarvis"
                  >
                    <StrategicNotesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="follow-ups"
                element={<Navigate to="/followups" replace />}
              />
              <Route
                path="followups"
                element={
                  <ProtectedRoute
                    roles={["OWNER", "MANAGER"]}
                    redirectTo="/jarvis"
                    deniedMessage="Follow-ups are for owners and managers"
                  >
                    <FollowupsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="appointments"
                element={
                  <ProtectedRoute
                    roles={["OWNER", "MANAGER"]}
                    redirectTo="/jarvis"
                  >
                    <AppointmentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="pnl"
                element={
                  <ProtectedRoute
                    roles={["OWNER", "MANAGER"]}
                    redirectTo="/jarvis"
                  >
                    <PnlPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute
                    roles={["OWNER"]}
                    redirectTo="/"
                    deniedMessage="Settings are owner-only"
                  >
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="roi-calculator"
                element={
                  <ProtectedRoute
                    roles={["OWNER", "MANAGER"]}
                    redirectTo="/jarvis"
                  >
                    <ROICalculatorPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
