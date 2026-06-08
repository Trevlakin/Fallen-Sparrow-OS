import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export const TOUR_COMPLETED_KEY = "fs_tour_completed";
export const TOUR_FORCE_START_KEY = "fs_tour_force_start";

const MAIN_TOUR_STEPS: DriveStep[] = [
  {
    popover: {
      title: "Welcome to Fallen Sparrow",
      description:
        "Your studio command center. This quick tour shows where to find revenue, artists, and daily insights.",
      side: "over",
      align: "center",
    },
  },
  {
    element: '[data-tour="sidebar-nav"]',
    popover: {
      title: "Main navigation",
      description:
        "Jump between Dashboard, JARVIS, Briefing, P&L, and more from the left sidebar.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="kpi-cards"]',
    popover: {
      title: "Key metrics at a glance",
      description:
        "Zone A KPI cards track revenue, appointments, margins, and growth for your selected period.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="timeline-selector"]',
    popover: {
      title: "Date range filter",
      description:
        "Switch year and period to focus on today, this month, YTD, or a custom range.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="artist-rankings"]',
    popover: {
      title: "Artist performance",
      description:
        "Zone B rankings show who is leading in revenue and bookings for the selected period.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="client-intelligence"]',
    popover: {
      title: "Client intelligence",
      description:
        "Top clients by spend. Click any name to open their continuity profile and relationship history.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="nav-jarvis"]',
    popover: {
      title: "JARVIS voice assistant",
      description:
        "Log expenses and ask questions hands-free from anywhere in the app.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-briefing"]',
    popover: {
      title: "Daily briefing",
      description:
        "Your morning digest of studio metrics, nudges, and action items.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-pnl"]',
    popover: {
      title: "Profit & Loss",
      description:
        "Full revenue, payroll, expenses, and margin breakdown by service line.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: "Studio settings",
      description:
        "Commission rates, bonuses, imports, and account security for owners.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="configure-kpis"]',
    popover: {
      title: "Customize your dashboard",
      description:
        "Show or hide KPI cards and intelligence panels to match how you run the studio.",
      side: "bottom",
      align: "end",
    },
  },
  {
    popover: {
      title: "You are ready!",
      description:
        "Explore the dashboard at your own pace. Replay this tour anytime from Settings.",
      side: "over",
      align: "center",
    },
  },
];

function stepElementExists(step: DriveStep): boolean {
  if (!step.element) return true;
  if (typeof step.element === "string") {
    return document.querySelector(step.element) !== null;
  }
  return true;
}

function resolveTourSteps(): DriveStep[] {
  return MAIN_TOUR_STEPS.filter(stepElementExists);
}

export function createMainTour() {
  const steps = resolveTourSteps();

  const driverObj = driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.75,
    stagePadding: 8,
    popoverClass: "fs-tour-popover",
    steps,
    onDestroyStarted: (_element, _step, { driver: activeDriver }) => {
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
      sessionStorage.removeItem(TOUR_FORCE_START_KEY);
      activeDriver.destroy();
    },
  });

  return driverObj;
}

export function startMainTour() {
  const tour = createMainTour();
  tour.drive();
  return tour;
}
