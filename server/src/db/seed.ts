/**
 * Sprint 1 seed: owner user, sample artists, settings defaults (placeholder commission rates).
 */
import {
  artists,
  checklistAccess,
  inventoryItems,
  meta,
  settings,
  sopChecklistItems,
  sops,
  sopRoleAssignments,
  teamMembers,
  users,
} from "@fallen-sparrow/shared/schema";
import { and, eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db, pool } from "../config/database.js";
import { hashPassword } from "../services/authService.js";
import { hashPin } from "../services/teamMemberService.js";
import type {
  BonusSettings,
  CommissionTiersSetting,
} from "../services/settingsService.js";

const COMMISSION_TIERS_KEY = "commission_tiers";
const BONUS_AMOUNTS_KEY = "bonus_amounts";

async function seedSettings(): Promise<void> {
  const commissionTiers: CommissionTiersSetting = {
    tiers: [
      { thresholdAmount: 0, artistPct: 60, shopPct: 40, sortOrder: 1 },
      { thresholdAmount: 1000, artistPct: 70, shopPct: 30, sortOrder: 2 },
    ],
    updatedAt: null,
  };

  const bonusAmounts: BonusSettings = {
    // TODO(Q1d): Confirm walk-in and referral bonus amounts with Legion.
    walkInBonus: 0,
    referralBonus: 0,
  };

  for (const [key, value] of [
    [COMMISSION_TIERS_KEY, commissionTiers],
    [BONUS_AMOUNTS_KEY, bonusAmounts],
  ] as const) {
    const existing = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    if (!existing[0]) {
      await db.insert(settings).values({ key, value });
    }
  }
}

const DEMO_PASSWORD = "ChangeMe123!";

const DEMO_APP_USERS = [
  {
    email: "owner@fallensparrow.local",
    firstName: "Legion",
    lastName: "Avegno",
    role: "OWNER" as const,
  },
  {
    email: "frontdesk@fallensparrow.local",
    firstName: "Front",
    lastName: "Desk",
    role: "FRONT_DESK" as const,
  },
  {
    email: "hector@fallensparrow.local",
    firstName: "Hector",
    lastName: "Morales",
    role: "MANAGER" as const,
  },
  {
    email: "carlos@fallensparrow.local",
    firstName: "Carlos",
    lastName: "Mendez",
    role: "ARTIST" as const,
  },
] as const;

async function seedUsers(): Promise<void> {
  const isProduction = env.NODE_ENV === "production";
  const allowDemoUsers = env.SEED_DEMO_USERS === "true";

  if (isProduction) {
    const ownerEmail = env.OWNER_SEED_EMAIL;
    const ownerPassword = env.OWNER_SEED_PASSWORD;
    if (!ownerEmail || !ownerPassword) {
      console.warn(
        "Skipping user seed in production. Set OWNER_SEED_EMAIL and OWNER_SEED_PASSWORD, then run pnpm db:seed.",
      );
      return;
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, ownerEmail))
      .limit(1);

    if (!existing[0]) {
      await db.insert(users).values({
        email: ownerEmail,
        passwordHash: await hashPassword(ownerPassword),
        firstName: "Legion",
        lastName: "Avegno",
        role: "OWNER",
        phone: null,
        isActive: true,
      });
      console.log(`Created owner: ${ownerEmail}`);
    }

    if (!allowDemoUsers) {
      return;
    }
  }

  for (const user of DEMO_APP_USERS) {
    if (isProduction && user.role === "OWNER") {
      continue;
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);

    if (!existing[0]) {
      const password = isProduction ? DEMO_PASSWORD : DEMO_PASSWORD;
      await db.insert(users).values({
        email: user.email,
        passwordHash: await hashPassword(password),
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: null,
        isActive: true,
      });
      console.log(
        isProduction
          ? `Created ${user.role.toLowerCase()}: ${user.email}`
          : `Created ${user.role.toLowerCase()}: ${user.email} / ${DEMO_PASSWORD}`,
      );
    }
  }
}

async function seedArtists(): Promise<void> {
  const sampleArtists = [
    { name: "Carlos Mendez", porterArtistId: "porter-artist-001", commission: "0.5000" },
    { name: "Riley Stone", porterArtistId: "porter-artist-002", commission: "0.5000" },
    { name: "Jordan Vale", porterArtistId: "porter-artist-003", commission: "0.4500" },
  ];

  for (const a of sampleArtists) {
    const existing = await db
      .select()
      .from(artists)
      .where(eq(artists.porterArtistId, a.porterArtistId))
      .limit(1);
    if (!existing[0]) {
      await db.insert(artists).values({
        name: a.name,
        porterArtistId: a.porterArtistId,
        commissionPercentage: a.commission,
        specialties: ["tattoo"],
        isActive: true,
      });
    }
  }

  const carlosUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "carlos@fallensparrow.local"))
    .limit(1);
  const carlosArtist = await db
    .select({ id: artists.id, userId: artists.userId })
    .from(artists)
    .where(eq(artists.porterArtistId, "porter-artist-001"))
    .limit(1);
  if (carlosUser[0] && carlosArtist[0] && !carlosArtist[0].userId) {
    await db
      .update(artists)
      .set({ userId: carlosUser[0].id })
      .where(eq(artists.id, carlosArtist[0].id));
    console.log("Linked Carlos Mendez artist record to carlos@fallensparrow.local");
  }
}

async function seedMeta(): Promise<void> {
  const rows = await db.select().from(meta).limit(1);
  if (!rows[0]) {
    await db.insert(meta).values({});
  }
}

const CLEANER_ACCESS_TOKEN = "11111111-1111-4111-8111-111111111111";

type SeedSopDef = {
  title: string;
  role: string;
  frequency: string;
  sortOrder: number;
  checklistItems: string[];
};

const SPRINT_SOP_TEMPLATES: SeedSopDef[] = [
  {
    title: "Front Desk: Opening",
    role: "FRONT_DESK",
    frequency: "opening",
    sortOrder: 1,
    checklistItems: [
      "Check appointment schedule for today",
      "Confirm deposits on file for today's bookings",
      "Turn on all equipment and station lighting",
      "Restock front desk supplies",
      "Check and respond to overnight messages",
    ],
  },
  {
    title: "Front Desk: Closing",
    role: "FRONT_DESK",
    frequency: "closing",
    sortOrder: 2,
    checklistItems: [
      "Reconcile cash payments from today",
      "Confirm tomorrow's appointments",
      "Wipe down front desk and waiting area",
      "Lock display cases",
      "Set alarm and lock up",
    ],
  },
  {
    title: "Artist: Opening",
    role: "ARTIST",
    frequency: "opening",
    sortOrder: 1,
    checklistItems: [
      "Sterilize workstation",
      "Stock needles and ink for today's bookings",
      "Review client notes for today",
    ],
  },
  {
    title: "Artist: Closing",
    role: "ARTIST",
    frequency: "closing",
    sortOrder: 2,
    checklistItems: [
      "Sterilize all equipment and surfaces",
      "Dispose of sharps and biohazard waste properly",
      "Restock station for tomorrow",
      "Log any supply shortages in Oracle",
    ],
  },
  {
    title: "Maintenance: Daily",
    role: "MAINTENANCE",
    frequency: "daily",
    sortOrder: 1,
    checklistItems: [
      "Check common areas for cleanliness",
      "Inspect and restock cleaning supplies",
      "Check for open maintenance incidents",
      "Confirm AC and equipment are operational",
    ],
  },
  {
    title: "Owner: Opening",
    role: "OWNER",
    frequency: "opening",
    sortOrder: 1,
    checklistItems: [
      "Review yesterday's revenue and expenses",
      "Check team schedule and coverage",
      "Review open incidents and maintenance items",
    ],
  },
  {
    title: "Owner: Closing",
    role: "OWNER",
    frequency: "closing",
    sortOrder: 2,
    checklistItems: [
      "Review today's revenue and cash reconciliation",
      "Confirm all checklists completed",
      "Set alarm and secure premises",
    ],
  },
  {
    title: "Manager: Daily",
    role: "MANAGER",
    frequency: "daily",
    sortOrder: 1,
    checklistItems: [
      "Walk the floor and check station readiness",
      "Review inventory low-stock alerts",
      "Check in with front desk on appointments",
      "Address any open maintenance incidents",
    ],
  },
  {
    title: "Cleaner: Daily",
    role: "CLEANER",
    frequency: "daily",
    sortOrder: 1,
    checklistItems: [
      "Mop all floors",
      "Wipe down all stations",
      "Clean and sanitize sinks",
      "Empty all trash",
      "Restock paper towels and soap",
      "Wipe mirrors",
      "Sweep entrance",
    ],
  },
];

async function ensureSopTemplate(def: SeedSopDef): Promise<string | null> {
  const existing = await db
    .select({ id: sops.id })
    .from(sops)
    .where(eq(sops.title, def.title))
    .limit(1);

  let sopId = existing[0]?.id;
  if (!sopId) {
    const [created] = await db
      .insert(sops)
      .values({
        title: def.title,
        role: def.role === "CLEANER" || def.role === "MAINTENANCE"
          ? null
          : (def.role as (typeof sops.$inferInsert)["role"]),
        frequency: def.frequency,
        sortOrder: def.sortOrder,
        isActive: true,
      })
      .returning({ id: sops.id });
    if (!created?.id) return null;
    const newSopId = created.id;

    await db.insert(sopRoleAssignments).values({
      sopId: newSopId,
      role: def.role,
    });
    await db.insert(sopChecklistItems).values(
      def.checklistItems.map((label, index) => ({
        sopId: newSopId,
        label,
        sortOrder: index + 1,
        isActive: true,
      })),
    );
    return newSopId;
  }

  const resolvedSopId = sopId;

  const roleAssignment = await db
    .select({ id: sopRoleAssignments.id })
    .from(sopRoleAssignments)
    .where(
      and(eq(sopRoleAssignments.sopId, resolvedSopId), eq(sopRoleAssignments.role, def.role)),
    )
    .limit(1);
  if (!roleAssignment[0]) {
    await db.insert(sopRoleAssignments).values({ sopId: resolvedSopId, role: def.role });
  }

  const existingItems = await db
    .select({ label: sopChecklistItems.label })
    .from(sopChecklistItems)
    .where(eq(sopChecklistItems.sopId, resolvedSopId));
  const existingLabels = new Set(existingItems.map((item) => item.label));
  const missingItems = def.checklistItems.filter((label) => !existingLabels.has(label));
  if (missingItems.length > 0) {
    const maxSort = existingItems.length;
    await db.insert(sopChecklistItems).values(
      missingItems.map((label, index) => ({
        sopId: resolvedSopId,
        label,
        sortOrder: maxSort + index + 1,
        isActive: true,
      })),
    );
  }

  return resolvedSopId;
}

async function seedSprintSopTemplates(): Promise<void> {
  let created = 0;
  for (const template of SPRINT_SOP_TEMPLATES) {
    const existing = await db
      .select({ id: sops.id })
      .from(sops)
      .where(eq(sops.title, template.title))
      .limit(1);
    const sopId = await ensureSopTemplate(template);
    if (sopId && !existing[0]) {
      created += 1;
    }
  }
  if (created > 0) {
    console.log(`Seeded ${created} Sprint SOP templates`);
  }
}

async function seedSops(): Promise<void> {
  await seedSprintSopTemplates();

  const existing = await db.select({ id: sops.id }).from(sops).limit(1);
  if (existing[0]) {
    return;
  }

  const [opening] = await db
    .insert(sops)
    .values({
      title: "Opening Checklist",
      role: "FRONT_DESK",
      frequency: "daily",
      isActive: true,
    })
    .returning({ id: sops.id });

  const [artistSetup] = await db
    .insert(sops)
    .values({
      title: "Artist Station Setup",
      role: "ARTIST",
      frequency: "per_session",
      isActive: true,
    })
    .returning({ id: sops.id });

  const [cleaning] = await db
    .insert(sops)
    .values({
      title: "Cleaning Checklist",
      role: null,
      frequency: "daily",
      isActive: true,
    })
    .returning({ id: sops.id });

  if (opening) {
    await db.insert(sopChecklistItems).values([
      { sopId: opening.id, label: "Check appointment schedule", sortOrder: 0 },
      { sopId: opening.id, label: "Confirm deposits received", sortOrder: 1 },
      { sopId: opening.id, label: "Turn on equipment", sortOrder: 2 },
      { sopId: opening.id, label: "Restock front desk supplies", sortOrder: 3 },
      {
        sopId: opening.id,
        label: "Check cleaner completed their list",
        sortOrder: 4,
      },
    ]);
  }

  if (artistSetup) {
    await db.insert(sopChecklistItems).values([
      { sopId: artistSetup.id, label: "Wipe down station", sortOrder: 0 },
      { sopId: artistSetup.id, label: "Set up equipment tray", sortOrder: 1 },
      {
        sopId: artistSetup.id,
        label: "Verify consent form in Porter",
        sortOrder: 2,
      },
      {
        sopId: artistSetup.id,
        label: "Prepare aftercare materials",
        sortOrder: 3,
      },
    ]);
  }

  if (cleaning) {
    await db.insert(sopChecklistItems).values([
      { sopId: cleaning.id, label: "Mop all floors", sortOrder: 0 },
      { sopId: cleaning.id, label: "Wipe down all stations", sortOrder: 1 },
      { sopId: cleaning.id, label: "Clean and sanitize sinks", sortOrder: 2 },
      { sopId: cleaning.id, label: "Empty all trash", sortOrder: 3 },
      {
        sopId: cleaning.id,
        label: "Restock paper towels and soap",
        sortOrder: 4,
      },
      { sopId: cleaning.id, label: "Wipe mirrors", sortOrder: 5 },
      { sopId: cleaning.id, label: "Sweep entrance", sortOrder: 6 },
    ]);

    await db.insert(checklistAccess).values({
      label: "Cleaner",
      accessToken: CLEANER_ACCESS_TOKEN,
      pin: "0000",
      sopId: cleaning.id,
      isActive: true,
    });
  }

  console.log("Created 3 starter SOPs with cleaner PIN 0000");
}

const SEED_INVENTORY = [
  {
    name: "Redemption Black Ink 8oz",
    category: "ink",
    unit: "bottle",
    currentStock: 4,
    reorderThreshold: 2,
    idealStock: 8,
  },
  {
    name: "Eternal Ink Color Set",
    category: "ink",
    unit: "bottle",
    currentStock: 12,
    reorderThreshold: 4,
    idealStock: 20,
  },
  {
    name: "Cartridge Needles - Round Liner",
    category: "needles",
    unit: "box",
    currentStock: 3,
    reorderThreshold: 1,
    idealStock: 6,
  },
  {
    name: "Cartridge Needles - Magnum Shader",
    category: "needles",
    unit: "box",
    currentStock: 3,
    reorderThreshold: 1,
    idealStock: 6,
  },
  {
    name: "Black Nitrile Gloves - Medium",
    category: "gloves",
    unit: "box",
    currentStock: 1,
    reorderThreshold: 1,
    idealStock: 5,
  },
  {
    name: "Black Nitrile Gloves - Large",
    category: "gloves",
    unit: "box",
    currentStock: 0,
    reorderThreshold: 1,
    idealStock: 5,
  },
  {
    name: "Tattoo Aftercare Packets",
    category: "aftercare",
    unit: "pack",
    currentStock: 40,
    reorderThreshold: 10,
    idealStock: 60,
  },
  {
    name: "Stencil Transfer Gel",
    category: "aftercare",
    unit: "bottle",
    currentStock: 3,
    reorderThreshold: 1,
    idealStock: 6,
  },
  {
    name: "Thermal Paper Rolls",
    category: "disposables",
    unit: "roll",
    currentStock: 0,
    reorderThreshold: 2,
    idealStock: 10,
  },
  {
    name: "Barrier Film",
    category: "disposables",
    unit: "roll",
    currentStock: 3,
    reorderThreshold: 1,
    idealStock: 6,
  },
  {
    name: "Ink Caps - Mixed",
    category: "disposables",
    unit: "bag",
    currentStock: 4,
    reorderThreshold: 1,
    idealStock: 8,
  },
  {
    name: "Green Soap",
    category: "cleaning",
    unit: "bottle",
    currentStock: 3,
    reorderThreshold: 1,
    idealStock: 6,
  },
  {
    name: "Isopropyl Alcohol 70%",
    category: "cleaning",
    unit: "bottle",
    currentStock: 4,
    reorderThreshold: 2,
    idealStock: 8,
  },
  {
    name: "Paper Towels",
    category: "disposables",
    unit: "pack",
    currentStock: 6,
    reorderThreshold: 2,
    idealStock: 12,
  },
  {
    name: "Fallen Sparrow Shop T-Shirts",
    category: "merchandise",
    unit: "shirt",
    currentStock: 18,
    reorderThreshold: 6,
    idealStock: 36,
  },
  {
    name: "Fallen Sparrow Stickers (sheet)",
    category: "merchandise",
    unit: "pack",
    currentStock: 8,
    reorderThreshold: 3,
    idealStock: 20,
  },
] as const;

async function seedInventory(): Promise<void> {
  const existing = await db.select({ id: inventoryItems.id }).from(inventoryItems).limit(1);
  if (existing[0]) {
    return;
  }

  await db.insert(inventoryItems).values(
    SEED_INVENTORY.map((item) => ({
      name: item.name,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      reorderThreshold: item.reorderThreshold,
      idealStock: item.idealStock,
      isActive: true,
    })),
  );
  console.log(`Seeded ${SEED_INVENTORY.length} inventory items`);
}

const SEED_TEAM_MEMBERS = [
  { name: "Legion Avegno", displayName: "Legion A", role: "OWNER" as const, pin: "9001" },
  { name: "Hector Morales", displayName: "Hector M", role: "MANAGER" as const, pin: "7723" },
  { name: "Courtney Adams", displayName: "Courtney A", role: "FRONT_DESK" as const, pin: "4412" },
  { name: "JP", displayName: "JP", role: "MAINTENANCE" as const, pin: "7777" },
] as const;

/** Ensure owner/manager PINs keep admin roles even if team_members was seeded earlier. */
async function ensureAdminTeamMemberRoles(): Promise<void> {
  const adminRoles = [
    { name: "Legion Avegno", role: "OWNER" as const },
    { name: "Hector Morales", role: "MANAGER" as const },
  ];

  for (const { name, role } of adminRoles) {
    const updated = await db
      .update(teamMembers)
      .set({ role, updatedAt: new Date() })
      .where(eq(teamMembers.name, name))
      .returning({ id: teamMembers.id });

    if (updated[0]) {
      console.log(`Ensured ${name} team_member role is ${role}`);
    }
  }
}

// Demo seed PINs are unique per employee. After seed, managers must assign unique PINs
// in SOPs > Employee PINs. Runtime login rejects duplicate PINs across active members.

async function seedTeamMembers(): Promise<void> {
  const existing = await db.select({ id: teamMembers.id }).from(teamMembers).limit(1);
  if (existing[0]) {
    await ensureAdminTeamMemberRoles();
    // Sprint 9A: idempotent insert for JP test user if not already present
    const jp = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.name, "JP"))
      .limit(1);
    if (!jp[0]) {
      const pinHash = await hashPin("7777");
      await db.insert(teamMembers).values({
        name: "JP",
        displayName: "JP",
        role: "MAINTENANCE",
        pin: pinHash,
        pinPlaintext: "7777",
        isActive: true,
      });
      console.log("Seeded JP (MAINTENANCE) test user with PIN 7777");
    }
    return;
  }

  const createdPins: string[] = [];
  for (const member of SEED_TEAM_MEMBERS) {
    const pinHash = await hashPin(member.pin);
    await db.insert(teamMembers).values({
      name: member.name,
      displayName: member.displayName,
      role: member.role,
      pin: pinHash,
      pinPlaintext: member.pin,
      isActive: true,
    });
    createdPins.push(`${member.displayName} (${member.role}): ${member.pin}`);
  }

  console.log("Seeded team members with checklist PINs (save these once):");
  for (const line of createdPins) {
    console.log(`  ${line}`);
  }
}

async function main(): Promise<void> {
  console.log("Seeding Fallen Sparrow database...");
  await seedSettings();
  await seedUsers();
  await seedArtists();
  await seedMeta();
  await seedSops();
  await seedTeamMembers();
  await seedInventory();
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
