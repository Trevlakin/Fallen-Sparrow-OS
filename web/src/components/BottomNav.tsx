import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  useCanViewFinancials,
  useIsFrontDesk,
  useIsManager,
  useIsOwner,
} from "@/context/AuthContext";

interface MoreItem {
  to: string;
  label: string;
  ownerOnly?: boolean;
  managerOnly?: boolean;
  financialOnly?: boolean;
}

const moreItems: MoreItem[] = [
  { to: "/artists", label: "Artists" },
  { to: "/customers", label: "Customers" },
  { to: "/followups", label: "Follow-ups", managerOnly: true },
  { to: "/inventory", label: "Inventory" },
  { to: "/sops", label: "SOPs" },
  { to: "/tasks", label: "Tasks", managerOnly: true },
  { to: "/incidents", label: "Maint.", managerOnly: true },
  { to: "/strategic-notes", label: "Strategic Notes", managerOnly: true },
  { to: "/pnl", label: "P&L", financialOnly: true },
  { to: "/settings", label: "Settings", ownerOnly: true },
];

function TabIcon({ name }: { name: "home" | "dump" | "briefing" | "customers" | "more" }) {
  const paths: Record<typeof name, string> = {
    home: "M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z",
    dump: "M4 20h16M7 20l2-8 3 3 2-5 3 10",
    briefing: "M6 4h12v16H6V4zm2 4h8M8 12h8M8 16h5",
    customers: "M9 11a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6zM3 20a5 5 0 0110 0M13 20a5 5 0 0110 0",
    more: "M5 7h14M5 12h14M5 17h14",
  };
  return (
    <svg
      className="bottom-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function BottomNav() {
  const isFrontDesk = useIsFrontDesk();
  const isManager = useIsManager();
  const isOwner = useIsOwner();
  const canViewFinancials = useCanViewFinancials();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const visibleMore = moreItems.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    if (item.managerOnly && !isManager) return false;
    if (item.financialOnly && !canViewFinancials) return false;
    return true;
  });

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const handleMoreNav = (to: string) => {
    setMoreOpen(false);
    void navigate(to);
  };

  if (isFrontDesk) {
    return (
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "bottom-nav-link active" : "bottom-nav-link"
          }
        >
          <TabIcon name="home" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/jarvis"
          className={({ isActive }) =>
            isActive ? "bottom-nav-link active" : "bottom-nav-link"
          }
        >
          <TabIcon name="dump" />
          <span>JARVIS</span>
        </NavLink>
        <NavLink
          to="/customers"
          className={({ isActive }) =>
            isActive ? "bottom-nav-link active" : "bottom-nav-link"
          }
        >
          <TabIcon name="customers" />
          <span>Customers</span>
        </NavLink>
        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            isActive ? "bottom-nav-link active" : "bottom-nav-link"
          }
        >
          <TabIcon name="more" />
          <span>Inventory</span>
        </NavLink>
      </nav>
    );
  }

  return (
    <>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "bottom-nav-link active" : "bottom-nav-link"
          }
        >
          <TabIcon name="home" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/jarvis"
          className={({ isActive }) =>
            isActive ? "bottom-nav-link active" : "bottom-nav-link"
          }
        >
          <TabIcon name="dump" />
          <span>JARVIS</span>
        </NavLink>
        {isManager && (
          <NavLink
            to="/briefing"
            className={({ isActive }) =>
              isActive ? "bottom-nav-link active" : "bottom-nav-link"
            }
          >
            <TabIcon name="briefing" />
            <span>Briefing</span>
          </NavLink>
        )}
        <button
          type="button"
          className={`bottom-nav-link bottom-nav-more${moreOpen ? " active" : ""}`}
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
        >
          <TabIcon name="more" />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="more-drawer-backdrop"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        />
      )}
      <div
        ref={drawerRef}
        className={`more-drawer${moreOpen ? " open" : ""}`}
        role="dialog"
        aria-label="More navigation"
        aria-hidden={!moreOpen}
      >
        <div className="more-drawer-handle" aria-hidden />
        <ul className="more-drawer-list">
          {visibleMore.map((item) => (
            <li key={item.to}>
              <button type="button" onClick={() => handleMoreNav(item.to)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
