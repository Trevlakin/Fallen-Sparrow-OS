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
  teamMembers,
  users,
} from "@fallen-sparrow/shared/schema";
import { eq } from "drizzle-orm";
import { db, pool } from "../config/database.js";
import { hashPassword } from "../services/authService.js";
import { hashPin } from "../services/teamMemberService.js";
import type {
  BonusSettings,
  CommissionRatesSetting,
} from "../services/settingsService.js";

const COMMISSION_RATES_KEY = "commission_rates";
const BONUS_AMOUNTS_KEY = "bonus_amounts";

async function seedSettings(): Promise<void> {
  const commissionRates: CommissionRatesSetting = {
    // TODO(Q1d): Confirm per-service commission rates with Legion.
    tattoo: 0.5,
    piercing: 0.5,
    laser: 0.5,
    other: 0.5,
    confirmRates: true,
  };

  const bonusAmounts: BonusSettings = {
    // TODO(Q1d): Confirm walk-in and referral bonus amounts with Legion.
    walkInBonus: 0,
    referralBonus: 0,
  };

  for (const [key, value] of [
    [COMMISSION_RATES_KEY, commissionRates],
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
  for (const user of DEMO_APP_USERS) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);

    if (!existing[0]) {
      await db.insert(users).values({
        email: user.email,
        passwordHash: await hashPassword(DEMO_PASSWORD),
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: null,
        isActive: true,
      });
      console.log(`Created ${user.role.toLowerCase()}: ${user.email} / ${DEMO_PASSWORD}`);
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

async function seedSops(): Promise<void> {
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

async function seedTeamMembers(): Promise<void> {
  const existing = await db.select({ id: teamMembers.id }).from(teamMembers).limit(1);
  if (existing[0]) {
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
