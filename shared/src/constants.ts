/**
 * MASTER_SPEC_v3 §4: single source of truth for expense categories and nudge rules.
 */

export const EXPENSE_CATEGORIES = {
  SUPPLIES: {
    name: "Supplies",
    qbAccount: "6100_Supplies_Expense",
    description:
      "ink, needles, gloves, cleaning supplies, sterilization packs, any consumable used in services",
  },
  MAINTENANCE: {
    name: "Maintenance",
    qbAccount: "6200_Repairs_Maintenance",
    description: "repairs, fixes, anything that maintains the physical space or equipment",
  },
  PAYROLL: {
    name: "Payroll",
    qbAccount: "6300_Payroll_Expense",
    description: "wages, contractor payments, artist fees — anything paid to a person for work",
  },
  MARKETING: {
    name: "Marketing",
    qbAccount: "6500_Marketing_Advertising",
    description: "advertising, social media, promotional materials, photography",
  },
  UTILITIES: {
    name: "Utilities",
    qbAccount: "6600_Utilities",
    description: "electricity, water, internet, phone, monthly building services",
  },
  ADMIN: {
    name: "Admin",
    qbAccount: "6700_Admin_General",
    description: "office supplies, software subscriptions, accounting fees, licenses, permits",
  },
  FURNITURE: {
    name: "Furniture",
    qbAccount: "1500_Furniture_Equipment",
    description:
      "chairs, desks, lobby furniture, equipment — one-time purchases (asset account)",
  },
} as const;

export type ExpenseCategoryKey = keyof typeof EXPENSE_CATEGORIES;

export const EXPENSE_CATEGORY_PROMPT_BLOCK = Object.values(EXPENSE_CATEGORIES)
  .map((c) => `- ${c.name} (${c.description})`)
  .join("\n");

/** Sprint 8K inventory item categories (varchar on inventory_items.category). */
export const INVENTORY_CATEGORIES = {
  ink: { label: "Ink" },
  needles: { label: "Needles" },
  gloves: { label: "Gloves" },
  aftercare: { label: "Aftercare" },
  disposables: { label: "Disposables" },
  cleaning: { label: "Cleaning" },
  office: { label: "Office" },
  merchandise: { label: "Merchandise" },
  other: { label: "Other" },
} as const;

export type InventoryCategoryKey = keyof typeof INVENTORY_CATEGORIES;

export const INVENTORY_CATEGORY_KEYS = Object.keys(
  INVENTORY_CATEGORIES,
) as [InventoryCategoryKey, ...InventoryCategoryKey[]];

/** Artist payout method on P&L session drill-down (how the shop paid the artist). */
export const ARTIST_PAYOUT_METHODS = ["cash", "zelle", "cash_app"] as const;
export type ArtistPayoutMethod = (typeof ARTIST_PAYOUT_METHODS)[number];

export const ARTIST_PAYOUT_METHOD_LABELS: Record<ArtistPayoutMethod, string> = {
  cash: "Cash",
  zelle: "Zelle",
  cash_app: "Cash App",
};

/** Sprint 9A: client follow-up intervals after a completed sale. */
export const FOLLOWUP_TYPES = ["2_week", "1_month", "2_month", "6_month"] as const;
export type FollowupType = (typeof FOLLOWUP_TYPES)[number];

export const FOLLOWUP_TYPE_LABELS: Record<FollowupType, string> = {
  "2_week": "2-week check-in",
  "1_month": "1-month check-in",
  "2_month": "2-month check-in",
  "6_month": "6-month check-in",
};

export const FOLLOWUP_TYPE_DESCRIPTIONS: Record<FollowupType, string> = {
  "2_week": "Short healing check-in after their session",
  "1_month": "See how the piece is settling",
  "2_month": "Mid-term touchpoint for larger work",
  "6_month": "Long-term relationship and rebook prompt",
};

export const CONFIDENCE_THRESHOLD = 0.85;

export const NUDGE_RULES = {
  overdueBufferDays: 30,
  maxGapMultiplier: 3,
  minDaysBetweenNudges: 30,
} as const;

/** Sprint 9A: tiered commission tiers (60/40 under $1k, 70/30 at $1k+). */
export const COMMISSION_TIERS = [
  { threshold: 0,    artistPct: 0.60, shopPct: 0.40 },
  { threshold: 1000, artistPct: 0.70, shopPct: 0.30 },
] as const;

export function getCommissionRate(amount: number): { artistPct: number; shopPct: number } {
  const tier = [...COMMISSION_TIERS].reverse().find((t) => amount >= t.threshold);
  return tier ?? COMMISSION_TIERS[0];
}

export const USER_ROLES = ["OWNER", "MANAGER", "FRONT_DESK", "ARTIST"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Owner + manager: P&L, follow-ups, tasks, briefing, etc. */
export const MANAGER_ACCESS_ROLES = ["OWNER", "MANAGER"] as const;

export function hasManagerAccess(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "MANAGER";
}

/** Sprint 8L + 9A: employee checklist PIN roles (includes CLEANER and MAINTENANCE). */
export const TEAM_MEMBER_ROLES = [
  "OWNER",
  "MANAGER",
  "FRONT_DESK",
  "ARTIST",
  "CLEANER",
  "MAINTENANCE",
] as const;
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];

export const TEAM_MEMBER_ROLE_LABELS: Record<TeamMemberRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  FRONT_DESK: "Front Desk",
  ARTIST: "Artist",
  CLEANER: "Cleaner",
  MAINTENANCE: "Maintenance",
};

/** Sprint 9A: role-based permission matrix. */
export const ROLE_PERMISSIONS: Record<TeamMemberRole, {
  dashboard: boolean;
  pl: boolean;
  jarvis: boolean;
  checklist: boolean;
  admin: boolean;
}> = {
  OWNER:       { dashboard: true,  pl: true,   jarvis: true,  checklist: true,  admin: true  },
  MANAGER:     { dashboard: true,  pl: true,   jarvis: true,  checklist: true,  admin: true  },
  FRONT_DESK:  { dashboard: false, pl: false,  jarvis: true,  checklist: true,  admin: false },
  ARTIST:      { dashboard: false, pl: false,  jarvis: true,  checklist: true,  admin: false },
  CLEANER:     { dashboard: false, pl: false,  jarvis: false, checklist: true,  admin: false },
  MAINTENANCE: { dashboard: false, pl: false,  jarvis: false, checklist: true,  admin: false },
};

/** Sprint 9B: full admin shell (dashboard + sidebar), not checklist-only. */
export function hasDashboardAccess(role: string | null | undefined): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role as TeamMemberRole]?.dashboard ?? false;
}
