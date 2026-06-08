import { useCallback, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  useAuth,
  useCanViewFinancials,
  useIsFrontDesk,
  useIsManager,
  useIsOwner,
} from "@/context/AuthContext";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { api } from "@/lib/api";
import { onData, DATA_EVENTS } from "@/lib/eventBus";

interface NavItem {
  to: string;
  label: string;
  managerOnly?: boolean;
  ownerOnly?: boolean;
  financialOnly?: boolean;
  frontDesk?: boolean;
  badgeKey?: "tasks" | "incidents" | "jarvis" | "followups";
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/jarvis", label: "JARVIS", frontDesk: true, badgeKey: "jarvis" },
  { to: "/briefing", label: "Briefing", managerOnly: true },
  { to: "/artists", label: "Artists" },
  { to: "/customers", label: "Customers", frontDesk: true },
  { to: "/followups", label: "Follow-ups", managerOnly: true, badgeKey: "followups" },
  { to: "/sops", label: "SOPs", managerOnly: true },
  { to: "/inventory", label: "Inventory", frontDesk: true },
  { to: "/tasks", label: "Tasks", managerOnly: true, badgeKey: "tasks" },
  { to: "/incidents", label: "Incidents / Maintenance", managerOnly: true, badgeKey: "incidents" },
  { to: "/strategic-notes", label: "Strategic Notes", managerOnly: true },
  { to: "/appointments", label: "Appointments", managerOnly: true },
  { to: "/pnl", label: "P&L", financialOnly: true },
  { to: "/settings", label: "Settings", ownerOnly: true },
];

const NAV_TOUR_ATTR: Partial<Record<string, string>> = {
  "/jarvis": "nav-jarvis",
  "/briefing": "nav-briefing",
  "/pnl": "nav-pnl",
  "/settings": "nav-settings",
};

function formatBadgeCount(count: number): string {
  return count > 9 ? "9+" : String(count);
}

function isNavItemActive(
  item: NavItem,
  pathname: string,
  linkActive: boolean,
): boolean {
  if (item.label === "Dashboard") {
    return pathname === "/" || pathname === "/dashboard";
  }
  return linkActive;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const canViewFinancials = useCanViewFinancials();
  const isManager = useIsManager();
  const isOwner = useIsOwner();
  const isFrontDesk = useIsFrontDesk();
  const isMobile = useIsMobile();
  const location = useLocation();

  const [openTasks, setOpenTasks] = useState(0);
  const [openIncidents, setOpenIncidents] = useState(0);
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  const [dueFollowups, setDueFollowups] = useState(0);

  const loadBadges = useCallback(async () => {
    const fetches: Promise<void>[] = [];

    if (isManager) {
      fetches.push(
        api
          .get<{ tasks: unknown[] }>("/api/tasks?status=open")
          .then((res) => setOpenTasks(res.tasks.length))
          .catch(() => setOpenTasks(0)),
        api
          .get<{ incidents: unknown[] }>("/api/incidents?status=open")
          .then((res) => setOpenIncidents(res.incidents.length))
          .catch(() => setOpenIncidents(0)),
        api
          .get<{ suggestions: unknown[] }>("/api/jarvis/suggestions")
          .then((res) => setPendingSuggestions(res.suggestions.length))
          .catch(() => setPendingSuggestions(0)),
        api
          .get<{ followups: unknown[] }>("/api/followups/due-today")
          .then((res) => setDueFollowups(res.followups.length))
          .catch(() => setDueFollowups(0)),
      );
    }

    await Promise.all(fetches);
  }, [isManager]);

  useEffect(() => {
    void loadBadges();
  }, [loadBadges]);

  useEffect(() => {
    const events = [
      DATA_EVENTS.tasks,
      DATA_EVENTS.incidents,
      DATA_EVENTS.expenses,
      DATA_EVENTS.appointments,
      DATA_EVENTS.inventory,
      DATA_EVENTS.sops,
      DATA_EVENTS.nudges,
      DATA_EVENTS.followups,
    ];
    const unsubs = events.map((event) => onData(event, () => void loadBadges()));
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [loadBadges]);

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "?";

  const visibleNav = navItems.filter((item) => {
    if (isFrontDesk) {
      return item.frontDesk === true;
    }
    if (item.managerOnly && !isManager) return false;
    if (item.ownerOnly && !isOwner) return false;
    if (item.financialOnly && !canViewFinancials) return false;
    return true;
  });

  function renderBadge(item: NavItem): ReactNode {
    if (!isManager || !item.badgeKey) return null;

    if (item.badgeKey === "tasks" && openTasks > 0) {
      return <span className="nav-badge">{formatBadgeCount(openTasks)}</span>;
    }
    if (item.badgeKey === "incidents" && openIncidents > 0) {
      return <span className="nav-badge">{formatBadgeCount(openIncidents)}</span>;
    }
    if (item.badgeKey === "jarvis" && pendingSuggestions > 0) {
      return <span className="nav-dot" aria-label="Pending JARVIS suggestions" />;
    }
    if (item.badgeKey === "followups" && dueFollowups > 0) {
      return <span className="nav-badge">{formatBadgeCount(dueFollowups)}</span>;
    }
    return null;
  }

  return (
    <div className={`app-shell${isFrontDesk ? " front-desk-shell" : ""}${isMobile ? " mobile-shell" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="wordmark">FALLEN SPARROW</span>
        </div>
        <nav className="sidebar-nav" data-tour="sidebar-nav">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-tour={NAV_TOUR_ATTR[item.to]}
              className={({ isActive }) =>
                isNavItemActive(item, location.pathname, isActive)
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <span className="nav-link-wrap">
                <span>{item.label}</span>
                {renderBadge(item)}
              </span>
            </NavLink>
          ))}
        </nav>
        {canViewFinancials && (
          <div className="sidebar-bottom">
            <NavLink
              to="/roi-calculator"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <span className="nav-link-wrap">
                <span>ROI Calculator</span>
              </span>
            </NavLink>
          </div>
        )}
        <div className="sidebar-user">
          <div className="avatar-circle">{initials}</div>
          <div>
            <div className="user-name">
              {user ? `${user.firstName} ${user.lastName}` : ""}
            </div>
            <div className="user-email">{user?.email}</div>
            <button type="button" className="sign-out-link" onClick={logout}>
              Sign Out
            </button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
      {isMobile && <BottomNav />}
      <InstallPrompt />
    </div>
  );
}
